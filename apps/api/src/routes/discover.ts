import { and, desc, eq, inArray, isNotNull, isNull, ne, notExists } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { viewerId, type AppEnv } from "../context";
import { characters, favourites, user } from "../db/schema";
import { faceDistance } from "../dna";
import { DEFAULT_GAME, GAME_IDS } from "../games";
import type { DiscoverPage, DiscoverReason } from "../types";
import { characterColumns, toCharacters } from "./characters";

/** How many recent favourites Discover draws "like this" picks from. */
const SEEDS = 20;

const discoverBody = z.object({
  game: z.enum(GAME_IDS).default(DEFAULT_GAME),
  limit: z.number().int().min(1).max(24).default(12),
  /** Characters already shown in this feed, so "more" brings new ones. */
  seen: z.array(z.string()).max(1000).default([]),
});

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export const discoverRoutes = new Hono<AppEnv>()
  // A batch of characters you haven't seen: for a signed-in person with favourites, half are the
  // closest faces to a few of them picked at random, half pure chance; signed out, all chance.
  // Your own characters and ones you've favourited are left out. POST so `seen` can be long.
  .post("/", async (c) => {
    const parsed = discoverBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: "Invalid request" });
    const { game, limit, seen } = parsed.data;
    const db = c.var.db;
    const viewer = await viewerId(c);

    const [candidates, seeds] = await Promise.all([
      db
        .select({ id: characters.id, features: characters.features })
        .from(characters)
        .where(
          and(
            eq(characters.game, game),
            isNull(characters.hiddenAt),
            viewer ? ne(characters.authorId, viewer) : undefined,
            viewer
              ? notExists(
                  db
                    .select({ id: favourites.characterId })
                    .from(favourites)
                    .where(and(eq(favourites.characterId, characters.id), eq(favourites.userId, viewer))),
                )
              : undefined,
          ),
        ),
      viewer
        ? db
            .select({ id: characters.id, name: characters.name, features: characters.features })
            .from(favourites)
            .innerJoin(characters, eq(characters.id, favourites.characterId))
            .where(and(eq(favourites.userId, viewer), eq(characters.game, game), isNull(characters.hiddenAt), isNotNull(characters.features)))
            .orderBy(desc(favourites.createdAt))
            .limit(SEEDS)
        : Promise.resolve([]),
    ]);

    const shown = new Set(seen);
    const pool = candidates.filter((cand) => !shown.has(cand.id));
    const picked = new Map<string, DiscoverReason>();

    // "Like" picks: for each of a few favourites drawn at random, its nearest unpicked face.
    const likeSlots = seeds.length > 0 ? Math.ceil(limit / 2) : 0;
    const drawn = shuffle([...seeds]);
    for (let i = 0; i < likeSlots && i < drawn.length * 2; i++) {
      const seed = drawn[i % drawn.length];
      let best: { id: string; distance: number } | null = null;
      for (const cand of pool) {
        if (!cand.features || picked.has(cand.id)) continue;
        const distance = faceDistance(seed.features!, cand.features);
        if (Number.isFinite(distance) && (!best || distance < best.distance)) best = { id: cand.id, distance };
      }
      if (best) picked.set(best.id, { kind: "like", id: seed.id, name: seed.name });
    }
    const likes = [...picked];

    // Chance fills the rest.
    const chance = shuffle(pool.filter((cand) => !picked.has(cand.id)))
      .slice(0, limit - likes.length)
      .map((cand): [string, DiscoverReason] => [cand.id, { kind: "random" }]);

    // Alternate the two, so neither kind bunches up.
    const order: [string, DiscoverReason][] = [];
    for (let i = 0; i < Math.max(likes.length, chance.length); i++) {
      if (likes[i]) order.push(likes[i]);
      if (chance[i]) order.push(chance[i]);
    }

    const rows =
      order.length > 0
        ? await db
            .select(characterColumns(viewer))
            .from(characters)
            .innerJoin(user, eq(user.id, characters.authorId))
            .where(inArray(characters.id, order.map(([id]) => id)))
        : [];
    const enriched = new Map(toCharacters(rows).map((ch) => [ch.id, ch]));
    const body: DiscoverPage = {
      picks: order.flatMap(([id, reason]) => {
        const character = enriched.get(id);
        return character ? [{ character, reason }] : [];
      }),
      more: pool.length > order.length,
    };
    return c.json(body);
  });
