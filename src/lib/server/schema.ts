import { pgSchema, serial, text, timestamp, integer, unique, jsonb, real } from 'drizzle-orm/pg-core';

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

// MiroFish Stage 2: agents generated from graph entities
export const agents = shanksSchema.table('agents', {
	id: serial('id').primaryKey(),
	projectId: integer('project_id')
		.references(() => projects.id)
		.notNull(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	nodeId: integer('node_id').references(() => graphNodes.id),
	persona: text('persona').notNull(),
	stance: text('stance').default('neutral').notNull(),
	activityLevel: real('activity_level').default(0.5).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// MiroFish gap P0-1: agent memory — persistent memory between simulation rounds
// Adapted from MiroFish Zep-backed memory: simplified to DB-backed storage
// Create with: CREATE TABLE shanks.agent_memories (id serial PRIMARY KEY, agent_id integer NOT NULL REFERENCES shanks.agents(id), project_id integer NOT NULL REFERENCES shanks.projects(id), round integer NOT NULL, memory_type text NOT NULL DEFAULT 'action_summary', content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
// CREATE INDEX idx_agent_memories_agent_project ON shanks.agent_memories(agent_id, project_id, round);
export const agentMemories = shanksSchema.table('agent_memories', {
	id: serial('id').primaryKey(),
	agentId: integer('agent_id')
		.references(() => agents.id)
		.notNull(),
	projectId: integer('project_id')
		.references(() => projects.id)
		.notNull(),
	round: integer('round').notNull(),
	memoryType: text('memory_type').default('action_summary').notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// MiroFish Stage 4: persisted prediction reports, one per project (upserted on each generate)
// Create with: CREATE TABLE shanks.reports (id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES shanks.projects(id), content text NOT NULL, stats jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
export const reports = shanksSchema.table('reports', {
	id: serial('id').primaryKey(),
	projectId: integer('project_id')
		.references(() => projects.id)
		.notNull(),
	content: text('content').notNull(),
	stats: jsonb('stats').default({}).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});
