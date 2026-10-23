// Shapes returned by the API. Imported (type-only) by the web app.

export type Sex = "male" | "female";
export type Sort = "newest" | "oldest";

export const MODS = ["epe", "cfp", "vanilla"] as const;
export type Mod = (typeof MODS)[number];

export interface Character {
  id: string;
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
  mods: string[];
  tags: string[];
}

export interface CharacterPage {
  page: Character[];
  /** Pass back as `cursor` to fetch the next page; null when there are no more results. */
  nextCursor: string | null;
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
