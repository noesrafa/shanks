import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects, graphNodes, graphEdges, agents, users, posts, comments, follows, reports } from '$lib/server/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/project/[id]
 * Load complete project state in one request.
 * Returns: project, graph (nodes/edges), agents, recent posts with comments, stats.
 */
export const GET: RequestHandler = async ({ params }) => {
	const projectId = parseInt(params.id);
	if (!projectId) {
		return json({ error: 'Invalid project ID' }, { status: 400 });
	}

	try {
		const project = await db.query.projects.findFirst({
			where: (p, { eq }) => eq(p.id, projectId)
		});

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		// Graph
		const nodes = await db
			.select()
			.from(graphNodes)
			.where(eq(graphNodes.projectId, projectId));

		const edges = await db
			.select()
			.from(graphEdges)
			.where(eq(graphEdges.projectId, projectId));

		// Agents with user profiles
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

		// Get user IDs for this project's agents to scope posts
		const agentUserIds = projectAgents.map((a) => a.userId);

		// Recent posts from project agents
		let projectPosts: any[] = [];
		let projectComments: any[] = [];
		let projectFollows: any[] = [];

		if (agentUserIds.length > 0) {
			const userIdList = agentUserIds.join(',');

			projectPosts = await db.execute(sql`
				SELECT p.id, p.content, p.num_likes as "numLikes", p.created_at as "createdAt",
					u.name as "userName", u.bio as "userBio"
				FROM shanks.posts p
				JOIN shanks.users u ON p.user_id = u.id
				WHERE p.user_id = ANY(ARRAY[${sql.raw(userIdList)}])
				ORDER BY p.created_at DESC
				LIMIT 100
			`) as any[];

			// Comments on those posts
			if (projectPosts.length > 0) {
				const postIds = (projectPosts as any[]).map((p: any) => p.id).join(',');
				projectComments = await db.execute(sql`
					SELECT c.id, c.post_id as "postId", c.content, c.created_at as "createdAt",
						u.name as "userName"
					FROM shanks.comments c
					JOIN shanks.users u ON c.user_id = u.id
					WHERE c.post_id = ANY(ARRAY[${sql.raw(postIds)}])
					ORDER BY c.created_at ASC
				`) as any[];
			}

			// Follow count
			projectFollows = await db.execute(sql`
				SELECT COUNT(*) as count
				FROM shanks.follows
				WHERE follower_id = ANY(ARRAY[${sql.raw(userIdList)}])
			`) as any[];
		}

		// Attach comments to posts
		const postsWithComments = (projectPosts as any[]).map((p: any) => ({
			...p,
			comments: (projectComments as any[]).filter((c: any) => c.postId === p.id)
		}));

		// Stats
		const stats = {
			agents: projectAgents.length,
			posts: (projectPosts as any[]).length,
			comments: (projectComments as any[]).length,
			follows: (projectFollows as any[])[0]?.count ?? 0
		};

		// Restore persisted report if it exists
		let savedReport: { content: string; stats: unknown } | null = null;
		try {
			const reportRow = await db.query.reports.findFirst({
				where: (r, { eq }) => eq(r.projectId, projectId)
			});
			if (reportRow) {
				savedReport = { content: reportRow.content, stats: reportRow.stats };
			}
		} catch {
			// Table may not exist yet — skip silently
		}

		return json({
			project: {
				id: project.id,
				name: project.name,
				seedText: project.seedText,
				requirement: project.requirement,
				ontology: project.ontology,
				status: project.status
			},
			nodes,
			edges,
			agents: projectAgents,
			posts: postsWithComments,
			stats,
			report: savedReport
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
