import { relations } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ==================== AUTH (Better Auth) ====================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ==================== APP ====================

export const characters = sqliteTable(
  "characters",
  {
    id: text("id").primaryKey(),
    game: text("game").notNull().default("ck3"),
    name: text("name").notNull(),
    sex: text("sex", { enum: ["male", "female"] }).notNull(),
    description: text("description").notNull().default(""),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postedAt: integer("posted_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    dna: text("dna").notNull(),
    // dnaFingerprint() of the DNA, to spot the same face shared twice. Null until backfilled.
    dnaHash: text("dna_hash"),
    // How many people favourited it. Always recounted from `favourites` when one is added or
    // removed (never nudged by ±1), so it can't drift.
    favouriteCount: integer("favourite_count").notNull().default(0),
    // R2 object key, or an absolute URL for legacy images.
    displayImage: text("display_image").notNull(),
    gridImages: text("grid_images", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [
    index("characters_author_posted_idx").on(t.authorId, t.postedAt),
    index("characters_posted_idx").on(t.postedAt),
    index("characters_game_posted_idx").on(t.game, t.postedAt),
    index("characters_game_dna_hash_idx").on(t.game, t.dnaHash),
  ],
);

// The mods a face can be made with, per game, including each game's base game (id "vanilla").
// `genes` is the mod's signature for guessing it from a DNA string (see guessMods in dna.ts):
// for the base game every gene it has, for a mod the genes only it adds. A mod named by an
// uploader starts "pending": shown on its characters, but not offered in filters until listed.
export const mods = sqliteTable(
  "mods",
  {
    game: text("game").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    genes: text("genes", { mode: "json" }).$type<string[]>().notNull().default([]),
    status: text("status", { enum: ["listed", "pending"] }).notNull().default("listed"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.game, t.id] })],
);

export const characterMods = sqliteTable(
  "character_mods",
  {
    cid: text("cid")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    mod: text("mod").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cid, t.mod] }), index("character_mods_mod_idx").on(t.mod)],
);

// Tags people put on their characters, per game. `id` is the tag's slug ("norse-saga"), which
// is what `character_tags.tag` stores; `name` is how it was first written ("Norse saga").
// `useCount` is recounted from `character_tags` whenever a character's tags change.
export const tags = sqliteTable(
  "tags",
  {
    game: text("game").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    useCount: integer("use_count").notNull().default(0),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.game, t.id] }), index("tags_game_use_idx").on(t.game, t.useCount)],
);

export const characterTags = sqliteTable(
  "character_tags",
  {
    cid: text("cid")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cid, t.tag] }), index("character_tags_tag_idx").on(t.tag)],
);

// One row per person per character they favourited, so favouriting twice is a no-op. Who
// favourited what is private: only the count is public.
export const favourites = sqliteTable(
  "favourites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.characterId] }),
    index("favourites_character_idx").on(t.characterId),
    index("favourites_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const charactersRelations = relations(characters, ({ one, many }) => ({
  author: one(user, { fields: [characters.authorId], references: [user.id] }),
  mods: many(characterMods),
  tags: many(characterTags),
}));

export const characterModsRelations = relations(characterMods, ({ one }) => ({
  character: one(characters, { fields: [characterMods.cid], references: [characters.id] }),
}));

export const characterTagsRelations = relations(characterTags, ({ one }) => ({
  character: one(characters, { fields: [characterTags.cid], references: [characters.id] }),
}));
