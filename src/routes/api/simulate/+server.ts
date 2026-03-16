import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, type FeedPost, type FeedComment } from '$lib/agents';
import { db } from '$lib/server/db';
import { users, posts, likes, comments } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * Simulation endpoint adapted from OASIS's simulation loop.
 *
 * OASIS flow (oasis/environment/env.py):
 *   1. reset() — create agents, sign them up
 *   2. update_rec_table() — refresh recommendations
 *   3. step(actions) — each agent observes feed + decides action in parallel
 *   4. Results saved to database
 *
 * Sprint 3: adds create_comment action + comments in feed + 5 agents.
 */

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
	},
	{
		name: 'Jordan Blake',
		bio: 'Indie game developer and retro computing enthusiast. Building worlds one pixel at a time.',
		interests: 'game development, pixel art, retro gaming, indie music, programming'
	},
	{
		name: 'Amara Osei',
		bio: 'Startup founder in fintech. Obsessed with financial inclusion across Africa.',
		interests: 'fintech, startups, Africa, mobile payments, venture capital, economics'
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

		// Step 2: Get current feed with comments (like OASIS _add_comments_to_posts)
		const currentPosts = await db
			.select({
				id: posts.id,
				content: posts.content,
				numLikes: posts.numLikes,
				userName: users.name
			})
			.from(posts)
			.innerJoin(users, eq(posts.userId, users.id))
			.orderBy(desc(posts.createdAt))
			.limit(20);

		// Attach comments to each post (like OASIS platform_utils._add_comments_to_posts)
		const feed: FeedPost[] = await Promise.all(
			currentPosts.map(async (p) => {
				const postComments = await db
					.select({
						id: comments.id,
						content: comments.content,
						userName: users.name
					})
					.from(comments)
					.innerJoin(users, eq(comments.userId, users.id))
					.where(eq(comments.postId, p.id))
					.orderBy(comments.createdAt);

				const feedComments: FeedComment[] = postComments.map((c) => ({
					comment_id: c.id,
					user_name: c.userName,
					content: c.content
				}));

				return {
					post_id: p.id,
					user_name: p.userName,
					content: p.content,
					num_likes: p.numLikes,
					comments: feedComments
				};
			})
		);

		// Step 3: Each agent observes feed + decides action (parallel, like OASIS asyncio.gather)
		const results = await Promise.all(
			agents.map(async (agent, i) => {
				const userId = userRecords[i].id;
				const action = await agent.decideAction(MINIMAX_API_KEY, feed);

				switch (action.type) {
					case 'create_post': {
						const [post] = await db
							.insert(posts)
							.values({ userId, content: action.content })
							.returning();
						return {
							agent: agent.name,
							action: 'create_post' as const,
							post: { ...post, userName: agent.name, userBio: agent.bio }
						};
					}
					case 'like_post': {
						try {
							await db.insert(likes).values({ userId, postId: action.post_id });
							await db
								.update(posts)
								.set({ numLikes: sql`${posts.numLikes} + 1` })
								.where(eq(posts.id, action.post_id));
							return {
								agent: agent.name,
								action: 'like_post' as const,
								postId: action.post_id
							};
						} catch {
							return { agent: agent.name, action: 'do_nothing' as const };
						}
					}
					case 'create_comment': {
						try {
							const [comment] = await db
								.insert(comments)
								.values({
									postId: action.post_id,
									userId,
									content: action.content
								})
								.returning();
							return {
								agent: agent.name,
								action: 'create_comment' as const,
								postId: action.post_id,
								comment: comment.content
							};
						} catch {
							return { agent: agent.name, action: 'do_nothing' as const };
						}
					}
					default:
						return { agent: agent.name, action: 'do_nothing' as const };
				}
			})
		);

		// Return full updated feed with comments for the UI
		const allPosts = await db
			.select({
				id: posts.id,
				userId: posts.userId,
				content: posts.content,
				numLikes: posts.numLikes,
				createdAt: posts.createdAt,
				userName: users.name,
				userBio: users.bio
			})
			.from(posts)
			.innerJoin(users, eq(posts.userId, users.id))
			.orderBy(desc(posts.createdAt))
			.limit(50);

		// Attach comments to response posts
		const postsWithComments = await Promise.all(
			allPosts.map(async (p) => {
				const postComments = await db
					.select({
						id: comments.id,
						content: comments.content,
						userName: users.name,
						createdAt: comments.createdAt
					})
					.from(comments)
					.innerJoin(users, eq(comments.userId, users.id))
					.where(eq(comments.postId, p.id))
					.orderBy(comments.createdAt);

				return { ...p, comments: postComments };
			})
		);

		return json({ actions: results, posts: postsWithComments });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
