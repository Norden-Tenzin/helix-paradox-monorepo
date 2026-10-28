// Shapes returned by the API. Imported (type-only) by the web app.

import type { GameId } from "./games";

export type { GameId };
export type Sex = "male" | "female";
export type Sort = "newest" | "oldest";

/** A mod as shown to people. Pending mods were named by an uploader and aren't in filters yet. */
export interface Mod {
  id: string;
  name: string;
  pending: boolean;
}

export interface Character {
  id: string;
  game: GameId;
  name: string;
  sex: Sex;
  description: string;
  dna: string;
  author_id: string;
  author_name: string;
  posted_at: number;
  updated_at: number;
  /** Browser-ready URL (relative /api/images/... for R2 objects). */
  display_image: string;
  grid_images: string[];
  mods: Mod[];
  tags: string[];
  favourite_count: number;
  /** Whether the person asking has favourited it (always false when signed out). */
  favourited: boolean;
}

/** After favouriting or unfavouriting (PUT/DELETE /api/characters/:id/favourite). */
export interface FavouriteState {
  favourited: boolean;
  favourite_count: number;
}

export interface CharacterPage {
  page: Character[];
  /** Pass back as `cursor` to fetch the next page; null when there are no more results. */
  nextCursor: string | null;
  /** Number of characters matching the filters, across all pages. */
  total: number;
}

/** What the API reads from a DNA string before it's shared (POST /api/dna/inspect). */
export interface DnaReport {
  genes: number;
  /** Enough genes to be a whole face (MIN_GENES). */
  complete: boolean;
  /** Mods the DNA's genes point to, for the uploader to confirm. */
  suggestedMods: string[];
  /** Genes no known mod accounts for; if any, the face was likely made with a mod we don't list. */
  unknownGenes: string[];
  /** Characters already shared with exactly this DNA. */
  duplicates: { id: string; name: string }[];
}

export interface PublicUser {
  id: string;
  name: string;
  character_count: number;
}

export interface Me {
  id: string;
  name: string;
  email: string;
}
