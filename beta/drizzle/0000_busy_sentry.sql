CREATE TABLE `usage_windows` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`dataset_id` text NOT NULL,
	`object_key` text NOT NULL,
	`label` text NOT NULL,
	`bytes` integer NOT NULL,
	`updated_at` text NOT NULL
);
