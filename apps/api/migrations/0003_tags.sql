CREATE TABLE `tags` (
	`game` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`game`, `id`),
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tags_game_use_idx` ON `tags` (`game`,`use_count`);