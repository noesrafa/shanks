import { pgSchema, serial, text, timestamp, integer, unique, jsonb } from 'drizzle-orm/pg-core';

const shanksSchema = pgSchema('shanks');

// Adapted from OASIS database.py: user table (user_id, name, bio)
export const users = shanksSchema.table('users', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	bio: text('bio').notNull(),
	interests: text('interests').notNull()
});

// Adapted from OASIS database.py: post table (post_id, user_id, content, created_at, num_likes)
export const posts = shanksSchema.table('posts', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	content: text('content').notNull(),
	numLikes: integer('num_likes').default(0).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// Adapted from OASIS database.py: like table (like_id, user_id, post_id)
export const likes = shanksSchema.table(
	'likes',
	{
		id: serial('id').primaryKey(),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull(),
		postId: integer('post_id')
			.references(() => posts.id)
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [unique().on(t.userId, t.postId)]
);

// Adapted from OASIS database.py: comment table (comment_id, post_id, user_id, content)
export const comments = shanksSchema.table('comments', {
	id: serial('id').primaryKey(),
	postId: integer('post_id')
		.references(() => posts.id)
		.notNull(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// Adapted from OASIS database.py: follow table (follower_id, followee_id)
export const follows = shanksSchema.table(
	'follows',
	{
		id: serial('id').primaryKey(),
		followerId: integer('follower_id')
			.references(() => users.id)
			.notNull(),
		followeeId: integer('followee_id')
			.references(() => users.id)
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [unique().on(t.followerId, t.followeeId)]
);

// MiroFish Stage 1: projects with seed material
export const projects = shanksSchema.table('projects', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	seedText: text('seed_text').notNull(),
	requirement: text('requirement').notNull(),
	ontology: jsonb('ontology'),
	status: text('status').default('created').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// MiroFish Stage 1: knowledge graph nodes (entities)
export const graphNodes = shanksSchema.table('graph_nodes', {
	id: serial('id').primaryKey(),
	projectId: integer('project_id')
		.references(() => projects.id)
		.notNull(),
	name: text('name').notNull(),
	entityType: text('entity_type').notNull(),
	summary: text('summary').notNull(),
	attributes: jsonb('attributes').default({}).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// MiroFish Stage 1: knowledge graph edges (relationships)
export const graphEdges = shanksSchema.table('graph_edges', {
	id: serial('id').primaryKey(),
	projectId: integer('project_id')
		.references(() => projects.id)
		.notNull(),
	sourceNodeId: integer('source_node_id')
		.references(() => graphNodes.id)
		.notNull(),
	targetNodeId: integer('target_node_id')
		.references(() => graphNodes.id)
		.notNull(),
	edgeType: text('edge_type').notNull(),
	fact: text('fact').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});
