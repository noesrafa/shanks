import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, type FeedPost, type FeedComment } from '$lib/agents';
import { db } from '$lib/server/db';
import { users, posts, likes, comments, follows } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { desc, eq, sql, inArray } from 'drizzle-orm';

/**
 * Simulation endpoint adapted from OASIS's simulation loop.
 *
 * OASIS flow (oasis/environment/env.py):
 *   1. reset() — create agents, sign them up
 *   2. update_rec_table() — refresh recommendations (personalized feed)
 *   3. step(actions) — each agent observes THEIR feed + decides action in parallel
 *   4. Results saved to database
 *
 * Feed personalization (like OASIS refresh()):
 *   - Posts from followed users (sorted by likes) + recent posts from everyone
 *   - Each agent sees a different feed based on who they follow
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

/**
 * Build personalized feed for an agent.
 * Adapted from OASIS refresh(): posts from followed users first, then recent from all.
 */
async function buildFeedForUser(userId: number): Promise<FeedPost[]> {
	// Get who this user follows
	const userFollows = await db
		.select({ followeeId: follows.followeeId })
		.from(follows)
		.where(eq(follows.followerId, userId));

	const followeeIds = userFollows.map((f) => f.followeeId);

	let feedPosts;

	if (followeeIds.length > 0) {
		// Like OASIS: posts from followed users (by likes) + recent from all, deduped
		const followedPosts = await db
			.select({ id: posts.id, content: posts.content, numLikes: posts.numLikes, userName: users.name })
			.from(posts)
			.innerJoin(users, eq(posts.userId, users.id))
			.where(inArray(posts.userId, followeeIds))
			.orderBy(desc(posts.numLikes))
			.limit(10);

		const recentPosts = await db
			.select({ id: posts.id, content: posts.content, numLikes: posts.numLikes, userName: users.name })
			.from(posts)
			.innerJoin(users, eq(posts.userId, users.id))
			.orderBy(desc(posts.createdAt))
			.limit(10);

		// Deduplicate (followed posts first, like OASIS)
		const seen = new Set<number>();
		const combined = [];
		for (const p of [...followedPosts, ...recentPosts]) {
			if (!seen.has(p.id)) {
				seen.add(p.id);
				combined.push(p);
			}
		}
		feedPosts = combined.slice(0, 15);
	} else {
		// No follows yet — show recent posts from everyone
		feedPosts = await db
			.select({ id: posts.id, content: posts.content, numLikes: posts.numLikes, userName: users.name })
			.from(posts)
			.innerJoin(users, eq(posts.userId, users.id))
			.orderBy(desc(posts.createdAt))
			.limit(15);
	}

	// Attach comments (like OASIS _add_comments_to_posts)
	const feed: FeedPost[] = await Promise.all(
		feedPosts.map(async (p) => {
			const postComments = await db
				.select({ id: comments.id, content: comments.content, userName: users.name })
				.from(comments)
				.innerJoin(users, eq(comments.userId, users.id))
				.where(eq(comments.postId, p.id))
				.orderBy(comments.createdAt);

			return {
				post_id: p.id,
				user_name: p.userName,
				content: p.content,
				num_likes: p.numLikes,
				comments: postComments.map((c) => ({
					comment_id: c.id,
					user_name: c.userName,
					content: c.content
				}))
			};
		})
	);

	return feed;
}

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
					.values({ name: profile.name, bio: profile.bio, interests: profile.interests })
					.returning();
				return created;
			})
		);

		// Step 2+3: Each agent gets THEIR personalized feed, then decides action
		const results = await Promise.all(
			agents.map(async (agent, i) => {
				const userId = userRecords[i].id;

				// Personalized feed per agent (like OASIS refresh per user)
				const feed = await buildFeedForUser(userId);
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
							return { agent: agent.name, action: 'like_post' as const, postId: action.post_id };
						} catch {
							return { agent: agent.name, action: 'do_nothing' as const };
						}
					}
					case 'create_comment': {
						try {
							const [comment] = await db
								.insert(comments)
								.values({ postId: action.post_id, userId, content: action.content })
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
					case 'follow': {
						try {
							// Resolve user_name to user_id
							const target = await db.query.users.findFirst({
								where: (u, { eq }) => eq(u.name, action.user_name)
							});
							if (!target || target.id === userId) {
								return { agent: agent.name, action: 'do_nothing' as const };
							}
							await db.insert(follows).values({ followerId: userId, followeeId: target.id });
							return {
								agent: agent.name,
								action: 'follow' as const,
								target: action.user_name
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

		// Return full updated feed (global view for UI)
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
