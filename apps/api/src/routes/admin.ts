import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { displayName, requireAdmin, type AppEnv } from "../context";
import { characterMods, characters, characterTags, mods, reports, session, tags, user } from "../db/schema";
import { DEFAULT_GAME, GAME_IDS } from "../games";
import { deleteImages, imagesOf, imageUrl } from "../images";
import { deleteCharactersOf } from "../accounts";
import { setHidden } from "../reports";
import { recountTags, tagSlug } from "../tags";
import type { AdminMod, AdminTag, ReportedCharacter, ReportReason } from "../types";

const gameQuery = z.object({ game: z.enum(GAME_IDS).default(DEFAULT_GAME), q: z.string().max(60).default("") });

// Everything here is for admins only: reviewing reports, and looking after mods and tags.
export const adminRoutes = new Hono<AppEnv>()
  .use(requireAdmin)

  // Characters with open reports, most-reported first, then oldest report first.
  .get("/reports", async (c) => {
    const db = c.var.db;
    const open = await db
      .select({
        characterId: reports.characterId,
        reason: reports.reason,
        note: reports.note,
        createdAt: reports.createdAt,
        reporter: user,
      })
      .from(reports)
      .innerJoin(user, eq(user.id, reports.reporterId))
      .where(eq(reports.status, "open"))
      .orderBy(asc(reports.createdAt));
    const ids = [...new Set(open.map((r) => r.characterId))];
    if (ids.length === 0) return c.json([] satisfies ReportedCharacter[]);

    const rows = await db
      .select({ character: characters, author: user })
      .from(characters)
      .innerJoin(user, eq(user.id, characters.authorId))
      .where(inArray(characters.id, ids));
    const body: ReportedCharacter[] = rows
      .map(({ character, author }) => ({
        character: {
          id: character.id,
          name: character.name,
          author_id: author.id,
          author_name: displayName(author),
          author_banned: author.bannedAt !== null,
          display_image: imageUrl(character.thumbImage ?? character.displayImage),
          hidden: character.hiddenAt !== null,
        },
        reports: open
          .filter((r) => r.characterId === character.id)
          .map((r) => ({
            reason: r.reason as ReportReason,
            note: r.note,
            reporter_name: displayName(r.reporter),
            created_at: r.createdAt,
          })),
      }))
      .sort((a, b) => b.reports.length - a.reports.length || a.reports[0].created_at - b.reports[0].created_at);
    return c.json(body);
  })

  // dismiss: the reports were wrong, show the character again.
  // hide:    the reports were right, keep it hidden (its owner can still see and fix it).
  // delete:  remove it for good, pictures and all.
  .post("/characters/:id/review", async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const parsed = z.object({ action: z.enum(["dismiss", "hide", "delete"]) }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HTTPException(400, { message: "Send { action: dismiss | hide | delete }" });
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    if (!character) throw new HTTPException(404, { message: "Character not found" });
    const { action } = parsed.data;

    if (action === "delete") {
      const tagged = await db.select({ tag: characterTags.tag }).from(characterTags).where(eq(characterTags.cid, id));
      await db.batch([
        db.delete(characters).where(eq(characters.id, id)),
        recountTags(db, character.game, tagged.map((t) => t.tag)),
      ]);
      await deleteImages(c.env.BUCKET, imagesOf(character));
      return c.json({ deleted: true });
    }

    await db
      .update(reports)
      .set({ status: action === "dismiss" ? "dismissed" : "upheld", reviewedBy: c.var.user.id, reviewedAt: Date.now() })
      .where(and(eq(reports.characterId, id), eq(reports.status, "open")));
    await setHidden(db, id, action === "hide");
    return c.json({ hidden: action === "hide" });
  })

  // Bans an account: it can't sign in or change anything any more (auth.ts, requireUser), it's
  // signed out everywhere, and its characters are hidden, or deleted with their pictures when
  // remove is true. Open reports on its characters are marked upheld.
  .post("/users/:id/ban", async (c) => {
    const id = c.req.param("id");
    const db = c.var.db;
    const parsed = z.object({ remove: z.boolean().default(false) }).safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: "Send { remove?: boolean }" });
    const [target] = await db.select({ role: user.role }).from(user).where(eq(user.id, id));
    if (!target) throw new HTTPException(404, { message: "User not found" });
    if (target.role === "admin") throw new HTTPException(400, { message: "Admins can't be banned" });

    const owned = await db.select().from(characters).where(eq(characters.authorId, id));
    const ids = owned.map((ch) => ch.id);
    await db.batch([
      db.update(user).set({ bannedAt: Date.now() }).where(eq(user.id, id)),
      db.delete(session).where(eq(session.userId, id)),
      ...(ids.length > 0
        ? [
            db
              .update(reports)
              .set({ status: "upheld", reviewedBy: c.var.user.id, reviewedAt: Date.now() })
              .where(and(inArray(reports.characterId, ids), eq(reports.status, "open"))),
          ]
        : []),
    ]);

    if (parsed.data.remove) {
      await deleteCharactersOf(db, c.env.BUCKET, id);
    } else {
      for (const character of owned) await setHidden(db, character.id, true);
    }
    return c.json({ banned: true, characters: owned.length, removed: parsed.data.remove });
  })

  // Lets a banned account sign in again. Its characters stay hidden: show them one by one from
  // the reports list, or the owner can ask.
  .post("/users/:id/unban", async (c) => {
    const result = await c.var.db
      .update(user)
      .set({ bannedAt: null })
      .where(eq(user.id, c.req.param("id")))
      .returning({ id: user.id });
    if (result.length === 0) throw new HTTPException(404, { message: "User not found" });
    return c.json({ banned: false });
  })

  // Every mod for a game, pending ones (named by uploaders) first.
  .get("/mods", async (c) => {
    const { game } = gameQuery.parse(c.req.query());
    const db = c.var.db;
    const [rows, uses] = await Promise.all([
      db
        .select({ mod: mods, creator: user })
        .from(mods)
        .leftJoin(user, eq(user.id, mods.createdBy))
        .where(eq(mods.game, game))
        .orderBy(desc(sql`${mods.status} = 'pending'`), asc(mods.name)),
      db
        .select({ mod: characterMods.mod, n: count() })
        .from(characterMods)
        .innerJoin(characters, eq(characters.id, characterMods.cid))
        .where(eq(characters.game, game))
        .groupBy(characterMods.mod),
    ]);
    const body: AdminMod[] = rows.map(({ mod, creator }) => ({
      id: mod.id,
      name: mod.name,
      pending: mod.status === "pending",
      url: mod.url,
      signature_genes: mod.genes.length,
      characters: uses.find((u) => u.mod === mod.id)?.n ?? 0,
      created_by: creator ? displayName(creator) : null,
    }));
    return c.json(body);
  })

  // List or unlist a mod, fix its name, or set where to get it (null or "" removes the link).
  .patch("/mods/:id", async (c) => {
    const parsed = z
      .object({
        game: z.enum(GAME_IDS).default(DEFAULT_GAME),
        name: z.string().trim().min(1).max(60).optional(),
        listed: z.boolean().optional(),
        url: z
          .union([z.literal(""), z.null(), z.url({ protocol: /^https?$/ }).max(500)])
          .optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HTTPException(400, { message: "Send { name?, listed?, url? } (url must be an http(s) link)" });
    const { game, name, listed, url } = parsed.data;
    const result = await c.var.db
      .update(mods)
      .set({
        ...(name ? { name } : {}),
        ...(listed === undefined ? {} : { status: listed ? "listed" : "pending" }),
        ...(url === undefined ? {} : { url: url || null }),
      })
      .where(and(eq(mods.game, game), eq(mods.id, c.req.param("id"))))
      .returning({ id: mods.id });
    if (result.length === 0) throw new HTTPException(404, { message: "Mod not found" });
    return c.json({ ok: true });
  })

  // Tags in use (and ones merged away), most-used first.
  .get("/tags", async (c) => {
    const { game, q } = gameQuery.parse(c.req.query());
    const slug = tagSlug(q);
    const rows = await c.var.db
      .select({ id: tags.id, name: tags.name, count: tags.useCount, merged_into: tags.mergedInto })
      .from(tags)
      .where(and(eq(tags.game, game), slug ? sql`${tags.id} like ${"%" + slug + "%"}` : undefined))
      .orderBy(desc(tags.useCount), asc(tags.name))
      .limit(200);
    return c.json(rows satisfies AdminTag[]);
  })

  // Moves every character from one tag to another. The old tag stays, pointing at the new one,
  // so typing it later gives the tag it was merged into.
  .post("/tags/merge", async (c) => {
    const parsed = z
      .object({ game: z.enum(GAME_IDS).default(DEFAULT_GAME), from: z.string().min(1), into: z.string().min(1) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HTTPException(400, { message: "Send { from, into }" });
    const { game } = parsed.data;
    const from = tagSlug(parsed.data.from);
    const into = tagSlug(parsed.data.into);
    if (from === into) throw new HTTPException(400, { message: "Those are the same tag" });
    const db = c.var.db;
    const found = await db.select().from(tags).where(and(eq(tags.game, game), inArray(tags.id, [from, into])));
    const target = found.find((t) => t.id === into);
    if (!found.some((t) => t.id === from) || !target) throw new HTTPException(404, { message: "Both tags must exist" });
    if (target.mergedInto) throw new HTTPException(400, { message: `"${target.name}" was itself merged; merge into "${target.mergedInto}"` });

    const onFrom = db
      .select({ cid: characterTags.cid })
      .from(characterTags)
      .innerJoin(characters, eq(characters.id, characterTags.cid))
      .where(and(eq(characterTags.tag, from), eq(characters.game, game)));
    await db.batch([
      // Characters with only the old tag get the new one; ones with both just lose the old one.
      db
        .insert(characterTags)
        .select(
          db
            .select({ cid: characterTags.cid, tag: sql<string>`${into}`.as("tag") })
            .from(characterTags)
            .innerJoin(characters, eq(characters.id, characterTags.cid))
            .where(and(eq(characterTags.tag, from), eq(characters.game, game))),
        )
        .onConflictDoNothing(),
      db.delete(characterTags).where(and(eq(characterTags.tag, from), inArray(characterTags.cid, onFrom))),
      db.update(tags).set({ mergedInto: into }).where(and(eq(tags.game, game), eq(tags.id, from))),
      // Anything already merged into the old tag now points at the new one.
      db.update(tags).set({ mergedInto: into }).where(and(eq(tags.game, game), eq(tags.mergedInto, from))),
      recountTags(db, game, [from, into]),
    ]);
    return c.json({ merged: from, into });
  });

