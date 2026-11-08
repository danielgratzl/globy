CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`country` text NOT NULL,
	`regions` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `trips_start_idx` ON `trips` (`start_date`);--> statement-breakpoint
CREATE INDEX `trips_deleted_idx` ON `trips` (`deleted_at`);