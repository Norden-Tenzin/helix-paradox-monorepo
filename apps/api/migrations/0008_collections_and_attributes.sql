CREATE TABLE `collection_characters` (
	`collection_id` text NOT NULL,
	`character_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `character_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_characters_character_idx` ON `collection_characters` (`character_id`);--> statement-breakpoint
CREATE INDEX `collection_characters_added_idx` ON `collection_characters` (`collection_id`,`added_at`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collections_user_updated_idx` ON `collections` (`user_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `characters` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `characters` ADD `build` integer;--> statement-breakpoint
ALTER TABLE `characters` ADD `age` text;