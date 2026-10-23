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
    name: text("name").notNull(),
    sex: text("sex", { enum: ["male", "female"] }).notNull(),
    description: text("description").notNull().default(""),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postedAt: integer("posted_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    dna: text("dna").notNull(),
    // R2 object key, or an absolute URL for legacy images.
    displayImage: text("display_image").notNull(),
    gridImages: text("grid_images", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [
    index("characters_author_posted_idx").on(t.authorId, t.postedAt),
    index("characters_posted_idx").on(t.postedAt),
  ],
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
