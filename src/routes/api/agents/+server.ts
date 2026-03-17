import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, agents, graphNodes, graphEdges } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { eq } from 'drizzle-orm';

/**
 * Agent generation API.
 * Adapted from MiroFish Stage 2: OasisProfileGenerator.
 */

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

interface GeneratedProfile {
	bio: string;
	persona: string;
	interests: string;
	stance: 'supportive' | 'opposing' | 'neutral' | 'observer';
	activity_level: number;
}

async function generateAgentProfile(
	entity: { name: string; entityType: string; summary: string },
	context: string,
	requirement: string
): Promise<GeneratedProfile> {
	const individualTypes = ['Person', 'Politician', 'Executive', 'Journalist', 'Activist'];
	const isIndividual = individualTypes.some(
		(t) => entity.entityType.toLowerCase().includes(t.toLowerCase())
	);

	const system = isIndividual
		? `You generate social media personas for simulation. Create a SPECIFIC, OPINIONATED individual — not a generic placeholder. They should feel like a real person with flaws, biases, and a distinct voice. Return ONLY valid JSON.`
		: `You generate social media personas for simulation. Create a persona for someone who runs this organization's social media. They should have a clear institutional voice but also personality quirks. Return ONLY valid JSON.`;

	const user = `Entity: ${entity.name} (${entity.entityType})
Summary: ${entity.summary}
Context: ${context}
Simulation question: ${requirement}

Return this exact JSON structure:
{"bio": "punchy 200 char bio, written in first person like a real social media bio", "persona": "500-1000 chars. Include: their SPECIFIC opinion on the simulation question, HOW they argue (aggressive? diplomatic? sarcastic?), what makes them ANGRY, what they would FIGHT about online, their blind spots and biases. Be concrete, not generic.", "interests": "tag1, tag2, tag3", "stance": "supportive", "activity_level": 0.5}

stance: supportive (pro the main issue), opposing (against), neutral (genuinely undecided), observer (watches but rarely engages)
activity_level: 0.0 to 1.0 — trolls and activists are 0.8-1.0, institutions 0.3-0.5, observers 0.1-0.3`;

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${MINIMAX_API_KEY}`
				},
				body: JSON.stringify({
					model: 'MiniMax-M2.5',
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: user }
					],
					temperature: 0.5 - attempt * 0.2,
					max_tokens: 1024
				})
			});

			if (!response.ok) continue;

			const data = await response.json();
			if (!data.choices?.length) continue;
			const raw = (data.choices[0].message?.content || '')
				.replace(/<think>[\s\S]*?<\/think>/g, '')
				.trim();

			const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
			if (match) {
				try {
					return JSON.parse(match[1].trim());
				} catch {
					continue;
				}
			}
		} catch {
			continue;
		}
	}

	// Fallback
	return {
		bio: entity.summary.slice(0, 200),
		persona: `${entity.name} is a ${entity.entityType} involved in this topic. They engage in public discourse based on their institutional role.`,
		interests: entity.entityType.toLowerCase(),
		stance: 'neutral',
		activity_level: 0.5
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { projectId } = await request.json();
		if (!projectId) return json({ error: 'projectId is required' }, { status: 400 });

		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});
		if (!project) return json({ error: 'Project not found' }, { status: 404 });

		const nodes = await db.select().from(graphNodes).where(eq(graphNodes.projectId, projectId));
		const edges = await db.select().from(graphEdges).where(eq(graphEdges.projectId, projectId));

		const generatedAgents = [];
		const batchSize = 5;

		for (let i = 0; i < nodes.length; i += batchSize) {
			const batch = nodes.slice(i, i + batchSize);
			const results = await Promise.allSettled(
				batch.map(async (node) => {
					const relatedEdges = edges.filter(
						(e) => e.sourceNodeId === node.id || e.targetNodeId === node.id
					);
					const context = relatedEdges
						.map((e) => {
							const src = nodes.find((n) => n.id === e.sourceNodeId);
							const tgt = nodes.find((n) => n.id === e.targetNodeId);
							return `${src?.name} --[${e.edgeType}]--> ${tgt?.name}: ${e.fact}`;
						})
						.join('\n');

					const profile = await generateAgentProfile(
						{ name: node.name, entityType: node.entityType, summary: node.summary },
						context || 'No additional context.',
						project.requirement
					);

					const [user] = await db
						.insert(users)
						.values({ name: node.name, bio: profile.bio, interests: profile.interests })
						.returning();
					if (!user) throw new Error(`Failed to insert user for ${node.name}`);

					const [agent] = await db
						.insert(agents)
						.values({
							projectId,
							userId: user.id,
							nodeId: node.id,
							persona: profile.persona,
							stance: profile.stance,
							activityLevel: profile.activity_level
						})
						.returning();
					if (!agent) throw new Error(`Failed to insert agent for ${node.name}`);

					return {
						id: agent.id,
						userId: user.id,
						name: node.name,
						entityType: node.entityType,
						bio: profile.bio,
						persona: profile.persona,
						interests:
							typeof profile.interests === 'string'
								? profile.interests.split(',').map((s: string) => s.trim())
								: [node.entityType.toLowerCase()],
						stance: profile.stance,
						activityLevel: profile.activity_level
					};
				})
			);

			for (const r of results) {
				if (r.status === 'fulfilled') {
					generatedAgents.push(r.value);
				} else {
					console.error('Agent generation failed:', r.reason);
				}
			}
		}

		return json({ agents: generatedAgents });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const projectId = parseInt(url.searchParams.get('projectId') || '0');
	if (!projectId) return json({ error: 'projectId required' }, { status: 400 });

	const projectAgents = await db
		.select({
			id: agents.id,
			userId: agents.userId,
			name: users.name,
			bio: users.bio,
			interests: users.interests,
			persona: agents.persona,
			stance: agents.stance,
			activityLevel: agents.activityLevel,
			entityType: graphNodes.entityType
		})
		.from(agents)
		.innerJoin(users, eq(agents.userId, users.id))
		.leftJoin(graphNodes, eq(agents.nodeId, graphNodes.id))
		.where(eq(agents.projectId, projectId));

	return json({ agents: projectAgents });
};
