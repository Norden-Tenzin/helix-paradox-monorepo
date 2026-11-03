import { and, asc, between, count, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { BUILD_RANGES, BUILDS, bodyMeasures, buildBand, HEIGHT_RANGES, HEIGHTS, heightBand } from "../attributes";
import { requireUser, viewer as whoIsAsking, viewerId, type AppEnv } from "../context";
import type { Db } from "../db";
import { characterMods, characters, characterTags, collectionCharacters, collections, confirmations, favourites, mods as modsTable, reports, user } from "../db/schema";
import { dnaFingerprint, dnaSex, faceDistance, faceFeatures, guessMods, MIN_GENES, parseDna } from "../dna";
import { BASE_MOD, DEFAULT_GAME, GAME_IDS, type GameId } from "../games";
import { deleteImages, imagesOf, imageUrl, MAX_GRID_IMAGES, prepareImage, putImage, toStoredValue, type PreparedImage } from "../images";
import { gameMods, namedMod, signatures } from "../mods";
import { hideIfReportedEnough, notifyAdminsOfReport, visibleTo } from "../reports";
import { recountTags, resolveTags } from "../tags";
import { recordView } from "../views";
import {
  REPORT_REASONS,
  type Character,
  type CharacterDetail,
  type CharacterPage,
  type ConfirmState,
  type FavouriteState,
  type Mod,
  type ModNeed,
  type ReportReason,
  type Tag,
} from "../types";

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
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

// Browsers send every line break in a multipart form as CRLF; store text as it was typed.
const normalizeNewlines = (s: string) => s.replace(/\r\n?/g, "\n");

const characterFields = z.object({
  game: z.enum(GAME_IDS).default(DEFAULT_GAME),
  name: z.string().trim().min(1, "Name is required").max(100),
  /** Only needed when the DNA doesn't say (older exports); the DNA wins when it does. */
  sex: z.enum(["male", "female"]).optional(),
  description: z.string().max(5000).default("").transform(normalizeNewlines),
  dna: z.string().transform(normalizeNewlines).pipe(z.string().trim().min(1, "DNA is required").max(50_000)),
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
  thumb_image: characters.thumbImage,
  grid_images: characters.gridImages,
  height: characters.height,
  build: characters.build,
  favourite_count: characters.favouriteCount,
  confirm_count: characters.confirmCount,
  hidden_at: characters.hiddenAt,
  mods_json: sql<string>`(select json_group_array(json_object('id', "mods"."id", 'name', "mods"."name", 'pending', "mods"."status" = 'pending', 'url', "mods"."url"))
    from "character_mods" join "mods" on "mods"."game" = "characters"."game" and "mods"."id" = "character_mods"."mod"
    where "character_mods"."cid" = "characters"."id")`,
  tags_json: sql<string>`(select json_group_array(json_object('id', "tags"."id", 'name', "tags"."name"))
    from "character_tags" join "tags" on "tags"."game" = "characters"."game" and "tags"."id" = "character_tags"."tag"
    where "character_tags"."cid" = "characters"."id")`,
  favourited: sql<number>`exists (select 1 from "favourites" where "favourites"."character_id" = "characters"."id" and "favourites"."user_id" = ${viewer ?? ""})`,
  confirmed: sql<number>`exists (select 1 from "confirmations" where "confirmations"."character_id" = "characters"."id" and "confirmations"."user_id" = ${viewer ?? ""})`,
  reported: sql<number>`exists (select 1 from "reports" where "reports"."character_id" = "characters"."id" and "reports"."reporter_id" = ${viewer ?? ""} and "reports"."status" = 'open')`,
  // One entry per open report; counted by reason in toCharacters.
  open_report_reasons: sql<string>`(select json_group_array("reports"."reason") from "reports"
    where "reports"."character_id" = "characters"."id" and "reports"."status" = 'open' and "characters"."author_id" = ${viewer ?? ""})`,
});

type CharacterRow = Omit<
  Character,
  "mods" | "tags" | "game" | "height" | "build" | "favourited" | "confirmed" | "hidden" | "reported" | "open_reports" | "thumb_image"
> & {
  thumb_image: string | null;
  game: string;
  height: number | null;
  build: number | null;
  hidden_at: number | null;
  mods_json: string;
  tags_json: string;
  favourited: number;
  confirmed: number;
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
      thumb_image: imageUrl(r.thumb_image ?? r.display_image),
      grid_images: r.grid_images.map(imageUrl),
      mods: (JSON.parse(mods_json) as { id: string; name: string; pending: number; url: string | null }[]).map(
        (m): Mod => ({ id: m.id, name: m.name, pending: !!m.pending, url: m.url }),
      ),
      tags: JSON.parse(tags_json) as Tag[],
      favourited: !!r.favourited,
      confirmed: !!r.confirmed,
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
 * Checks the DNA is a whole face and works out what's stored from it: the sex (the DNA's own,
 * else the uploader's), the mods, the fingerprint, and the face's features and measurements.
 *
 * Mods come from the DNA alone: the ones whose own genes it carries, or the base game. Genes no
 * known mod accounts for mean a mod we don't know, which the uploader must name (it's added as
 * pending, with those genes as its signature). `kept` is an edited character's current DNA and
 * mods: if the DNA hasn't changed, its mods stay as they are, since older exports made with a mod
 * can lack that mod's genes and would otherwise turn into the base game.
 */
async function resolveDna(db: Db, fields: CharacterFields, userId: string, kept?: { dna: string; mods: string[] }) {
  const genes = parseDna(fields.dna);
  if (genes.length < MIN_GENES) {
    throw new HTTPException(400, { message: "This DNA looks cut short. Copy the whole string from the game." });
  }
  const sex = dnaSex(fields.dna) ?? fields.sex;
  if (!sex) throw new HTTPException(400, { message: "This DNA doesn't say their sex. Choose female or male." });

  let chosen: string[];
  if (kept && kept.dna === fields.dna && kept.mods.length > 0) chosen = kept.mods;
  else {
    const { base, others } = signatures(await gameMods(db, fields.game));
    const guess = guessMods(genes, base, others);
    chosen = guess.mods;
    if (guess.unknownGenes.length > 0) {
      if (!fields.newMod) {
        throw new HTTPException(400, { message: "This DNA has genes from a mod we don't know yet. Say which mod you used." });
      }
      chosen = [...chosen, await namedMod(db, fields.game, fields.newMod, guess.unknownGenes, userId)];
    }
  }
  return {
    sex,
    mods: [...new Set(chosen)],
    dnaHash: await dnaFingerprint(fields.dna),
    features: faceFeatures(fields.dna),
    ...bodyMeasures(genes),
  };
}

/** Recounts a character's "works in my game" confirmations from the rows themselves. */
const recountConfirmations = (db: Db, id: string) =>
  db
    .update(characters)
    .set({
      confirmCount: sql`(select count(*) from ${confirmations} where ${confirmations.characterId} = ${id})`,
    })
    .where(eq(characters.id, id));

async function confirmState(db: Db, id: string, userId: string): Promise<ConfirmState> {
  const [[row], [mine]] = await Promise.all([
    db.select({ count: characters.confirmCount }).from(characters).where(eq(characters.id, id)),
    db
      .select({ id: confirmations.characterId })
      .from(confirmations)
      .where(and(eq(confirmations.userId, userId), eq(confirmations.characterId, id))),
  ]);
  return { confirmed: !!mine, confirm_count: row?.count ?? 0 };
}

/**
 * The mods a character needs installed (not the base game), each with how many of its DNA's
 * genes come from that mod: the game ignores those without it.
 */
async function modNeeds(db: Db, character: Character): Promise<ModNeed[]> {
  const needed = character.mods.filter((m) => m.id !== BASE_MOD);
  if (needed.length === 0) return [];
  const rows = await db
    .select({ id: modsTable.id, genes: modsTable.genes })
    .from(modsTable)
    .where(and(eq(modsTable.game, character.game), inArray(modsTable.id, needed.map((m) => m.id))));
  const names = new Set(parseDna(character.dna).map((g) => g.name));
  return needed.map((m) => ({
    ...m,
    genes: rows.find((r) => r.id === m.id)?.genes.filter((g) => names.has(g)).length ?? 0,
  }));
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
    sex: text("sex") || undefined,
    description: text("description") ?? "",
    dna: text("dna"),
    newMod: text("newMod") || undefined,
    tags: form.getAll("tags").filter((t) => typeof t === "string"),
  });
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  const rawDisplay = form.get("display");
  const rawGrid = form.getAll("grid");
  if (!rawDisplay) throw new HTTPException(400, { message: "Primary image is required" });
  if (rawGrid.length > MAX_GRID_IMAGES) {
    throw new HTTPException(400, { message: `At most ${MAX_GRID_IMAGES} gallery images` });
  }
  // New files are checked by their bytes and stripped of metadata; strings refer to images the
  // character already has.
  const prepare = async (entry: File | string): Promise<PreparedImage | string> => {
    if (typeof entry === "string") return entry;
    const image = await prepareImage(entry);
    if (typeof image === "string") throw new HTTPException(400, { message: image });
    return image;
  };
  const display = await prepare(rawDisplay);
  const grid = await Promise.all(rawGrid.map(prepare));
  // The upload page sends a small copy of a new portrait for cards (thumb_image). Only with a new
  // portrait file: a kept portrait keeps its thumbnail.
  const rawThumb = form.get("displayThumb");
  const thumb = typeof display !== "string" && rawThumb && typeof rawThumb !== "string" ? await prepare(rawThumb) : null;
  return { fields: parsed.data, display, thumb: thumb as PreparedImage | null, grid };
}

/**
 * Uploads new files to R2 and maps references to existing images back to their stored values.
 * Strings are only accepted if they refer to an image the character already has.
 */
async function resolveImages(
  bucket: R2Bucket,
  characterId: string,
  display: PreparedImage | string,
  thumb: PreparedImage | null,
  grid: (PreparedImage | string)[],
  existing: Set<string>,
) {
  const uploaded: string[] = [];
  const resolve = async (entry: PreparedImage | string) => {
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
    const thumbImage = thumb ? await resolve(thumb) : null;
    const gridImages = await Promise.all(grid.map(resolve));
    return { displayImage, thumbImage, gridImages, uploaded };
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
    const { game, author, sex, height, build, mods, tags: tagged, q, favourites: favouritesOf, collection, sort, cursor, limit } =
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
    // Popular: most favourites and "works in my game" this week first, so new characters people
    // like can climb above old ones with big totals; then all-time totals. (Names written out in
    // full: drizzle leaves columns unqualified inside correlated subqueries.)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const popularFirst =
      sort === "popular"
        ? [
            desc(sql`(select count(*) from "favourites" where "favourites"."character_id" = "characters"."id" and "favourites"."created_at" > ${weekAgo})
              + (select count(*) from "confirmations" where "confirmations"."character_id" = "characters"."id" and "confirmations"."created_at" > ${weekAgo})`),
            desc(sql`${characters.favouriteCount} + ${characters.confirmCount}`),
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
    const character = toCharacters([row])[0];
    const body: CharacterDetail = { ...character, needs: await modNeeds(c.var.db, character) };
    return c.json(body);
  })

  // "Works in my game ✓", for anyone but its author. Idempotent, like favouriting.
  .put("/:id/works", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const [target] = await db
      .select({ authorId: characters.authorId })
      .from(characters)
      .where(and(eq(characters.id, id), visibleTo(c.var.user.id)));
    if (!target) throw new HTTPException(404, { message: "Character not found" });
    if (target.authorId === c.var.user.id) {
      throw new HTTPException(400, { message: "Only other people can say your character works for them" });
    }
    await db.batch([
      db.insert(confirmations).values({ userId: c.var.user.id, characterId: id, createdAt: Date.now() }).onConflictDoNothing(),
      recountConfirmations(db, id),
    ]);
    return c.json(await confirmState(db, id, c.var.user.id));
  })

  .delete("/:id/works", requireUser, async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    await db.batch([
      db.delete(confirmations).where(and(eq(confirmations.userId, c.var.user.id), eq(confirmations.characterId, id))),
      recountConfirmations(db, id),
    ]);
    return c.json(await confirmState(db, id, c.var.user.id));
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
      .select({ authorId: characters.authorId, name: characters.name })
      .from(characters)
      .where(and(eq(characters.id, id), visibleTo(c.var.user.id)));
    if (!target) throw new HTTPException(404, { message: "Character not found" });
    if (target.authorId === c.var.user.id) throw new HTTPException(400, { message: "You can't report your own character" });

    const report = { reason: parsed.data.reason, note: parsed.data.note, status: "open" as const, createdAt: Date.now() };
    await db
      .insert(reports)
      .values({ characterId: id, reporterId: c.var.user.id, ...report })
      .onConflictDoUpdate({ target: [reports.characterId, reports.reporterId], set: { ...report, reviewedBy: null, reviewedAt: null } });
    const { open, hidden } = await hideIfReportedEnough(db, id);
    // After the response, so the reporter doesn't wait on email.
    c.executionCtx.waitUntil(
      notifyAdminsOfReport(c.env, db, { characterId: id, characterName: target.name, ...parsed.data, open, hidden }),
    );
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
    const { fields, display, thumb, grid } = await readCharacterForm(c.req.raw);
    if (typeof display === "string") throw new HTTPException(400, { message: "Primary image must be a file" });

    const id = crypto.randomUUID();
    const resolved = await resolveDna(c.var.db, fields, c.var.user.id);
    const tagIds = await resolveTags(c.var.db, fields.game, fields.tags, c.var.user.id);
    const images = await resolveImages(c.env.BUCKET, id, display, thumb, grid, new Set());
    const now = Date.now();
    try {
      await c.var.db.batch([
        c.var.db.insert(characters).values({
          id,
          game: fields.game,
          name: fields.name,
          sex: resolved.sex,
          description: fields.description,
          dna: fields.dna,
          dnaHash: resolved.dnaHash,
          features: resolved.features,
          height: resolved.height,
          build: resolved.build,
          authorId: c.var.user.id,
          postedAt: now,
          updatedAt: now,
          displayImage: images.displayImage,
          thumbImage: images.thumbImage,
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
    const { fields, display, thumb, grid } = await readCharacterForm(c.req.raw);
    const currentMods = await c.var.db.select({ mod: characterMods.mod }).from(characterMods).where(eq(characterMods.cid, id));
    const resolved = await resolveDna(c.var.db, fields, c.var.user.id, {
      dna: existing.dna,
      mods: currentMods.map((m) => m.mod),
    });
    const tagIds = await resolveTags(c.var.db, fields.game, fields.tags, c.var.user.id);
    const oldTags = await c.var.db.select({ tag: characterTags.tag }).from(characterTags).where(eq(characterTags.cid, id));

    const previous = imagesOf(existing);
    const images = await resolveImages(c.env.BUCKET, id, display, thumb, grid, new Set(previous));
    // Same portrait as before: keep its thumbnail. A different one (a new file without a
    // thumbnail, or a gallery picture moved up) shows in full until it has one.
    const thumbImage =
      images.thumbImage ?? (images.displayImage === existing.displayImage ? existing.thumbImage : null);
    try {
      await c.var.db.batch([
        c.var.db
          .update(characters)
          .set({
            game: fields.game,
            name: fields.name,
            sex: resolved.sex,
            description: fields.description,
            dna: fields.dna,
            dnaHash: resolved.dnaHash,
            features: resolved.features,
            height: resolved.height,
            build: resolved.build,
            displayImage: images.displayImage,
            thumbImage,
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
        // People confirmed the old DNA, so a new one starts over.
        ...(fields.dna === existing.dna
          ? []
          : [c.var.db.delete(confirmations).where(eq(confirmations.characterId, id)), recountConfirmations(c.var.db, id)]),
      ]);
    } catch (err) {
      await deleteImages(c.env.BUCKET, images.uploaded);
      throw err;
    }

    // Only remove the images that are no longer referenced.
    const kept = new Set([images.displayImage, thumbImage, ...images.gridImages]);
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
    await deleteImages(c.env.BUCKET, imagesOf(existing));
    return c.json({ success: true });
  });
