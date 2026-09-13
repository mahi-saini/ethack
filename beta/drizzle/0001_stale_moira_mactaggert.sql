CREATE TABLE `research_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`flag_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_review_events_flag_created` ON `review_events` (`flag_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `review_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`dataset_id` text NOT NULL,
	`dataset_label` text NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`target_label` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`suggestion` text NOT NULL,
	`evidence_url` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_flags_reporter_created` ON `review_flags` (`reporter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_flags_status_updated` ON `review_flags` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `research_reviewer_roles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bootstrap_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_reviewer_roles_bootstrap_email_unique` ON `research_reviewer_roles` (`bootstrap_email`);--> statement-breakpoint
CREATE TABLE `saved_simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`dataset_id` text NOT NULL,
	`dataset_label` text NOT NULL,
	`config_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_simulations_owner_updated` ON `saved_simulations` (`owner_id`,`updated_at`);