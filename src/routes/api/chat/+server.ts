import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects, users, posts, comments, agents, graphNodes } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { eq, desc } from 'drizzle-orm';

/**
 * Chat API — Deep Interaction.
 * Adapted from MiroFish Stage 5.
 *
 * Two modes:
 *   1. Chat with ReportAgent (has report + simulation context)
 *   2. Interview an individual agent (has their persona + post history)
 *
 * POST { projectId, message, mode: "report" | "agent", agentName?, history[] }
 */

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { projectId, message, mode, agentName, history, report } = await request.json();

		if (!projectId || !message) {
			return json({ error: 'projectId and message required' }, { status: 400 });
		}

		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});
		if (!project) return json({ error: 'Project not found' }, { status: 404 });

		let systemPrompt: string;

		if (mode === 'agent' && agentName) {
			// Interview mode: talk to a specific agent
			const agent = await db
				.select({
					name: users.name,
					bio: users.bio,
					interests: users.interests,
					persona: agents.persona,
					stance: agents.stance,
					entityType: graphNodes.entityType
				})
				.from(agents)
				.innerJoin(users, eq(agents.userId, users.id))
				.leftJoin(graphNodes, eq(agents.nodeId, graphNodes.id))
				.where(eq(agents.projectId, projectId))
				.then((rows) => rows.find((r) => r.name === agentName));

			if (!agent) return json({ error: `Agent ${agentName} not found` }, { status: 404 });

			// Get their posts
			const agentPosts = await db
				.select({ content: posts.content })
				.from(posts)
				.innerJoin(users, eq(posts.userId, users.id))
				.where(eq(users.name, agentName))
				.orderBy(desc(posts.createdAt))
				.limit(10);

			// Get their comments
			const agentComments = await db
				.select({ content: comments.content })
				.from(comments)
				.innerJoin(users, eq(comments.userId, users.id))
				.where(eq(users.name, agentName))
				.orderBy(desc(comments.createdAt))
				.limit(10);

			// MiroFish interview prefix: "Based on your persona, all past memories and actions..."
			systemPrompt = `You ARE ${agent.name}. You are being interviewed about your actions and opinions during a social media simulation.

# WHO YOU ARE
Name: ${agent.name} (${agent.entityType})
Bio: ${agent.bio}
Stance: ${agent.stance}

# YOUR PERSONALITY
${agent.persona}

# YOUR POSTS DURING THE SIMULATION
${agentPosts.map((p) => `- "${p.content}"`).join('\n') || 'No posts.'}

# YOUR COMMENTS DURING THE SIMULATION
${agentComments.map((c) => `- "${c.content}"`).join('\n') || 'No comments.'}

# RULES
- Stay completely in character. You ARE this person/entity.
- Reference your actual posts and comments when relevant.
- Be opinionated and specific. Don't hedge everything.
- Answer based on your stance and personality, not as a neutral AI.
- Keep responses conversational (2-4 sentences unless asked for detail).`;
		} else {
			// Report chat mode: talk to the ReportAgent
			systemPrompt = `You are the ReportAgent for a social media simulation about: "${project.requirement}"

You have the full prediction report as context. Answer follow-up questions, explain your analysis, and provide additional predictions when asked.

# THE REPORT
${report || 'No report generated yet.'}

# RULES
- Reference specific findings from the report.
- Cite agent names and their statements when relevant.
- Be analytical and direct.
- If asked about something not in the report, say so and offer your best analysis based on the simulation data.
- Keep responses focused (3-5 sentences unless asked for detail).`;
		}

		// Build conversation with history
		const messages = [
			{ role: 'system', content: systemPrompt },
			...(history || []).map((h: { role: string; content: string }) => ({
				role: h.role,
				content: h.content
			})),
			{ role: 'user', content: message }
		];

		const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${MINIMAX_API_KEY}`
			},
			body: JSON.stringify({
				model: 'MiniMax-M2.5',
				messages,
				temperature: 0.7,
				max_tokens: 1024
			})
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`LLM error: ${response.status} ${body}`);
		}

		const data = await response.json();
		if (!data.choices?.length) {
			throw new Error('LLM returned empty choices');
		}
		const reply = (data.choices[0].message?.content || '')
			.replace(/<think>[\s\S]*?<\/think>/g, '')
			.trim();

		return json({ reply });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
