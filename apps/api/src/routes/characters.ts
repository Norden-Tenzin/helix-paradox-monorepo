import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireUser, viewerId, type AppEnv } from "../context";
import type { Db } from "../db";
import { characterMods, characters, characterTags, favourites, mods, tags, user } from "../db/schema";
import { dnaFingerprint, guessMods, MIN_GENES, parseDna } from "../dna";
import { BASE_MOD, DEFAULT_GAME, GAME_IDS, type GameId } from "../games";
import { deleteImages, imageUrl, MAX_GRID_IMAGES, putImage, toStoredValue, validateImage } from "../images";
import { gameMods, namedMod, signatures } from "../mods";
import { recountTags, resolveTags } from "../tags";
import type { Character, CharacterPage, FavouriteState, Mod, Tag } from "../types";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

const listQuery = z.object({
  game: z.enum(GAME_IDS).optional(),
  author: z.string().optional(),
  sex: z.enum(["male", "female"]).optional(),
  mods: z
    .string()
    .optional()
    .transform((v) => (v ? [...new Set(v.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean))] : [])),
  /** Tag slugs, comma-separated: characters carrying all of them. */
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? [...new Set(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))] : [])),
  q: z.string().trim().max(100).optional(),
  /** "mine": the signed-in person's favourites, most recently favourited first. */
  favourites: z.literal("mine").optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

// Browsers send every line break in a multipart form as CRLF; store text as it was typed.
const normalizeNewlines = (s: string) => s.replace(/\r\n?/g, "\n");

const characterFields = z.object({
  game: z.enum(GAME_IDS).default(DEFAULT_GAME),
  name: z.string().trim().min(1, "Name is required").max(100),
  sex: z.enum(["male", "female"]),
  description: z.string().max(5000).default("").transform(normalizeNewlines),
  dna: z.string().transform(normalizeNewlines).pipe(z.string().trim().min(1, "DNA is required").max(50_000)),
  // Checked against the game's `mods` rows in resolveMods.
  mods: z.array(z.string().trim().toLowerCase().min(1).max(40)).transform((ids) => [...new Set(ids)]),
  /** A mod we don't list yet, named by the uploader because the DNA has genes we don't recognise. */
  newMod: z.string().trim().max(60).optional(),
  /** Tag names as typed; resolveTags cleans, dedupes and caps them. */
  tags: z.array(z.string().max(60)).max(20).default([]),
});

type CharacterFields = z.infer<typeof characterFields>;

const authorName = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`;

const characterColumns = {
  id: characters.id,
  game: characters.game,
  name: characters.name,
  sex: characters.sex,
  description: characters.description,
  dna: characters.dna,
  author_id: characters.authorId,
  author_name: authorName,
  posted_at: characters.postedAt,
  updated_at: characters.updatedAt,
  display_image: characters.displayImage,
  grid_images: characters.gridImages,
  favourite_count: characters.favouriteCount,
};

type CharacterRow = Omit<Character, "mods" | "tags" | "game" | "favourited"> & { game: string };

/** Adds mods, tags and, for a signed-in viewer, whether they favourited each one. */
async function enrich(db: Db, rows: CharacterRow[], viewer: string | null): Promise<Character[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [modRows, tagRows, mine] = await Promise.all([
    db
      .select({ cid: characterMods.cid, id: mods.id, name: mods.name, status: mods.status })
      .from(characterMods)
      .innerJoin(characters, eq(characters.id, characterMods.cid))
      .innerJoin(mods, and(eq(mods.game, characters.game), eq(mods.id, characterMods.mod)))
      .where(inArray(characterMods.cid, ids)),
    db
      .select({ cid: characterTags.cid, id: tags.id, name: tags.name })
      .from(characterTags)
      .innerJoin(characters, eq(characters.id, characterTags.cid))
      .innerJoin(tags, and(eq(tags.game, characters.game), eq(tags.id, characterTags.tag)))
      .where(inArray(characterTags.cid, ids)),
    viewer
      ? db
          .select({ id: favourites.characterId })
          .from(favourites)
          .where(and(eq(favourites.userId, viewer), inArray(favourites.characterId, ids)))
      : Promise.resolve([]),
  ]);
  const favourited = new Set(mine.map((f) => f.id));
  return rows.map((r) => ({
    ...r,
    game: r.game as GameId,
    display_image: imageUrl(r.display_image),
    grid_images: r.grid_images.map(imageUrl),
    mods: modRows
      .filter((m) => m.cid === r.id)
      .map((m): Mod => ({ id: m.id, name: m.name, pending: m.status === "pending" })),
    tags: tagRows.filter((t) => t.cid === r.id).map((t): Tag => ({ id: t.id, name: t.name })),
    favourited: favourited.has(r.id),
  }));
}

/** Recounts a character's favourites from the rows themselves, so the stored count can't drift. */
const recountFavourites = (db: Db, id: string) =>
  db
    .update(characters)
    .set({
      favouriteCount: sql`(select count(*) from ${favourites} where ${favourites.characterId} = ${id})`,
    })
    .where(eq(characters.id, id));

async function favouriteState(db: Db, id: string, userId: string): Promise<FavouriteState> {
  const [[row], [mine]] = await Promise.all([
    db.select({ count: characters.favouriteCount }).from(characters).where(eq(characters.id, id)),
    db
      .select({ id: favourites.characterId })
      .from(favourites)
      .where(and(eq(favourites.userId, userId), eq(favourites.characterId, id))),
  ]);
  return { favourited: !!mine, favourite_count: row?.count ?? 0 };
}

/**
 * Checks the DNA is a whole face and the chosen mods exist for its game, adding the uploader's
 * named mod (as pending) if they gave one. Returns the mods to store and the DNA's fingerprint.
 */
async function resolveDnaAndMods(db: Db, fields: CharacterFields, userId: string) {
  const genes = parseDna(fields.dna);
  if (genes.length < MIN_GENES) {
    throw new HTTPException(400, { message: "This DNA looks cut short. Copy the whole string from the game." });
  }

  const rows = await gameMods(db, fields.game);
  const unknown = fields.mods.filter((id) => !rows.some((m) => m.id === id));
  if (unknown.length > 0) throw new HTTPException(400, { message: `Unknown mod: ${unknown.join(", ")}` });

  const chosen = [...fields.mods];
  if (fields.newMod) {
    const { base, others } = signatures(rows);
    const { unknownGenes } = guessMods(genes, base, others);
    const id = await namedMod(db, fields.game, fields.newMod, unknownGenes, userId);
    if (!chosen.includes(id)) chosen.push(id);
  }
  if (chosen.length === 0) throw new HTTPException(400, { message: "Select at least one mod" });
  if (chosen.includes(BASE_MOD) && chosen.length > 1) {
    throw new HTTPException(400, { message: "Vanilla can't be combined with other mods" });
  }
  return { mods: chosen, dnaHash: await dnaFingerprint(fields.dna) };
}

async function getCharacter(db: Db, id: string) {
  const [row] = await db
    .select(characterColumns)
    .from(characters)
    .innerJoin(user, eq(user.id, characters.authorId))
    .where(eq(characters.id, id));
  return row;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => "\\" + ch);

/** Reads the multipart body: text fields, `display` (File | existing URL) and up to three `grid` entries. */
async function readCharacterForm(req: Request) {
  const form = await req.formData();
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = characterFields.safeParse({
    game: text("game"),
    name: text("name"),
    sex: text("sex"),
    description: text("description") ?? "",
    dna: text("dna"),
    mods: form.getAll("mods").filter((m) => typeof m === "string"),
    newMod: text("newMod") || undefined,
    tags: form.getAll("tags").filter((t) => typeof t === "string"),
  });
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  const display = form.get("display");
  const grid = form.getAll("grid");
  if (!display) throw new HTTPException(400, { message: "Primary image is required" });
  if (grid.length > MAX_GRID_IMAGES) {
    throw new HTTPException(400, { message: `At most ${MAX_GRID_IMAGES} gallery images` });
  }
  for (const entry of [display, ...grid]) {
    if (typeof entry !== "string") {
      const error = validateImage(entry);
      if (error) throw new HTTPException(400, { message: error });
    }
  }
  return { fields: parsed.data, display, grid };
}

/**
 * Uploads new files to R2 and maps references to existing images back to their stored values.
 * Strings are only accepted if they refer to an image the character already has.
 */
async function resolveImages(
  bucket: R2Bucket,
  characterId: string,
  display: File | string,
  grid: (File | string)[],
  existing: Set<string>,
) {
  const uploaded: string[] = [];
  const resolve = async (entry: File | string) => {
    if (typeof entry === "string") {
      const stored = toStoredValue(entry);
      if (!existing.has(stored)) throw new HTTPException(400, { message: "Unknown image reference" });
      return stored;
    }
    const key = await putImage(bucket, characterId, entry);
    uploaded.push(key);
    return key;
  };
  try {
    const displayImage = await resolve(display);
    const gridImages = await Promise.all(grid.map(resolve));
    return { displayImage, gridImages, uploaded };
  } catch (err) {
    await deleteImages(bucket, uploaded);
    throw err;
  }
}

async function getOwnedCharacter(db: Db, id: string, userId: string) {
  const [character] = await db.select().from(characters).where(eq(characters.id, id));
  if (!character) throw new HTTPException(404, { message: "Character not found" });
  if (character.authorId !== userId) throw new HTTPException(403, { message: "You do not own this character" });
  return character;
}

export const characterRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) throw new HTTPException(400, { message: "Invalid query" });
    const { game, author, sex, mods, tags: tagged, q, favourites: favouritesOf, sort, cursor, limit } = parsed.data;
    const db = c.var.db;
    const viewer = await viewerId(c);
    if (favouritesOf && !viewer) throw new HTTPException(401, { message: "Sign in to see your favourites" });

    const conditions: (SQL | undefined)[] = [];
    if (game) conditions.push(eq(characters.game, game));
    if (author) conditions.push(eq(characters.authorId, author));
    if (sex) conditions.push(eq(characters.sex, sex));
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      conditions.push(
        or(sql`${characters.name} like ${pattern} escape '\\'`, sql`${user.username} like ${pattern} escape '\\'`),
      );
    }
    if (mods.length > 0) {
      // Characters tagged with *all* requested mods.
      conditions.push(
        inArray(
          characters.id,
          db
            .select({ cid: characterMods.cid })
            .from(characterMods)
            .where(inArray(characterMods.mod, mods))
            .groupBy(characterMods.cid)
            .having(sql`count(*) = ${mods.length}`),
        ),
      );
    }

    if (tagged.length > 0) {
      // Characters carrying *all* requested tags.
      conditions.push(
        inArray(
          characters.id,
          db
            .select({ cid: characterTags.cid })
            .from(characterTags)
            .where(inArray(characterTags.tag, tagged))
            .groupBy(characterTags.cid)
            .having(sql`count(*) = ${tagged.length}`),
        ),
      );
    }

    const order = sort === "oldest" ? asc : desc;
    const where = and(...conditions);
    // Favourites list only the viewer's, ordered by when they favourited each one.
    const mine = and(eq(favourites.characterId, characters.id), eq(favourites.userId, viewer ?? ""));
    const rowsQuery = db.select(characterColumns).from(characters).innerJoin(user, eq(user.id, characters.authorId)).$dynamic();
    const totalQuery = db.select({ total: count() }).from(characters).innerJoin(user, eq(user.id, characters.authorId)).$dynamic();
    const [rows, [{ total }]] = await Promise.all([
      (favouritesOf ? rowsQuery.innerJoin(favourites, mine) : rowsQuery)
        .where(where)
        .orderBy(...(favouritesOf ? [desc(favourites.createdAt)] : []), order(characters.postedAt), order(characters.id))
        .limit(limit + 1)
        .offset(cursor),
      (favouritesOf ? totalQuery.innerJoin(favourites, mine) : totalQuery).where(where),
    ]);

    const hasMore = rows.length > limit;
    const body: CharacterPage = {
      page: await enrich(db, rows.slice(0, limit), viewer),
      nextCursor: hasMore ? String(cursor + limit) : null,
      total,
    };
    return c.json(body);
  })

  .get("/:id", async (c) => {
    const row = await getCharacter(c.var.db, c.req.param("id"));
    if (!row) throw new HTTPException(404, { message: "Character not found" });
    const [character] = await enrich(c.var.db, [row], await viewerId(c));
    return c.json(character);
  })

  // Favouriting is idempotent: doing it twice, or unfavouriting something you never favourited,
  // changes nothing. Each change and its recount run in one batch.
  .put("/:id/favourite", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const [exists] = await db.select({ id: characters.id }).from(characters).where(eq(characters.id, id));
    if (!exists) throw new HTTPException(404, { message: "Character not found" });
    await db.batch([
      db.insert(favourites).values({ userId: c.var.user.id, characterId: id, createdAt: Date.now() }).onConflictDoNothing(),
      recountFavourites(db, id),
    ]);
    return c.json(await favouriteState(db, id, c.var.user.id));
  })

  .delete("/:id/favourite", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    await db.batch([
      db.delete(favourites).where(and(eq(favourites.userId, c.var.user.id), eq(favourites.characterId, id))),
      recountFavourites(db, id),
    ]);
    return c.json(await favouriteState(db, id, c.var.user.id));
  })

  .post("/", requireUser, async (c) => {
    const { fields, display, grid } = await readCharacterForm(c.req.raw);
    if (typeof display === "string") throw new HTTPException(400, { message: "Primary image must be a file" });

    const id = crypto.randomUUID();
    const resolved = await resolveDnaAndMods(c.var.db, fields, c.var.user.id);
    const tagIds = await resolveTags(c.var.db, fields.game, fields.tags, c.var.user.id);
    const images = await resolveImages(c.env.BUCKET, id, display, grid, new Set());
    const now = Date.now();
    try {
      await c.var.db.batch([
        c.var.db.insert(characters).values({
          id,
          game: fields.game,
          name: fields.name,
          sex: fields.sex,
          description: fields.description,
          dna: fields.dna,
          dnaHash: resolved.dnaHash,
          authorId: c.var.user.id,
          postedAt: now,
          updatedAt: now,
          displayImage: images.displayImage,
          gridImages: images.gridImages,
        }),
        c.var.db.insert(characterMods).values(resolved.mods.map((mod) => ({ cid: id, mod }))),
        ...(tagIds.length > 0 ? [c.var.db.insert(characterTags).values(tagIds.map((tag) => ({ cid: id, tag })))] : []),
        recountTags(c.var.db, fields.game, tagIds),
      ]);
    } catch (err) {
      await deleteImages(c.env.BUCKET, images.uploaded);
      throw err;
    }
    return c.json({ id }, 201);
  })

  .patch("/:id", requireUser, async (c) => {
    const id = c.req.param("id");
    const existing = await getOwnedCharacter(c.var.db, id, c.var.user.id);
    const { fields, display, grid } = await readCharacterForm(c.req.raw);
    const resolved = await resolveDnaAndMods(c.var.db, fields, c.var.user.id);
    const tagIds = await resolveTags(c.var.db, fields.game, fields.tags, c.var.user.id);
    const oldTags = await c.var.db.select({ tag: characterTags.tag }).from(characterTags).where(eq(characterTags.cid, id));

    const previous = [existing.displayImage, ...existing.gridImages];
    const images = await resolveImages(c.env.BUCKET, id, display, grid, new Set(previous));
    try {
      await c.var.db.batch([
        c.var.db
          .update(characters)
          .set({
            game: fields.game,
            name: fields.name,
            sex: fields.sex,
            description: fields.description,
            dna: fields.dna,
            dnaHash: resolved.dnaHash,
            displayImage: images.displayImage,
            gridImages: images.gridImages,
            updatedAt: Date.now(),
          })
          .where(eq(characters.id, id)),
        c.var.db.delete(characterMods).where(eq(characterMods.cid, id)),
        c.var.db.insert(characterMods).values(resolved.mods.map((mod) => ({ cid: id, mod }))),
        c.var.db.delete(characterTags).where(eq(characterTags.cid, id)),
        ...(tagIds.length > 0 ? [c.var.db.insert(characterTags).values(tagIds.map((tag) => ({ cid: id, tag })))] : []),
        // Tags it lost, and tags it gained (also under its previous game, if that changed).
        recountTags(c.var.db, fields.game, [...new Set([...oldTags.map((t) => t.tag), ...tagIds])]),
        recountTags(c.var.db, existing.game, oldTags.map((t) => t.tag)),
      ]);
    } catch (err) {
      await deleteImages(c.env.BUCKET, images.uploaded);
      throw err;
    }

    // Only remove the images that are no longer referenced.
    const kept = new Set([images.displayImage, ...images.gridImages]);
    await deleteImages(
      c.env.BUCKET,
      previous.filter((img) => !kept.has(img)),
    );
    return c.json({ id });
  })

  .delete("/:id", requireUser, async (c) => {
    const id = c.req.param("id");
    const existing = await getOwnedCharacter(c.var.db, id, c.var.user.id);
    const oldTags = await c.var.db.select({ tag: characterTags.tag }).from(characterTags).where(eq(characterTags.cid, id));
    // Mods, tags and favourites go with it (ON DELETE CASCADE); then its tags are recounted.
    await c.var.db.batch([
      c.var.db.delete(characters).where(eq(characters.id, id)),
      recountTags(c.var.db, existing.game, oldTags.map((t) => t.tag)),
    ]);
    await deleteImages(c.env.BUCKET, [existing.displayImage, ...existing.gridImages]);
    return c.json({ success: true });
  });
