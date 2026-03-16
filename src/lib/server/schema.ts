import { pgTable, pgSchema, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

const oasisMini = pgSchema('oasis_mini');

// Adapted from OASIS database.py: user table (user_id, name, bio)
// Simplified: we use interests instead of OASIS's full profile dict
export const users = oasisMini.table('users', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	bio: text('bio').notNull(),
	interests: text('interests').notNull()
});

// Adapted from OASIS database.py: post table (post_id, user_id, content, created_at)
export const posts = oasisMini.table('posts', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});
