// Shapes returned by the API. Imported (type-only) by the web app.

import type { Build, Height } from "./attributes";
import type { GameId } from "./games";

export type { Build, GameId, Height };
export type Sex = "male" | "female";
export type Sort = "newest" | "oldest" | "popular";

/** Why someone reports a character. */
export const REPORT_REASONS = ["broken_dna", "wrong_mods", "duplicate", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** A mod as shown to people. Pending mods were named by an uploader and aren't in filters yet. */
export interface Mod {
  id: string;
  name: string;
  pending: boolean;
  /** Where to get it (a Steam Workshop page, say), if an admin has added one. */
  url: string | null;
}

/** A mod a character needs, on its page: where to get it, and how many of its DNA's genes only that mod has. */
export interface ModNeed extends Mod {
  /** The DNA's genes from this mod, which the game ignores without it. */
  genes: number;
}

/** A tag as it appears on a character; `id` is its slug, used in URLs and filters. */
export interface Tag {
  id: string;
  name: string;
}

/** A tag with how many characters use it (GET /api/tags). */
export interface TagSummary extends Tag {
  count: number;
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
  /** A small copy of display_image for cards; the same URL as display_image when there isn't one. */
  thumb_image: string;
  grid_images: string[];
  mods: Mod[];
  tags: Tag[];
  /** Bands of the DNA's gene_height and gene_bs_body_type; null when the DNA lacks the gene. */
  height: Height | null;
  build: Build | null;
  favourite_count: number;
  /** Whether the person asking has favourited it (always false when signed out). */
  favourited: boolean;
  /** How many people said it works in their game. */
  confirm_count: number;
  /** Whether the person asking said it works in their game. */
  confirmed: boolean;
  /** Hidden after several reports, until reviewed. Only its owner (and admins) still see it. */
  hidden: boolean;
  /** Whether the person asking has an open report on it. */
  reported: boolean;
  /** For its owner only: open reports by reason (never who sent them). Empty for everyone else. */
  open_reports: { reason: ReportReason; count: number }[];
}

/** One character on its own page (GET /api/characters/:id). */
export interface CharacterDetail extends Character {
  /** Mods other than the base game that its DNA needs, to install before pasting it. */
  needs: ModNeed[];
}

/** After saying it works, or taking that back (PUT/DELETE /api/characters/:id/works). */
export interface ConfirmState {
  confirmed: boolean;
  confirm_count: number;
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

/** Why Discover showed a character: chance, or closeness to one of your favourites. */
export type DiscoverReason = { kind: "random" } | { kind: "like"; id: string; name: string };

/** A batch of the Discover feed (POST /api/discover). */
export interface DiscoverPage {
  picks: { character: Character; reason: DiscoverReason }[];
  /** False once every visible character has been shown. */
  more: boolean;
}

/** A named list of someone's favourites (routes/collections.ts). */
export interface Collection {
  id: string;
  name: string;
  description: string;
  public: boolean;
  owner_id: string;
  owner_name: string;
  /** Characters in it that the person asking can see. */
  count: number;
  /** Portraits of the most recently added, up to four. */
  covers: string[];
  updated_at: number;
}

/** One of your collections, and whether a given character is in it (for "Add to collection"). */
export interface CollectionChoice {
  id: string;
  name: string;
  has: boolean;
}

export interface PublicUser {
  id: string;
  name: string;
  character_count: number;
  /** Public collections, or all of them on your own profile. */
  collection_count: number;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  admin: boolean;
}

// ---- Admin pages (routes/admin.ts) ----

/** A character with open reports, and those reports, for review. */
export interface ReportedCharacter {
  character: {
    id: string;
    name: string;
    author_id: string;
    author_name: string;
    author_banned: boolean;
    display_image: string;
    hidden: boolean;
  };
  reports: { reason: ReportReason; note: string; reporter_name: string; created_at: number }[];
}

export type ReviewAction = "dismiss" | "hide" | "delete";

export interface AdminMod {
  id: string;
  name: string;
  pending: boolean;
  url: string | null;
  /** How many genes identify it (0: it can only be picked by hand). */
  signature_genes: number;
  characters: number;
  created_by: string | null;
}

export interface AdminTag extends TagSummary {
  /** Set once merged: the tag it now stands for. */
  merged_into: string | null;
}
