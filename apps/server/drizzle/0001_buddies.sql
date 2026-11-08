CREATE TABLE `buddies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buddies_name_idx` ON `buddies` ("name" COLLATE NOCASE);--> statement-breakpoint
ALTER TABLE `trips` ADD `buddies` text DEFAULT '[]' NOT NULL;