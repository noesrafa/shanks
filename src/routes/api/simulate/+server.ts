import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent } from '$lib/agents';
import { db } from '$lib/server/db';
import { users, posts } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';

/**
 * Simulation endpoint adapted from OASIS's simulation loop.
 *
 * OASIS flow (oasis/environment/env.py):
 *   1. reset() — create agents, sign them up
 *   2. step(actions) — each agent performs actions in parallel
 *   3. Results saved to database
 *
 * We simplify: one endpoint that does reset + one step of CREATE_POST.
 */

// Hardcoded agent profiles (like OASIS's agent CSV data)
const AGENT_PROFILES = [
	{
		name: 'Maya Chen',
		bio: 'AI researcher and coffee addict. Exploring the frontier of machine learning.',
		interests: 'artificial intelligence, deep learning, coffee, hiking'
	},
	{
		name: 'Carlos Rivera',
		bio: 'Street photographer capturing urban stories. Based in Mexico City.',
		interests: 'photography, street art, travel, film, urban culture'
	},
	{
		name: 'Priya Sharma',
		bio: 'Climate activist and environmental science student. Every action counts.',
		interests: 'climate change, sustainability, renewable energy, veganism, activism'
	}
];

export const POST: RequestHandler = async () => {
	try {
		const agents = AGENT_PROFILES.map((p) => new Agent(p));

		// Step 1: "reset" — Ensure agents exist in DB (like OASIS sign_up)
		const userRecords = await Promise.all(
			AGENT_PROFILES.map(async (profile) => {
				const existing = await db.query.users.findFirst({
					where: (u, { eq }) => eq(u.name, profile.name)
				});
				if (existing) return existing;

				const [created] = await db
					.insert(users)
					.values({
						name: profile.name,
						bio: profile.bio,
						interests: profile.interests
					})
					.returning();
				return created;
			})
		);

		// Step 2: "step" — Each agent generates a post (parallel, like OASIS asyncio.gather)
		const generatedPosts = await Promise.all(
			agents.map(async (agent, i) => {
				const content = await agent.generatePost(MINIMAX_API_KEY);
				const [post] = await db
					.insert(posts)
					.values({
						userId: userRecords[i].id,
						content
					})
					.returning();
				return {
					...post,
					userName: agent.name,
					userBio: agent.bio
				};
			})
		);

		return json({ posts: generatedPosts });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
