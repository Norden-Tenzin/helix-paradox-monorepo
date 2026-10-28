ALTER TABLE `tags` ADD `merged_into` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;