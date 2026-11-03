import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireUser, viewerId, type AppEnv } from "../context";
import type { Db } from "../db";
import { characters, collectionCharacters, collections, favourites, user } from "../db/schema";
import { imageUrl } from "../images";
import { visibleTo } from "../reports";
import type { Collection, CollectionChoice } from "../types";

/** Enough for anyone's dynasties; stops one account filling the database. */
const MAX_COLLECTIONS = 50;
const MAX_CHARACTERS = 500;
const COVERS = 4;
/** Collections listed on a character's page. */
const MAX_LISTED = 12;

const normalizeNewlines = (s: string) => s.replace(/\r\n?/g, "\n");

const collectionFields = z.object({
  name: z.string().trim().min(1, "Give the collection a name").max(60),
  description: z.string().max(1000).transform(normalizeNewlines).default(""),
  public: z.boolean().default(false),
});

const createBody = collectionFields.extend({
  /** A character to put in it straight away (from "Add to collection" on its page). */
  character: z.string().optional(),
});

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join(", ") });
  return parsed.data;
}

const ownerName = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`;

/**
 * Collections as shown in lists: how many characters the person asking can see in each, and the
 * portraits of the latest few. Hidden characters stay in a collection but aren't counted or
 * shown, except to their own author.
 */
async function summaries(db: Db, rows: { id: string }[], viewer: string | null): Promise<Collection[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [meta, counts, covers] = await Promise.all([
    db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        public: collections.public,
        owner_id: collections.userId,
        owner_name: ownerName,
        updated_at: collections.updatedAt,
      })
      .from(collections)
      .innerJoin(user, eq(user.id, collections.userId))
      .where(inArray(collections.id, ids)),
    db
      .select({ id: collectionCharacters.collectionId, count: count() })
      .from(collectionCharacters)
      .innerJoin(characters, eq(characters.id, collectionCharacters.characterId))
      .where(and(inArray(collectionCharacters.collectionId, ids), visibleTo(viewer)))
      .groupBy(collectionCharacters.collectionId),
    // The latest few per collection, numbered within each collection.
    db.all<{ id: string; image: string }>(sql`
      select "collection_id" as "id", "display_image" as "image" from (
        select cc."collection_id", c."display_image",
          row_number() over (partition by cc."collection_id" order by cc."added_at" desc) as n
        from "collection_characters" cc join "characters" c on c."id" = cc."character_id"
        where cc."collection_id" in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
          and (c."hidden_at" is null or c."author_id" = ${viewer ?? ""})
      ) where n <= ${COVERS}`),
  ]);
  const byId = new Map(meta.map((m) => [m.id, m]));
  return ids.flatMap((id) => {
    const m = byId.get(id);
    if (!m) return [];
    return [
      {
        ...m,
        count: counts.find((c) => c.id === id)?.count ?? 0,
        covers: covers.filter((c) => c.id === id).map((c) => imageUrl(c.image)),
      },
    ];
  });
}

/** The collection, if the person asking may see it (it's public, or theirs). */
async function findVisible(db: Db, id: string, viewer: string | null) {
  const [found] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, id), or(eq(collections.public, true), eq(collections.userId, viewer ?? ""))));
  if (!found) throw new HTTPException(404, { message: "Collection not found" });
  return found;
}

async function findOwned(db: Db, id: string, userId: string) {
  const [found] = await db.select().from(collections).where(eq(collections.id, id));
  if (!found) throw new HTTPException(404, { message: "Collection not found" });
  if (found.userId !== userId) throw new HTTPException(403, { message: "This isn't your collection" });
  return found;
}

/**
 * Puts a character in a collection, favouriting it too (collections hold favourites), as one
 * batch. Doing it twice changes nothing.
 */
async function addCharacter(db: Db, collectionId: string, characterId: string, userId: string) {
  const [target] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.id, characterId), visibleTo(userId)));
  if (!target) throw new HTTPException(404, { message: "Character not found" });
  const [{ size }] = await db
    .select({ size: count() })
    .from(collectionCharacters)
    .where(eq(collectionCharacters.collectionId, collectionId));
  if (size >= MAX_CHARACTERS) throw new HTTPException(400, { message: `A collection holds at most ${MAX_CHARACTERS} characters` });

  const now = Date.now();
  return [
    db.insert(favourites).values({ userId, characterId, createdAt: now }).onConflictDoNothing(),
    db
      .update(characters)
      .set({ favouriteCount: sql`(select count(*) from ${favourites} where ${favourites.characterId} = ${characterId})` })
      .where(eq(characters.id, characterId)),
    db.insert(collectionCharacters).values({ collectionId, characterId, addedAt: now }).onConflictDoNothing(),
    db.update(collections).set({ updatedAt: now }).where(eq(collections.id, collectionId)),
  ] as const;
}

export const collectionRoutes = new Hono<AppEnv>()
  // Someone's collections, most recently changed first: the public ones, or all of your own.
  // With `character` instead, the public collections that character is in (for its page).
  .get("/", async (c) => {
    const owner = c.req.query("user");
    const character = c.req.query("character");
    const viewer = await viewerId(c);
    if (character) {
      const rows = await c.var.db
        .select({ id: collections.id })
        .from(collections)
        .innerJoin(collectionCharacters, eq(collectionCharacters.collectionId, collections.id))
        .where(and(eq(collectionCharacters.characterId, character), eq(collections.public, true)))
        .orderBy(desc(collections.updatedAt))
        .limit(MAX_LISTED);
      return c.json(await summaries(c.var.db, rows, viewer));
    }
    if (!owner) throw new HTTPException(400, { message: "Say whose collections, or which character's" });
    const rows = await c.var.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.userId, owner), owner === viewer ? undefined : eq(collections.public, true)))
      .orderBy(desc(collections.updatedAt));
    return c.json(await summaries(c.var.db, rows, viewer));
  })

  // Your collections, each saying whether it holds `character`: the "Add to collection" menu.
  .get("/mine", requireUser, async (c) => {
    const character = c.req.query("character") ?? "";
    const rows = await c.var.db
      .select({
        id: collections.id,
        name: collections.name,
        has: sql<number>`exists (select 1 from "collection_characters" where "collection_characters"."collection_id" = "collections"."id" and "collection_characters"."character_id" = ${character})`,
      })
      .from(collections)
      .where(eq(collections.userId, c.var.user.id))
      .orderBy(desc(collections.updatedAt));
    return c.json(rows.map((r): CollectionChoice => ({ ...r, has: !!r.has })));
  })

  .post("/", requireUser, async (c) => {
    const fields = parse(createBody, await c.req.json().catch(() => null));
    const db = c.var.db;
    const [{ owned }] = await db.select({ owned: count() }).from(collections).where(eq(collections.userId, c.var.user.id));
    if (owned >= MAX_COLLECTIONS) throw new HTTPException(400, { message: `You can have at most ${MAX_COLLECTIONS} collections` });

    const id = crypto.randomUUID();
    const now = Date.now();
    const create = db.insert(collections).values({
      id,
      userId: c.var.user.id,
      name: fields.name,
      description: fields.description,
      public: fields.public,
      createdAt: now,
      updatedAt: now,
    });
    if (fields.character) await db.batch([create, ...(await addCharacter(db, id, fields.character, c.var.user.id))]);
    else await create;
    return c.json({ id }, 201);
  })

  .get("/:id", async (c) => {
    const viewer = await viewerId(c);
    const found = await findVisible(c.var.db, c.req.param("id"), viewer);
    const [collection] = await summaries(c.var.db, [found], viewer);
    return c.json(collection);
  })

  .patch("/:id", requireUser, async (c) => {
    const id = c.req.param("id");
    await findOwned(c.var.db, id, c.var.user.id);
    const fields = parse(collectionFields, await c.req.json().catch(() => null));
    await c.var.db.update(collections).set(fields).where(eq(collections.id, id));
    return c.json({ id });
  })

  // The characters stay favourited; only the list goes.
  .delete("/:id", requireUser, async (c) => {
    const id = c.req.param("id");
    await findOwned(c.var.db, id, c.var.user.id);
    await c.var.db.delete(collections).where(eq(collections.id, id));
    return c.json({ success: true });
  })

  .put("/:id/characters/:cid", requireUser, async (c) => {
    const id = c.req.param("id");
    await findOwned(c.var.db, id, c.var.user.id);
    await c.var.db.batch(await addCharacter(c.var.db, id, c.req.param("cid"), c.var.user.id));
    return c.json({ added: true });
  })

  // Takes it out of this collection only; it stays favourited.
  .delete("/:id/characters/:cid", requireUser, async (c) => {
    const id = c.req.param("id");
    await findOwned(c.var.db, id, c.var.user.id);
    await c.var.db
      .delete(collectionCharacters)
      .where(and(eq(collectionCharacters.collectionId, id), eq(collectionCharacters.characterId, c.req.param("cid"))));
    return c.json({ added: false });
  });
