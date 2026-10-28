CREATE TABLE `favourites` (
	`user_id` text NOT NULL,
	`character_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `character_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favourites_character_idx` ON `favourites` (`character_id`);--> statement-breakpoint
CREATE INDEX `favourites_user_created_idx` ON `favourites` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `characters` ADD `favourite_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Sign-up now requires confirming an email. Accounts made before that couldn't have, so they
-- count as confirmed rather than being locked out (one account at the time).
UPDATE `user` SET `email_verified` = 1 WHERE `email_verified` = 0;
