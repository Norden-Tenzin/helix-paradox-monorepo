import { and, asc, count, eq, isNull, max, ne } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { characterMods, characters, collectionCharacters, collections, mods, user } from "../db/schema";
import { BASE_MOD } from "../games";

/**
 * What the site's sitemap lists (apps/web/src/routes/sitemap.xml): every visible character, the
 * people who shared them, public collections with something visible in them, and a library page
 * per mod. Characters come in pages of CHARACTERS_PER_SITEMAP, since one sitemap file may list at
 * most 50,000 URLs.
 */
export const CHARACTERS_PER_SITEMAP = 45_000;

const visible = isNull(characters.hiddenAt);

export const sitemapRoutes = new Hono<AppEnv>()
  // How many character sitemaps there are.
  .get("/", async (c) => {
    const [{ n }] = await c.var.db.select({ n: count() }).from(characters).where(visible);
    return c.json({ character_pages: Math.max(1, Math.ceil(n / CHARACTERS_PER_SITEMAP)) });
  })

  // One page of characters, oldest first so pages stay stable as new ones arrive.
  .get("/characters/:page", async (c) => {
    const page = Math.max(0, Number.parseInt(c.req.param("page"), 10) || 0);
    const rows = await c.var.db
      .select({ id: characters.id, updated_at: characters.updatedAt })
      .from(characters)
      .where(visible)
      .orderBy(asc(characters.postedAt), asc(characters.id))
      .limit(CHARACTERS_PER_SITEMAP)
      .offset(page * CHARACTERS_PER_SITEMAP);
    return c.json(rows);
  })

  // Everything else: profiles, public collections and per-mod library pages.
  .get("/pages", async (c) => {
    const db = c.var.db;
    const [users, lists, modPages] = await Promise.all([
      db
        .select({ id: user.id, updated_at: max(characters.updatedAt) })
        .from(user)
        .innerJoin(characters, and(eq(characters.authorId, user.id), visible))
        .where(isNull(user.bannedAt))
        .groupBy(user.id),
      db
        .select({ id: collections.id, updated_at: collections.updatedAt })
        .from(collections)
        .innerJoin(collectionCharacters, eq(collectionCharacters.collectionId, collections.id))
        .innerJoin(characters, and(eq(characters.id, collectionCharacters.characterId), visible))
        .where(eq(collections.public, true))
        .groupBy(collections.id),
      db
        .select({ id: mods.id, updated_at: max(characters.updatedAt) })
        .from(mods)
        .innerJoin(characterMods, eq(characterMods.mod, mods.id))
        .innerJoin(characters, and(eq(characters.id, characterMods.cid), eq(characters.game, mods.game), visible))
        .where(and(eq(mods.status, "listed"), ne(mods.id, BASE_MOD)))
        .groupBy(mods.id),
    ]);
    return c.json({ users, collections: lists, mods: modPages });
  });
