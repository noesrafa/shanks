import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, agents, graphNodes, graphEdges } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { eq } from 'drizzle-orm';

/**
 * Agent generation API.
 * Adapted from MiroFish Stage 2: OasisProfileGenerator.
 *
 * MiroFish pattern:
 *   1. Read entities from knowledge graph
 *   2. For each entity, do hybrid search for context (related edges + nodes)
 *   3. Classify as individual vs group, use different prompts
 *   4. LLM generates: bio (200 chars), persona (2000 chars), stance, activity_level
 *   5. Store as agent + user record
 *
 * POST: Generate agents from project graph
 * GET: Fetch agents for a project
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
	// MiroFish classifies entities as individual vs group
	const individualTypes = ['Person', 'Politician', 'Executive', 'Journalist', 'Activist'];
	const isIndividual = individualTypes.some(
		(t) => entity.entityType.toLowerCase().includes(t.toLowerCase())
	);

	const system = isIndividual
		? `You are a social media persona generator for simulation. Generate a detailed, realistic persona for an INDIVIDUAL who will participate in a social media simulation about this topic.

The persona should feel like a real person with opinions, personality quirks, and a distinct voice.`
		: `You are a social media persona generator for simulation. Generate a persona for an OFFICIAL ACCOUNT REPRESENTATIVE of an organization/institution who manages their social media presence.

The persona should reflect the organization's public stance and communication style.`;

	const user = `Entity: ${entity.name} (${entity.entityType})
Summary: ${entity.summary}

Context from knowledge graph:
${context}

Simulation question: ${requirement}

Generate a social media profile. Return ONLY valid JSON:
{
  "bio": "200 char max social media bio",
  "persona": "Detailed personality description (500-1000 chars). Include: background, communication style, likely stance on the topic, what they post about, how they interact with others. Be specific and opinionated.",
  "interests": "comma-separated interest tags relevant to this entity",
  "stance": "supportive|opposing|neutral|observer (regarding the simulation question)",
  "activity_level": 0.7
}

activity_level: 0.0 (rarely posts) to 1.0 (very active). Officials and organizations are typically 0.3-0.5, activists and journalists 0.7-0.9.`;

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
			temperature: 0.7,
			max_tokens: 1024
		})
	});

	if (!response.ok) throw new Error(`LLM error: ${response.status}`);

	const data = await response.json();
	const raw = (data.choices[0].message.content || '')
		.replace(/<think>[\s\S]*?<\/think>/g, '')
		.trim();

	const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	const jsonStr = match ? match[1].trim() : raw;
	return JSON.parse(jsonStr);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { projectId } = await request.json();
		if (!projectId) {
			return json({ error: 'projectId is required' }, { status: 400 });
		}

		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});
		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		// Get all entities from the graph
		const nodes = await db
			.select()
			.from(graphNodes)
			.where(eq(graphNodes.projectId, projectId));

		// Get all edges for context
		const edges = await db
			.select()
			.from(graphEdges)
			.where(eq(graphEdges.projectId, projectId));

		// Generate agent for each entity (parallel, batched to avoid rate limits)
		const generatedAgents = [];
		const batchSize = 5;

		for (let i = 0; i < nodes.length; i += batchSize) {
			const batch = nodes.slice(i, i + batchSize);
			const results = await Promise.all(
				batch.map(async (node) => {
					// Build context from related edges (like MiroFish hybrid search)
					const relatedEdges = edges.filter(
						(e) => e.sourceNodeId === node.id || e.targetNodeId === node.id
					);
					const context = relatedEdges
						.map((e) => {
							const source = nodes.find((n) => n.id === e.sourceNodeId);
							const target = nodes.find((n) => n.id === e.targetNodeId);
							return `${source?.name} --[${e.edgeType}]--> ${target?.name}: ${e.fact}`;
						})
						.join('\n');

					const profile = await generateAgentProfile(
						{ name: node.name, entityType: node.entityType, summary: node.summary },
						context || 'No additional context available.',
						project.requirement
					);

					// Create user record
					const [user] = await db
						.insert(users)
						.values({
							name: node.name,
							bio: profile.bio,
							interests: profile.interests
						})
						.returning();

					// Create agent record
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

					return {
						id: agent.id,
						userId: user.id,
						name: node.name,
						entityType: node.entityType,
						bio: profile.bio,
						persona: profile.persona,
						interests: profile.interests.split(',').map((s: string) => s.trim()),
						stance: profile.stance,
						activityLevel: profile.activity_level
					};
				})
			);
			generatedAgents.push(...results);
		}

		return json({ agents: generatedAgents });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const projectId = parseInt(url.searchParams.get('projectId') || '0');
	if (!projectId) {
		return json({ error: 'projectId required' }, { status: 400 });
	}

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
