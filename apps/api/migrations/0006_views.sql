CREATE TABLE `character_views` (
	`character_id` text NOT NULL,
	`viewer` text NOT NULL,
	`day` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`character_id`, `viewer`, `day`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_views_day_idx` ON `character_views` (`day`);--> statement-breakpoint
ALTER TABLE `characters` ADD `view_count` integer DEFAULT 0 NOT NULL;