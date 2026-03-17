import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects, users, posts, agents, graphNodes, graphEdges } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { eq } from 'drizzle-orm';

/**
 * Seed posts endpoint.
 * Generates initial LLM posts to kickstart the simulation conversation.
 * Adapted from OASIS: seed posts are the initial "world state" that agents react to.
 *
 * Pattern: for each active agent (activity_level > 0.3), generate one seed post
 * that reflects their persona and stance on the prediction question.
 */

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
	const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${MINIMAX_API_KEY}`
		},
		body: JSON.stringify({
			model: 'MiniMax-M2.5',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			temperature: 0.85,
			max_tokens: 512
		})
	});
	if (!res.ok) throw new Error(`LLM error: ${res.status}`);
	const data = await res.json();
	const text = (data.choices?.[0]?.message?.content || '')
		.replace(/<think>[\s\S]*?<\/think>/g, '')
		.trim();
	if (!text) throw new Error('LLM returned empty response');
	return text;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { projectId } = await request.json();
		if (!projectId) return json({ error: 'projectId required' }, { status: 400 });

		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});
		if (!project) return json({ error: 'Project not found' }, { status: 404 });

		// Load agents with users
		const agentList = await db
			.select({
				userId: agents.userId,
				name: users.name,
				bio: users.bio,
				persona: agents.persona,
				stance: agents.stance,
				activityLevel: agents.activityLevel
			})
			.from(agents)
			.innerJoin(users, eq(agents.userId, users.id))
			.where(eq(agents.projectId, projectId));

		if (agentList.length === 0) {
			return json({ error: 'No agents found. Generate agents in Step 2 first.' }, { status: 400 });
		}

		// Load graph context for richer seed posts
		const nodes = await db
			.select({ name: graphNodes.name, entityType: graphNodes.entityType, summary: graphNodes.summary })
			.from(graphNodes)
			.where(eq(graphNodes.projectId, projectId))
			.limit(10);

		const edges = await db
			.select({ edgeType: graphEdges.edgeType, fact: graphEdges.fact })
			.from(graphEdges)
			.where(eq(graphEdges.projectId, projectId))
			.limit(15);

		const graphContext = [
			nodes.map((n) => `${n.name} (${n.entityType}): ${n.summary}`).join('\n'),
			edges.map((e) => `[${e.edgeType}] ${e.fact}`).join('\n')
		]
			.filter(Boolean)
			.join('\n\n');

		const systemPrompt = `You are roleplaying as a specific person posting on social media. Write a single authentic, opinionated post.

Rules:
- Write in first person, as yourself
- Be SPECIFIC and OPINIONATED — take a real stance, don't be generic
- Reference concrete facts, names, events from the context provided
- Sound like a real person, not a press release
- 1-3 sentences max
- No hashtags, no emojis
- Output ONLY the post text, nothing else`;

		// Select agents to seed: active ones (activity_level > 0.3), up to 8
		const seedAgents = agentList
			.filter((a) => a.activityLevel > 0.3)
			.sort(() => Math.random() - 0.5)
			.slice(0, 8);

		const seededPosts: { agentName: string; content: string }[] = [];

		for (const agent of seedAgents) {
			try {
				const userPrompt = `You are ${agent.name}.

Your profile: ${agent.bio}
Your persona: ${agent.persona}
Your stance on this topic: ${agent.stance}

The prediction question being debated: ${project.requirement}

Key context about players and events:
${graphContext.slice(0, 2000)}

Write one social media post expressing your genuine opinion. Be specific — reference real names, events, or facts from the context.`;

				const raw = await callLLM(systemPrompt, userPrompt);
				// Strip surrounding quotes if LLM added them
				const content = raw.replace(/^["']|["']$/g, '').trim();
				if (!content) continue;

				const [post] = await db
					.insert(posts)
					.values({ userId: agent.userId, content })
					.returning();

				if (post) {
					seededPosts.push({ agentName: agent.name, content });
				}
			} catch (err) {
				// Skip this agent on failure, continue with others
				console.error(`Seed post failed for ${agent.name}:`, err);
			}
		}

		return json({
			seeded: seededPosts.length,
			posts: seededPosts
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
