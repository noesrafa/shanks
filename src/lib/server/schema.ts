import { pgSchema, serial, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';

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
