import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects, users, posts, comments, follows, agents, graphNodes, reports } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * ReportAgent API.
 * Adapted from MiroFish Stage 4: ReportAgent with ReACT pattern.
 *
 * MiroFish pattern:
 *   1. Planning: LLM receives simulation stats, generates outline (2-5 sections)
 *   2. Per section: ReACT loop with tool calls (search graph, interview agents)
 *   3. Output: markdown report with cited agent statements
 *
 * We simplify: one LLM call with all simulation data as context.
 * The LLM generates a full prediction report.
 */

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { projectId } = await request.json();
		if (!projectId) return json({ error: 'projectId required' }, { status: 400 });

		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});
		if (!project) return json({ error: 'Project not found' }, { status: 404 });

		// Gather all simulation data for the report

		// Agent profiles with stance
		const agentList = await db
			.select({
				name: users.name,
				bio: users.bio,
				persona: agents.persona,
				stance: agents.stance,
				entityType: graphNodes.entityType
			})
			.from(agents)
			.innerJoin(users, eq(agents.userId, users.id))
			.leftJoin(graphNodes, eq(agents.nodeId, graphNodes.id))
			.where(eq(agents.projectId, projectId));

		// Get user IDs belonging to this project (via agents)
		const projectUserIds = agentList.length > 0
			? (await db
				.select({ userId: agents.userId })
				.from(agents)
				.where(eq(agents.projectId, projectId))
			).map(a => a.userId)
			: [];

		// All posts with author names (filtered by project users)
		const allPosts = projectUserIds.length > 0
			? await db
				.select({
					id: posts.id,
					content: posts.content,
					numLikes: posts.numLikes,
					userName: users.name
				})
				.from(posts)
				.innerJoin(users, eq(posts.userId, users.id))
				.where(sql`${posts.userId} IN (${sql.join(projectUserIds.map(id => sql`${id}`), sql`, `)})`)
				.orderBy(desc(posts.numLikes))
				.limit(50)
			: [];

		// All comments with author names (filtered by project users)
		const allComments = projectUserIds.length > 0
			? await db
				.select({
					content: comments.content,
					userName: users.name,
					postId: comments.postId
				})
				.from(comments)
				.innerJoin(users, eq(comments.userId, users.id))
				.where(sql`${comments.userId} IN (${sql.join(projectUserIds.map(id => sql`${id}`), sql`, `)})`)
				.limit(80)
			: [];

		// Follow relationships (filtered by project users)
		const allFollows = projectUserIds.length > 0
			? await db.execute(sql`
				SELECT f1.name as follower, f2.name as following
				FROM shanks.follows fo
				JOIN shanks.users f1 ON fo.follower_id = f1.id
				JOIN shanks.users f2 ON fo.followee_id = f2.id
				WHERE fo.follower_id IN (${sql.join(projectUserIds.map(id => sql`${id}`), sql`, `)})
			`)
			: [];

		// Top liked posts
		const topPosts = allPosts.filter((p) => p.numLikes > 0).slice(0, 10);

		// Build context for the ReportAgent
		const agentSummary = agentList
			.map((a) => `- ${a.name} (${a.entityType}, stance: ${a.stance}): ${a.bio}`)
			.join('\n');

		const postsSummary = allPosts
			.slice(0, 30)
			.map((p) => {
				const postComments = allComments
					.filter((c) => c.postId === p.id)
					.map((c) => `    > ${c.userName}: "${c.content}"`)
					.join('\n');
				const commentsBlock = postComments ? `\n${postComments}` : '';
				return `[${p.numLikes} likes] ${p.userName}: "${p.content}"${commentsBlock}`;
			})
			.join('\n\n');

		const topPostsSummary = topPosts
			.map((p) => `- ${p.userName}: "${p.content.slice(0, 150)}..." (${p.numLikes} likes)`)
			.join('\n');

		const followRows = allFollows as { follower: string; following: string }[];
		const followsSummary = followRows
			.map((f) => `${f.follower} → ${f.following}`)
			.join(', ');

		// Stance distribution
		const stanceCounts: Record<string, number> = {};
		for (const a of agentList) {
			stanceCounts[a.stance] = (stanceCounts[a.stance] || 0) + 1;
		}
		const stanceSummary = Object.entries(stanceCounts)
			.map(([s, c]) => `${s}: ${c}`)
			.join(', ');

		const system = `You are a prediction analyst. You analyze social media simulations to generate prediction reports.

Your report must:
- Answer the original prediction question based on what ACTUALLY happened in the simulation
- Cite specific agent statements (use quotes with agent names)
- Identify emergent patterns: who allied with whom, what narratives dominated, who got pushback
- Make concrete predictions based on the observed dynamics
- Be structured with clear sections
- Be written in English
- Be 800-1500 words

Format: markdown with ## headers for sections. Include agent quotes as blockquotes.`;

		const user = `# PREDICTION QUESTION
${project.requirement}

# SEED MATERIAL (summary)
${project.seedText.slice(0, 2000)}

# SIMULATION RESULTS

## Agents (${agentList.length} total, stance distribution: ${stanceSummary})
${agentSummary}

## Most Engaging Posts
${topPostsSummary || 'No posts with likes yet.'}

## Follow Relationships
${followsSummary || 'No follows yet.'}

## Full Feed (posts + comments)
${postsSummary}

---

Based on this simulation data, write the prediction report. Focus on:
1. What consensus or divisions emerged?
2. Which stakeholders gained or lost influence?
3. What narratives dominated vs got rejected?
4. Your prediction for how this plays out in reality.`;

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
				temperature: 0.4,
				max_tokens: 4096
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
		const report = (data.choices[0].message?.content || '')
			.replace(/<think>[\s\S]*?<\/think>/g, '')
			.trim();

		const stats = {
			agents: agentList.length,
			posts: allPosts.length,
			comments: allComments.length,
			follows: followRows.length,
			stances: stanceCounts
		};

		// Persist report to DB (upsert: delete old + insert new for this project)
		// Table must exist: see schema.ts comment for CREATE TABLE SQL
		try {
			await db.delete(reports).where(eq(reports.projectId, projectId));
			await db.insert(reports).values({ projectId, content: report, stats });
		} catch {
			// Non-fatal: if table doesn't exist yet, skip persistence silently
		}

		return json({ report, stats });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
