CREATE TABLE `mods` (
	`game` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`genes` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'listed' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`game`, `id`),
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `characters` ADD `game` text DEFAULT 'ck3' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `dna_hash` text;--> statement-breakpoint
CREATE INDEX `characters_game_posted_idx` ON `characters` (`game`,`posted_at`);--> statement-breakpoint
CREATE INDEX `characters_game_dna_hash_idx` ON `characters` (`game`,`dna_hash`);--> statement-breakpoint
-- Crusader Kings III's mods. Signatures come from the library's own uploads on 2026-10-28:
-- vanilla is every gene of an older-format export plus "clothes" (a gene in newer exports);
-- EPE is the 26 genes newer exports add; 24 of them default to templates named "vanilla_*",
-- as a mod's genes do. Game patches also add genes, so check these against EPE's files.
-- CFP has no signature yet (no CFP export seen), so it is only picked by hand.
INSERT INTO `mods` (`game`, `id`, `name`, `genes`, `status`, `created_by`, `created_at`) VALUES
('ck3', 'vanilla', 'Vanilla', '["hair_color","skin_color","eye_color","gene_chin_forward","gene_chin_height","gene_chin_width","gene_eye_angle","gene_eye_depth","gene_eye_height","gene_eye_distance","gene_eye_shut","gene_forehead_angle","gene_forehead_brow_height","gene_forehead_roundness","gene_forehead_width","gene_forehead_height","gene_head_height","gene_head_width","gene_head_profile","gene_head_top_height","gene_head_top_width","gene_jaw_angle","gene_jaw_forward","gene_jaw_height","gene_jaw_width","gene_mouth_corner_depth","gene_mouth_corner_height","gene_mouth_forward","gene_mouth_height","gene_mouth_width","gene_mouth_upper_lip_size","gene_mouth_lower_lip_size","gene_mouth_open","gene_neck_length","gene_neck_width","gene_bs_cheek_forward","gene_bs_cheek_height","gene_bs_cheek_width","gene_bs_ear_angle","gene_bs_ear_inner_shape","gene_bs_ear_bend","gene_bs_ear_outward","gene_bs_ear_size","gene_bs_eye_corner_depth","gene_bs_eye_fold_shape","gene_bs_eye_size","gene_bs_eye_upper_lid_size","gene_bs_forehead_brow_curve","gene_bs_forehead_brow_forward","gene_bs_forehead_brow_inner_height","gene_bs_forehead_brow_outer_height","gene_bs_forehead_brow_width","gene_bs_jaw_def","gene_bs_mouth_lower_lip_def","gene_bs_mouth_lower_lip_full","gene_bs_mouth_lower_lip_pad","gene_bs_mouth_lower_lip_width","gene_bs_mouth_philtrum_def","gene_bs_mouth_philtrum_shape","gene_bs_mouth_philtrum_width","gene_bs_mouth_upper_lip_def","gene_bs_mouth_upper_lip_full","gene_bs_mouth_upper_lip_profile","gene_bs_mouth_upper_lip_width","gene_bs_nose_forward","gene_bs_nose_height","gene_bs_nose_length","gene_bs_nose_nostril_height","gene_bs_nose_nostril_width","gene_bs_nose_profile","gene_bs_nose_ridge_angle","gene_bs_nose_ridge_width","gene_bs_nose_size","gene_bs_nose_tip_angle","gene_bs_nose_tip_forward","gene_bs_nose_tip_width","face_detail_cheek_def","face_detail_cheek_fat","face_detail_chin_cleft","face_detail_chin_def","face_detail_eye_lower_lid_def","face_detail_eye_socket","face_detail_nasolabial","face_detail_nose_ridge_def","face_detail_nose_tip_def","face_detail_temple_def","expression_brow_wrinkles","expression_eye_wrinkles","expression_forehead_wrinkles","expression_other","complexion","gene_height","gene_bs_body_type","gene_bs_body_shape","gene_bs_bust","gene_age","gene_eyebrows_shape","gene_eyebrows_fullness","gene_body_hair","gene_hair_type","gene_baldness","eye_accessory","teeth_accessory","eyelashes_accessory","beards","hairstyles","clothes"]', 'listed', NULL, 1793145600000),
('ck3', 'epe', 'EPE', '["skin_color_saturation","eye_color_saturation","gene_bs_eye_height_inside","gene_bs_eye_height_outisde","gene_bs_ear_lobe","gene_bs_nose_central_width","gene_bs_nose_septum_width","gene_bs_mouth_lower_lip_profile","gene_bs_eye_outer_width","gene_bs_head_asymmetry_1","gene_bs_eye_fold_2","gene_bs_mouth_center_curve","gene_bs_eyebrow_straight","gene_bs_head_round_shape","gene_bs_nose_septum_height","gene_bs_head_lower_height","gene_bs_nose_flared_nostril","gene_bs_mouth_upper_lip_forward","gene_bs_mouth_lower_lip_forward","gene_bs_nose_swollen","gene_bs_ears_fantasy","gene_bs_mouth_glamour_lips","face_detail_eye_upper_lid_def","gene_eyebrow_inner_width","gene_bs_eye_lower_lid_size","gene_bs_eye_shape"]', 'listed', NULL, 1793145600000),
('ck3', 'cfp', 'CFP', '[]', 'listed', NULL, 1793145600000);
