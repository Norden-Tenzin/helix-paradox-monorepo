import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireUser, type AppEnv } from "../context";
import type { Db } from "../db";
import { characterMods, characters, characterTags, user } from "../db/schema";
import { deleteImages, imageUrl, MAX_GRID_IMAGES, putImage, toStoredValue, validateImage } from "../images";
import { MODS, type Character, type CharacterPage } from "../types";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

const listQuery = z.object({
  author: z.string().optional(),
  sex: z.enum(["male", "female"]).optional(),
  mods: z
    .string()
    .optional()
    .transform((v) => (v ? [...new Set(v.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean))] : [])),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

const characterFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  sex: z.enum(["male", "female"]),
  description: z.string().max(5000).default(""),
  dna: z.string().trim().min(1, "DNA is required").max(50_000),
  mods: z
    .array(z.enum(MODS))
    .min(1, "Select at least one mod")
    .transform((mods) => [...new Set(mods)])
    .refine((mods) => !mods.includes("vanilla") || mods.length === 1, "Vanilla can't be combined with other mods"),
});

const authorName = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`;

const characterColumns = {
  id: characters.id,
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
};

type CharacterRow = Omit<Character, "mods" | "tags">;

async function enrich(db: Db, rows: CharacterRow[]): Promise<Character[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [mods, tags] = await Promise.all([
    db.select().from(characterMods).where(inArray(characterMods.cid, ids)),
    db.select().from(characterTags).where(inArray(characterTags.cid, ids)),
  ]);
  return rows.map((r) => ({
    ...r,
    display_image: imageUrl(r.display_image),
    grid_images: r.grid_images.map(imageUrl),
    mods: mods.filter((m) => m.cid === r.id).map((m) => m.mod),
    tags: tags.filter((t) => t.cid === r.id).map((t) => t.tag),
  }));
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
    name: text("name"),
    sex: text("sex"),
    description: text("description") ?? "",
    dna: text("dna"),
    mods: form.getAll("mods").filter((m) => typeof m === "string").map((m) => m.toLowerCase()),
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
    const { author, sex, mods, q, sort, cursor, limit } = parsed.data;
    const db = c.var.db;

    const conditions: (SQL | undefined)[] = [];
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

    const order = sort === "oldest" ? asc : desc;
    const rows = await db
      .select(characterColumns)
      .from(characters)
      .innerJoin(user, eq(user.id, characters.authorId))
      .where(and(...conditions))
      .orderBy(order(characters.postedAt), order(characters.id))
      .limit(limit + 1)
      .offset(cursor);

    const hasMore = rows.length > limit;
    const body: CharacterPage = {
      page: await enrich(db, rows.slice(0, limit)),
      nextCursor: hasMore ? String(cursor + limit) : null,
    };
    return c.json(body);
  })

  .get("/:id", async (c) => {
    const row = await getCharacter(c.var.db, c.req.param("id"));
    if (!row) throw new HTTPException(404, { message: "Character not found" });
    const [character] = await enrich(c.var.db, [row]);
    return c.json(character);
  })

  .post("/", requireUser, async (c) => {
    const { fields, display, grid } = await readCharacterForm(c.req.raw);
    if (typeof display === "string") throw new HTTPException(400, { message: "Primary image must be a file" });

    const id = crypto.randomUUID();
    const images = await resolveImages(c.env.BUCKET, id, display, grid, new Set());
    const now = Date.now();
    try {
      await c.var.db.batch([
        c.var.db.insert(characters).values({
          id,
          name: fields.name,
          sex: fields.sex,
          description: fields.description,
          dna: fields.dna,
          authorId: c.var.user.id,
          postedAt: now,
          updatedAt: now,
          displayImage: images.displayImage,
          gridImages: images.gridImages,
        }),
        c.var.db.insert(characterMods).values(fields.mods.map((mod) => ({ cid: id, mod }))),
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

    const previous = [existing.displayImage, ...existing.gridImages];
    const images = await resolveImages(c.env.BUCKET, id, display, grid, new Set(previous));
    try {
      await c.var.db.batch([
        c.var.db
          .update(characters)
          .set({
            name: fields.name,
            sex: fields.sex,
            description: fields.description,
            dna: fields.dna,
            displayImage: images.displayImage,
            gridImages: images.gridImages,
            updatedAt: Date.now(),
          })
          .where(eq(characters.id, id)),
        c.var.db.delete(characterMods).where(eq(characterMods.cid, id)),
        c.var.db.insert(characterMods).values(fields.mods.map((mod) => ({ cid: id, mod }))),
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
    // Mods and tags are removed by ON DELETE CASCADE.
    await c.var.db.delete(characters).where(eq(characters.id, id));
    await deleteImages(c.env.BUCKET, [existing.displayImage, ...existing.gridImages]);
    return c.json({ success: true });
  });
