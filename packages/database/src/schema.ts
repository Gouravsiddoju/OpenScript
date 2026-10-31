import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  schemaVersion: integer('schema_version').default(2).notNull(),
  contentJson: jsonb('content_json').notNull(),
  revisionNumber: integer('revision_number').default(1).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documentRevisions = pgTable('document_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  revisionNumber: integer('revision_number').notNull(),
  contentSnapshot: jsonb('content_snapshot').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reason: text('reason'),
}, (table) => ({
  docRevUnique: uniqueIndex('doc_rev_unique_idx').on(table.documentId, table.revisionNumber),
}));

export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('co-writer').notNull(), // 'owner' | 'co-writer' | 'commenter' | 'reader'
  invitedBy: uuid('invited_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  projectUserUnique: uniqueIndex('project_member_unique_idx').on(table.projectId, table.userId),
}));

export const scriptNotes = pgTable('script_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  blockId: uuid('block_id').notNull(),
  authorId: uuid('author_id').references(() => users.id),
  authorName: text('author_name').notNull(),
  authorColor: text('author_color').default('#eab308').notNull(),
  category: text('category').default('general').notNull(),
  content: text('content').notNull(),
  isResolved: boolean('is_resolved').default(false).notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const scriptNoteReplies = pgTable('script_note_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => scriptNotes.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id),
  authorName: text('author_name').notNull(),
  authorColor: text('author_color').default('#3b82f6').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
