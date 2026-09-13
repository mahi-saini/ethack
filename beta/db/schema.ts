import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('research_workspaces', {
  ownerId: text('owner_id').primaryKey(),
  datasetId: text('dataset_id').notNull(),
  objectKey: text('object_key').notNull(),
  label: text('label').notNull(),
  bytes: integer('bytes').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const usage = sqliteTable('usage_windows', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const profiles=sqliteTable('research_profiles',{
 userId:text('user_id').primaryKey(),displayName:text('display_name').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const reviewerRoles=sqliteTable('research_reviewer_roles',{
 userId:text('user_id').primaryKey(),bootstrapEmail:text('bootstrap_email').notNull().unique(),createdAt:text('created_at').notNull(),
});
export const simulations=sqliteTable('saved_simulations',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),name:text('name').notNull(),datasetId:text('dataset_id').notNull(),datasetLabel:text('dataset_label').notNull(),config:text('config_json').notNull(),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('idx_simulations_owner_updated').on(t.ownerId,t.updatedAt)]);
export const reviewFlags=sqliteTable('review_flags',{
 id:text('id').primaryKey(),reporterId:text('reporter_id').notNull(),datasetId:text('dataset_id').notNull(),datasetLabel:text('dataset_label').notNull(),targetType:text('target_type').notNull(),targetKey:text('target_key').notNull(),targetLabel:text('target_label').notNull(),snapshot:text('snapshot_json').notNull(),reason:text('reason').notNull(),details:text('details').notNull(),suggestion:text('suggestion').notNull(),evidenceUrl:text('evidence_url').notNull(),status:text('status').notNull().default('open'),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('idx_flags_reporter_created').on(t.reporterId,t.createdAt),index('idx_flags_status_updated').on(t.status,t.updatedAt)]);
export const reviewEvents=sqliteTable('review_events',{
 id:text('id').primaryKey(),flagId:text('flag_id').notNull(),actorId:text('actor_id').notNull(),status:text('status').notNull(),note:text('note').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('idx_review_events_flag_created').on(t.flagId,t.createdAt)]);
