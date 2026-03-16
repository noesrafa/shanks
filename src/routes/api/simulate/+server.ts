import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, type FeedPost } from '$lib/agents';
import { db } from '$lib/server/db';
import { users, posts, likes, comments, follows, agents } from '$lib/server/schema';
import { MINIMAX_API_KEY } from '$env/static/private';
import { desc, eq, sql, inArray } from 'drizzle-orm';

/**
 * Simulation endpoint adapted from OASIS's simulation loop.
 *
 * Now supports two modes:
 *   1. Project mode: POST { projectId } — uses agents generated from knowledge graph
 *   2. Demo mode: POST {} — uses hardcoded agents (backward compat)
 *
 * Each agent gets a personalized feed (like OASIS refresh), decides action via tool calling.
 */

const DEMO_PROFILES = [
	{ name: 'Maya Chen', bio: 'AI researcher and coffee addict.', interests: 'AI, deep learning, coffee' },
	{ name: 'Carlos Rivera', bio: 'Street photographer in Mexico City.', interests: 'photography, street art, travel' },
	{ name: 'Priya Sharma', bio: 'Climate activist and student.', interests: 'climate, sustainability, activism' }
];

async function buildFeedForUser(userId: number): Promise<FeedPost[]> {
	const userFollows = await db
		.select({ followeeId: follows.followeeId })
		.from(follows)
		.where(eq(follows.followerId, userId));

	const followeeIds = userFollows.map((f) => f.followeeId);
	let feedPosts;

	if (followeeIds.length > 0) {
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
		feedPosts = await db
			.select({ id: posts.id, content: posts.content, numLikes: posts.numLikes, userName: users.name })
			.from(posts)
			.innerJoin(users, eq(posts.userId, users.id))
			.orderBy(desc(posts.createdAt))
			.limit(15);
	}

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

/**
 * Load agents for simulation. If projectId given, use generated agents.
 * Otherwise fall back to demo profiles.
 */
async function loadAgents(projectId?: number): Promise<{ agent: Agent; userId: number; name: string; bio: string }[]> {
	if (projectId) {
		// Project mode: use agents from knowledge graph
		const projectAgents = await db
			.select({
				userId: agents.userId,
				name: users.name,
				bio: users.bio,
				interests: users.interests,
				persona: agents.persona,
				activityLevel: agents.activityLevel
			})
			.from(agents)
			.innerJoin(users, eq(agents.userId, users.id))
			.where(eq(agents.projectId, projectId));

		return projectAgents.map((a) => ({
			// Use persona as enhanced system context for the agent
			agent: new Agent({
				name: a.name,
				bio: a.bio + '\n\nPersona: ' + a.persona,
				interests: a.interests
			}),
			userId: a.userId,
			name: a.name,
			bio: a.bio
		}));
	}

	// Demo mode: hardcoded agents
	const result = await Promise.all(
		DEMO_PROFILES.map(async (profile) => {
			const existing = await db.query.users.findFirst({
				where: (u, { eq }) => eq(u.name, profile.name)
			});
			const user = existing || (await db.insert(users).values(profile).returning())[0];

			return {
				agent: new Agent(profile),
				userId: user.id,
				name: profile.name,
				bio: profile.bio
			};
		})
	);
	return result;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const projectId = body.projectId as number | undefined;

		const agentList = await loadAgents(projectId);

		if (agentList.length === 0) {
			return json({ error: 'No agents found. Generate agents in Step 2 first.' }, { status: 400 });
		}

		// Each agent: get personalized feed → decide action → execute
		const results = await Promise.allSettled(
			agentList.map(async ({ agent, userId, name, bio }) => {
				const feed = await buildFeedForUser(userId);
				const action = await agent.decideAction(MINIMAX_API_KEY, feed);

				switch (action.type) {
					case 'create_post': {
						const [post] = await db
							.insert(posts)
							.values({ userId, content: action.content })
							.returning();
						return {
							agent: name,
							action: 'create_post' as const,
							post: { ...post, userName: name, userBio: bio }
						};
					}
					case 'like_post': {
						try {
							await db.insert(likes).values({ userId, postId: action.post_id });
							await db
								.update(posts)
								.set({ numLikes: sql`${posts.numLikes} + 1` })
								.where(eq(posts.id, action.post_id));
							return { agent: name, action: 'like_post' as const, postId: action.post_id };
						} catch {
							return { agent: name, action: 'do_nothing' as const };
						}
					}
					case 'create_comment': {
						try {
							const [comment] = await db
								.insert(comments)
								.values({ postId: action.post_id, userId, content: action.content })
								.returning();
							return {
								agent: name,
								action: 'create_comment' as const,
								postId: action.post_id,
								comment: comment.content
							};
						} catch {
							return { agent: name, action: 'do_nothing' as const };
						}
					}
					case 'follow': {
						try {
							const target = await db.query.users.findFirst({
								where: (u, { eq }) => eq(u.name, action.user_name)
							});
							if (!target || target.id === userId) {
								return { agent: name, action: 'do_nothing' as const };
							}
							await db.insert(follows).values({ followerId: userId, followeeId: target.id });
							return { agent: name, action: 'follow' as const, target: action.user_name };
						} catch {
							return { agent: name, action: 'do_nothing' as const };
						}
					}
					default:
						return { agent: name, action: 'do_nothing' as const };
				}
			})
		);

		const actions = results
			.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
			.map((r) => r.value);

		// Return full feed
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
					.select({ id: comments.id, content: comments.content, userName: users.name, createdAt: comments.createdAt })
					.from(comments)
					.innerJoin(users, eq(comments.userId, users.id))
					.where(eq(comments.postId, p.id))
					.orderBy(comments.createdAt);
				return { ...p, comments: postComments };
			})
		);

		return json({ actions, posts: postsWithComments });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
