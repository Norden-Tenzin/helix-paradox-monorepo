import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../context";
import { tags } from "../db/schema";
import { DEFAULT_GAME, GAME_IDS } from "../games";
import { cleanTagName, tagSlug } from "../tags";
import type { TagSummary } from "../types";

const listQuery = z.object({
  game: z.enum(GAME_IDS).default(DEFAULT_GAME),
  /** What's been typed so far; empty for the most-used tags. */
  q: z.string().max(60).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => "\\" + ch);

export const tagRoutes = new Hono<AppEnv>()
  // Tags in use, most-used first: suggestions while typing, or the library's popular tags.
  // Tags starting with what was typed come before ones that only contain it.
  .get("/", async (c) => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) throw new HTTPException(400, { message: "Invalid query" });
    const { game, q, limit } = parsed.data;
    const slug = tagSlug(q);
    const name = cleanTagName(q).toLowerCase();

    const starts = slug ? sql`${tags.id} like ${escapeLike(slug) + "%"} escape '\\'` : sql`1`;
    const matches = slug
      ? or(starts, sql`lower(${tags.name}) like ${"%" + escapeLike(name) + "%"} escape '\\'`)
      : undefined;
    const rows = await c.var.db
      .select({ id: tags.id, name: tags.name, count: tags.useCount })
      .from(tags)
      .where(and(eq(tags.game, game), gt(tags.useCount, 0), matches))
      .orderBy(desc(starts), desc(tags.useCount), tags.name)
      .limit(limit);
    return c.json(rows satisfies TagSummary[]);
  });
