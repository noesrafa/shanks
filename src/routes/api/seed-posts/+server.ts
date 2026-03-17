import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, posts, agents, graphNodes } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { eq } from 'drizzle-orm';

/**
 * Seed Posts endpoint.
 * Adapted from MiroFish _generate_event_config() + _assign_initial_post_agents().
 *
 * Generates 3-5 initial posts via LLM, attributed to agents matching the
 * requested entity type. These posts bootstrap the simulation feed so agents
 * don't start from an empty context on round 1.
 */

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

interface SeedPost {
	content: string;
	poster_type: string;
}

function parseJsonArray(text: string): SeedPost[] {
	const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	let jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

	if (!fenceMatch) {
		const arrStart = jsonStr.indexOf('[');
		const arrEnd = jsonStr.lastIndexOf(']');
		if (arrStart !== -1 && arrEnd > arrStart) {
			jsonStr = jsonStr.slice(arrStart, arrEnd + 1);
		}
	}

	try {
		return JSON.parse(jsonStr);
	} catch {
		const cleaned = jsonStr
			.replace(/[\x00-\x1f\x7f]/g, (ch: string) => (ch === '\n' || ch === '\t' ? ch : ' '))
			.replace(/,\s*([}\]])/g, '$1');
		return JSON.parse(cleaned);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { projectId } = await request.json();
		if (!projectId) return json({ error: 'projectId required' }, { status: 400 });

		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});
		if (!project) return json({ error: 'Project not found' }, { status: 404 });

		const agentRows = await db
			.select({
				userId: agents.userId,
				name: users.name,
				entityType: graphNodes.entityType
			})
			.from(agents)
			.innerJoin(users, eq(agents.userId, users.id))
			.innerJoin(graphNodes, eq(agents.nodeId, graphNodes.id))
			.where(eq(agents.projectId, projectId));

		if (agentRows.length === 0) {
			return json({ error: 'No agents found. Generate agents first.' }, { status: 400 });
		}

		const entityTypes = [...new Set(agentRows.map((a) => a.entityType))];
		const seedCount = Math.min(5, Math.max(3, Math.floor(agentRows.length / 3)));

		const systemPrompt = `You are a social media simulation expert. Generate realistic initial posts that bootstrap a discussion. Return ONLY a valid JSON array, no markdown, no explanation.`;

		const userPrompt = `Topic: ${project.requirement}

Background material:
${project.seedText.slice(0, 3000)}

Available poster types: ${entityTypes.join(', ')}

Generate ${seedCount} diverse seed posts that kick off a realistic social media discussion. Each post must:
- Be written authentically in the voice of that entity type (official statement, news report, activist call, personal opinion, etc.)
- Take a clear position or share specific information from the background material
- Be 1-4 sentences, realistic social media length
- Cover different angles/viewpoints on the topic

Return JSON array only:
[{"content": "post text here", "poster_type": "one of the available poster types"}, ...]`;

		const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
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
				temperature: 0.7,
				max_tokens: 1024
			})
		});

		if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

		const data = await response.json();
		if (!data.choices?.length) throw new Error('LLM returned empty choices');

		const raw = (data.choices[0].message?.content || '')
			.replace(/<think>[\s\S]*?<\/think>/g, '')
			.trim();

		const seedPosts = parseJsonArray(raw);
		if (!Array.isArray(seedPosts) || seedPosts.length === 0) {
			throw new Error('LLM did not return valid seed posts');
		}

		// Group agents by entity type for assignment
		// Adapted from MiroFish _assign_initial_post_agents()
		const agentsByType = new Map<string, typeof agentRows>();
		for (const agent of agentRows) {
			const key = agent.entityType.toLowerCase();
			if (!agentsByType.has(key)) agentsByType.set(key, []);
			agentsByType.get(key)!.push(agent);
		}

		const typeRoundRobin = new Map<string, number>();
		const insertedPosts = [];

		for (const seedPost of seedPosts) {
			const posterKey = seedPost.poster_type.toLowerCase();

			// Direct type match, then partial match, then fallback
			let candidates = agentsByType.get(posterKey);
			if (!candidates || candidates.length === 0) {
				for (const [key, value] of agentsByType) {
					if (key.includes(posterKey) || posterKey.includes(key)) {
						candidates = value;
						break;
					}
				}
			}
			if (!candidates || candidates.length === 0) candidates = agentRows;

			const idx = typeRoundRobin.get(posterKey) ?? 0;
			const assigned = candidates[idx % candidates.length];
			typeRoundRobin.set(posterKey, idx + 1);

			const [post] = await db
				.insert(posts)
				.values({ userId: assigned.userId, content: seedPost.content })
				.returning();

			if (post) {
				insertedPosts.push({ ...post, userName: assigned.name, userBio: '', comments: [] });
			}
		}

		return json({ posts: insertedPosts, count: insertedPosts.length });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
