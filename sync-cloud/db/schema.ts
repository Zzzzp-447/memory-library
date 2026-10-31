import { integer, sqliteTable, text, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), salt: text('salt').notNull(),
  recoveryHash: text('recovery_hash').notNull(), createdAt: integer('created_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('session_user').on(table.userId)]);
export const limits = sqliteTable('rate_limits', {
  id: text('id').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull(),
});
export const assets = sqliteTable('assets', {
  userId: text('user_id').notNull().references(() => users.id), hash: text('hash').notNull(),
  size: integer('size').notNull(), mime: text('mime').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.hash] })]);
export const operations = sqliteTable('operations', {
  seq: integer('seq').primaryKey({ autoIncrement: true }), userId: text('user_id').notNull().references(() => users.id),
  opId: text('op_id').notNull(), kind: text('kind').notNull(), payload: text('payload').notNull(),
  clientAt: integer('client_at').notNull(), device: text('device').notNull(), hash: text('hash').notNull(),
}, table => [uniqueIndex('operation_identity').on(table.userId, table.opId), index('operation_cursor').on(table.userId, table.seq)]);
