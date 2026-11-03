CREATE TABLE `confirmations` (
	`user_id` text NOT NULL,
	`character_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `character_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `confirmations_character_idx` ON `confirmations` (`character_id`);--> statement-breakpoint
ALTER TABLE `characters` ADD `confirm_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mods` ADD `url` text;--> statement-breakpoint
-- EPE's Steam Workshop page (item 2507209632). Other mods get theirs from the admin page.
UPDATE `mods` SET `url` = 'https://steamcommunity.com/sharedfiles/filedetails/?id=2507209632' WHERE `game` = 'ck3' AND `id` = 'epe';
