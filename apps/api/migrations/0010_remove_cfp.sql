-- CFP adds no genes of its own, so it can't be read from a DNA string, and mods now come from
-- the DNA alone. No character used it when this ran; any that did would fall back to their
-- other mods.
DELETE FROM `character_mods` WHERE `mod` = 'cfp';--> statement-breakpoint
DELETE FROM `mods` WHERE `game` = 'ck3' AND `id` = 'cfp';
