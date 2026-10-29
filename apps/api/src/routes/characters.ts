import { and, asc, between, count, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { AGES, BUILD_RANGES, BUILDS, bodyMeasures, buildBand, HEIGHT_RANGES, HEIGHTS, heightBand, type Age } from "../attributes";
import { requireUser, viewer as whoIsAsking, viewerId, type AppEnv } from "../context";
import type { Db } from "../db";
import { characterMods, characters, characterTags, collectionCharacters, collections, favourites, reports, user } from "../db/schema";
import { dnaFingerprint, faceDistance, faceFeatures, guessMods, MIN_GENES, parseDna } from "../dna";
import { BASE_MOD, DEFAULT_GAME, GAME_IDS, type GameId } from "../games";
import { deleteImages, imageUrl, MAX_GRID_IMAGES, putImage, toStoredValue, validateImage } from "../images";
import { gameMods, namedMod, signatures } from "../mods";
import { hideIfReportedEnough, visibleTo } from "../reports";
import { recountTags, resolveTags } from "../tags";
import { recordView } from "../views";
import { REPORT_REASONS, type Character, type CharacterPage, type FavouriteState, type Mod, type ReportReason, type Tag } from "../types";

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
  /** A collection's characters, most recently added first. */
  collection: z.string().optional(),
  height: z.enum(HEIGHTS).optional(),
  build: z.enum(BUILDS).optional(),
  age: z.enum(AGES).optional(),
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
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
  age: z.enum(AGES).optional(),
  dna: z.string().transform(normalizeNewlines).pipe(z.string().trim().min(1, "DNA is required").max(50_000)),
  // Checked against the game's `mods` rows in resolveMods.
  mods: z.array(z.string().trim().toLowerCase().min(1).max(40)).transform((ids) => [...new Set(ids)]),
  /** A mod we don't list yet, named by the uploader because the DNA has genes we don't recognise. */
  newMod: z.string().trim().max(60).optional(),
  /** Tag names as typed; resolveTags cleans, dedupes and caps them. */
  tags: z.array(z.string().max(60)).max(20).default([]),
});

type CharacterFields = z.infer<typeof characterFields>;

const reportBody = z
  .object({
    reason: z.enum(REPORT_REASONS),
    note: z.string().trim().max(500).default(""),
  })
  .refine((r) => r.reason !== "other" || r.note.length > 0, "Say what's wrong");

const authorName = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`;

/**
 * Everything a Character needs, in one query: its mods and tags as JSON, and for a signed-in
 * viewer whether they favourited or reported it, plus (on their own characters) the reasons of
 * its open reports. One round trip matters: D1 can be far from the worker. (Names written out
 * in full: drizzle leaves columns unqualified inside correlated subqueries.)
 */
export const characterColumns = (viewer: string | null) => ({
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
  height: characters.height,
  build: characters.build,
  age: characters.age,
  favourite_count: characters.favouriteCount,
  hidden_at: characters.hiddenAt,
  mods_json: sql<string>`(select json_group_array(json_object('id', "mods"."id", 'name', "mods"."name", 'pending', "mods"."status" = 'pending'))
    from "character_mods" join "mods" on "mods"."game" = "characters"."game" and "mods"."id" = "character_mods"."mod"
    where "character_mods"."cid" = "characters"."id")`,
  tags_json: sql<string>`(select json_group_array(json_object('id', "tags"."id", 'name', "tags"."name"))
    from "character_tags" join "tags" on "tags"."game" = "characters"."game" and "tags"."id" = "character_tags"."tag"
    where "character_tags"."cid" = "characters"."id")`,
  favourited: sql<number>`exists (select 1 from "favourites" where "favourites"."character_id" = "characters"."id" and "favourites"."user_id" = ${viewer ?? ""})`,
  reported: sql<number>`exists (select 1 from "reports" where "reports"."character_id" = "characters"."id" and "reports"."reporter_id" = ${viewer ?? ""} and "reports"."status" = 'open')`,
  // One entry per open report; counted by reason in toCharacters.
  open_report_reasons: sql<string>`(select json_group_array("reports"."reason") from "reports"
    where "reports"."character_id" = "characters"."id" and "reports"."status" = 'open' and "characters"."author_id" = ${viewer ?? ""})`,
});

type CharacterRow = Omit<
  Character,
  "mods" | "tags" | "game" | "height" | "build" | "age" | "favourited" | "hidden" | "reported" | "open_reports"
> & {
  game: string;
  height: number | null;
  build: number | null;
  age: Age | null;
  hidden_at: number | null;
  mods_json: string;
  tags_json: string;
  favourited: number;
  reported: number;
  open_report_reasons: string;
};

/** Shapes rows selected with characterColumns into what the API returns. */
export function toCharacters(rows: CharacterRow[]): Character[] {
  return rows.map(({ mods_json, tags_json, open_report_reasons, ...r }) => {
    const reasons: ReportReason[] = JSON.parse(open_report_reasons);
    return {
      ...r,
      game: r.game as GameId,
      height: heightBand(r.height),
      build: buildBand(r.build),
      display_image: imageUrl(r.display_image),
      grid_images: r.grid_images.map(imageUrl),
      mods: (JSON.parse(mods_json) as { id: string; name: string; pending: number }[]).map(
        (m): Mod => ({ id: m.id, name: m.name, pending: !!m.pending }),
      ),
      tags: JSON.parse(tags_json) as Tag[],
      favourited: !!r.favourited,
      hidden: r.hidden_at !== null,
      reported: !!r.reported,
      open_reports: [...new Set(reasons)].map((reason) => ({ reason, count: reasons.filter((x) => x === reason).length })),
    };
  });
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
  return {
    mods: chosen,
    dnaHash: await dnaFingerprint(fields.dna),
    features: faceFeatures(fields.dna),
    ...bodyMeasures(genes),
  };
}

async function getCharacter(db: Db, id: string, viewer: string | null) {
  const [row] = await db
    .select(characterColumns(viewer))
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
    age: text("age") || undefined,
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
    const { game, author, sex, height, build, age, mods, tags: tagged, q, favourites: favouritesOf, collection, sort, cursor, limit } =
      parsed.data;
    const db = c.var.db;
    const viewer = await viewerId(c);
    if (favouritesOf && !viewer) throw new HTTPException(401, { message: "Sign in to see your favourites" });
    // Checked alongside the listing below, rather than first, to save a round trip.
    const collectionVisible = collection
      ? db
          .select({ id: collections.id })
          .from(collections)
          .where(and(eq(collections.id, collection), or(eq(collections.public, true), eq(collections.userId, viewer ?? ""))))
          .then((found) => found.length > 0)
      : Promise.resolve(true);

    const conditions: (SQL | undefined)[] = [visibleTo(viewer)];
    if (game) conditions.push(eq(characters.game, game));
    if (author) conditions.push(eq(characters.authorId, author));
    if (sex) conditions.push(eq(characters.sex, sex));
    if (height) conditions.push(between(characters.height, ...HEIGHT_RANGES[height]));
    if (build) conditions.push(between(characters.build, ...BUILD_RANGES[build]));
    if (age) conditions.push(eq(characters.age, age));
    if (q) {
      // A character's name, its author, or the name of one of its tags or mods. (Subqueries
      // spell out table names: drizzle leaves columns unqualified inside them.)
      const pattern = `%${escapeLike(q)}%`;
      conditions.push(
        or(
          sql`${characters.name} like ${pattern} escape '\\'`,
          sql`${user.username} like ${pattern} escape '\\'`,
          sql`exists (select 1 from "character_tags" join "tags" on "tags"."game" = "characters"."game" and "tags"."id" = "character_tags"."tag"
            where "character_tags"."cid" = "characters"."id" and "tags"."name" like ${pattern} escape '\\')`,
          sql`exists (select 1 from "character_mods" join "mods" on "mods"."game" = "characters"."game" and "mods"."id" = "character_mods"."mod"
            where "character_mods"."cid" = "characters"."id" and "mods"."name" like ${pattern} escape '\\')`,
        ),
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
    // Popular: most favourited this week first, so new characters people like can climb above
    // old ones with big totals; then all-time favourites. (Names written out in full: drizzle
    // leaves columns unqualified inside correlated subqueries.)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const popularFirst =
      sort === "popular"
        ? [
            desc(sql`(select count(*) from "favourites" where "favourites"."character_id" = "characters"."id" and "favourites"."created_at" > ${weekAgo})`),
            desc(characters.favouriteCount),
          ]
        : [];
    const where = and(...conditions);
    // Favourites list only the viewer's, ordered by when they favourited each one; a collection,
    // by when each was added to it.
    const mine = and(eq(favourites.characterId, characters.id), eq(favourites.userId, viewer ?? ""));
    const inCollection = and(eq(collectionCharacters.characterId, characters.id), eq(collectionCharacters.collectionId, collection ?? ""));
    const rowsQuery = db.select(characterColumns(viewer)).from(characters).innerJoin(user, eq(user.id, characters.authorId)).$dynamic();
    const totalQuery = db.select({ total: count() }).from(characters).innerJoin(user, eq(user.id, characters.authorId)).$dynamic();
    // (Joins on a dynamic query change it in place.)
    if (favouritesOf) [rowsQuery, totalQuery].forEach((query) => query.innerJoin(favourites, mine));
    else if (collection) [rowsQuery, totalQuery].forEach((query) => query.innerJoin(collectionCharacters, inCollection));
    const [rows, [{ total }], visible] = await Promise.all([
      rowsQuery
        .where(where)
        .orderBy(
          ...(favouritesOf ? [desc(favourites.createdAt)] : []),
          ...(collection ? [desc(collectionCharacters.addedAt)] : []),
          ...popularFirst,
          order(characters.postedAt),
          order(characters.id),
        )
        .limit(limit + 1)
        .offset(cursor),
      totalQuery.where(where),
      collectionVisible,
    ]);
    if (!visible) throw new HTTPException(404, { message: "Collection not found" });

    const hasMore = rows.length > limit;
    const body: CharacterPage = {
      page: toCharacters(rows.slice(0, limit)),
      nextCursor: hasMore ? String(cursor + limit) : null,
      total,
    };
    return c.json(body);
  })

  // A visible character picked at random, for the Random button.
  .get("/random", async (c) => {
    const game = z.enum(GAME_IDS).default(DEFAULT_GAME).catch(DEFAULT_GAME).parse(c.req.query("game"));
    const [pick] = await c.var.db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.game, game), isNull(characters.hiddenAt)))
      .orderBy(sql`random()`)
      .limit(1);
    if (!pick) throw new HTTPException(404, { message: "The library is empty" });
    return c.json(pick);
  })

  .get("/:id", async (c) => {
    const asking = await whoIsAsking(c);
    const row = await getCharacter(c.var.db, c.req.param("id"), asking?.id ?? null);
    // A hidden character is "not found" to anyone but its owner and admins reviewing it.
    if (!row || (row.hidden_at !== null && row.author_id !== asking?.id && !asking?.admin)) {
      throw new HTTPException(404, { message: "Character not found" });
    }
    return c.json(toCharacters([row])[0]);
  })

  // Favouriting is idempotent: doing it twice, or unfavouriting something you never favourited,
  // changes nothing. Each change and its recount run in one batch.
  .put("/:id/favourite", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const [exists] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.id, id), visibleTo(c.var.user.id)));
    if (!exists) throw new HTTPException(404, { message: "Character not found" });
    await db.batch([
      db.insert(favourites).values({ userId: c.var.user.id, characterId: id, createdAt: Date.now() }).onConflictDoNothing(),
      recountFavourites(db, id),
    ]);
    return c.json(await favouriteState(db, id, c.var.user.id));
  })

  // "More like this": the visible characters from the same game whose faces are closest. Compared
  // in the worker against every candidate's stored features, which is fine for a library of
  // thousands; past that, a vector index (Cloudflare Vectorize) does the same job.
  .get("/:id/similar", async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const asking = await whoIsAsking(c);
    const limit = Math.min(12, Math.max(1, Number(c.req.query("limit")) || 5));
    // The target and the candidates in one go: candidates are the same game as the target.
    const [[target], candidates] = await Promise.all([
      db
        .select({ features: characters.features })
        .from(characters)
        .where(and(eq(characters.id, id), visibleTo(asking?.id ?? null))),
      db
        .select({ id: characters.id, features: characters.features })
        .from(characters)
        .where(
          and(
            sql`"characters"."game" = (select "game" from "characters" where "id" = ${id})`,
            isNull(characters.hiddenAt),
            ne(characters.id, id),
            isNotNull(characters.features),
          ),
        ),
    ]);
    if (!target) throw new HTTPException(404, { message: "Character not found" });
    if (!target.features) return c.json([] satisfies Character[]);
    const nearest = candidates
      .map((cand) => ({ id: cand.id, distance: faceDistance(target.features!, cand.features!) }))
      .filter((cand) => Number.isFinite(cand.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
    if (nearest.length === 0) return c.json([] satisfies Character[]);

    const rows = await db
      .select(characterColumns(asking?.id ?? null))
      .from(characters)
      .innerJoin(user, eq(user.id, characters.authorId))
      .where(inArray(characters.id, nearest.map((n) => n.id)));
    const order = new Map(nearest.map((n, i) => [n.id, i]));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return c.json(toCharacters(rows));
  })

  // The character page calls this once it has loaded in a browser, so server-side page loads,
  // prefetching and link previews don't count. Not shown anywhere yet.
  .post("/:id/view", async (c) => {
    const id = c.req.param("id");
    const asking = await whoIsAsking(c);
    const [exists] = await c.var.db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.id, id), visibleTo(asking?.id ?? null)));
    if (!exists) throw new HTTPException(404, { message: "Character not found" });
    await recordView(c.var.db, c.env.BETTER_AUTH_SECRET, id, c.req.raw, asking?.id ?? null);
    return c.body(null, 204);
  })

  // One report per person per character; reporting again replaces the reason. Enough open
  // reports hide the character until someone reviews them (reports.ts).
  .post("/:id/report", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const parsed = reportBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join(", ") });
    const [target] = await db
      .select({ authorId: characters.authorId })
      .from(characters)
      .where(and(eq(characters.id, id), visibleTo(c.var.user.id)));
    if (!target) throw new HTTPException(404, { message: "Character not found" });
    if (target.authorId === c.var.user.id) throw new HTTPException(400, { message: "You can't report your own character" });

    const report = { reason: parsed.data.reason, note: parsed.data.note, status: "open" as const, createdAt: Date.now() };
    await db
      .insert(reports)
      .values({ characterId: id, reporterId: c.var.user.id, ...report })
      .onConflictDoUpdate({ target: [reports.characterId, reports.reporterId], set: { ...report, reviewedBy: null, reviewedAt: null } });
    await hideIfReportedEnough(db, id);
    return c.json({ reported: true });
  })

  // Unfavouriting also takes it out of your collections: they only ever hold your favourites.
  .delete("/:id/favourite", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    await db.batch([
      db.delete(favourites).where(and(eq(favourites.userId, c.var.user.id), eq(favourites.characterId, id))),
      db
        .delete(collectionCharacters)
        .where(
          and(
            eq(collectionCharacters.characterId, id),
            inArray(
              collectionCharacters.collectionId,
              db.select({ id: collections.id }).from(collections).where(eq(collections.userId, c.var.user.id)),
            ),
          ),
        ),
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
          features: resolved.features,
          height: resolved.height,
          build: resolved.build,
          age: fields.age ?? null,
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
            features: resolved.features,
            height: resolved.height,
            build: resolved.build,
            age: fields.age ?? null,
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
