import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../context";
import { characters } from "../db/schema";
import { dnaFingerprint, guessMods, MIN_GENES, parseDna } from "../dna";
import { BASE_MOD, DEFAULT_GAME, GAME_IDS } from "../games";
import { gameMods, signatures } from "../mods";
import type { DnaReport, Mod } from "../types";

const listQuery = z.object({
  game: z.enum(GAME_IDS).default(DEFAULT_GAME),
  /** "1" adds mods named by uploaders but not listed yet: the upload form offers them, filters don't. */
  pending: z.literal("1").optional(),
});

export const modRoutes = new Hono<AppEnv>()
  // A game's mods: the base game first, then listed mods, then (if asked) pending ones, by name.
  .get("/", async (c) => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) throw new HTTPException(400, { message: "Unknown game" });
    const rows = await gameMods(c.var.db, parsed.data.game);
    const rank = (m: (typeof rows)[number]) => (m.id === BASE_MOD ? 0 : m.status === "listed" ? 1 : 2);
    const body: Mod[] = rows
      .filter((m) => m.status === "listed" || parsed.data.pending)
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .map((m) => ({ id: m.id, name: m.name, pending: m.status === "pending" }));
    return c.json(body);
  });

const inspectBody = z.object({
  dna: z.string().max(50_000),
  game: z.enum(GAME_IDS).default(DEFAULT_GAME),
  /** When editing, the character being edited, so it isn't reported as its own duplicate. */
  exclude: z.string().optional(),
});

export const dnaRoutes = new Hono<AppEnv>()
  // Reads a DNA string as the upload form fills in, so problems show before anything is sent.
  .post("/inspect", async (c) => {
    const parsed = inspectBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HTTPException(400, { message: "Send { dna, game? }" });
    const { dna, game, exclude } = parsed.data;
    const db = c.var.db;

    const genes = parseDna(dna);
    const { base, others } = signatures(await gameMods(db, game));
    const guess = guessMods(genes, base, others);
    const hash = await dnaFingerprint(dna);
    const duplicates =
      genes.length === 0
        ? []
        : await db
            .select({ id: characters.id, name: characters.name })
            .from(characters)
            .where(
              and(
                eq(characters.game, game),
                eq(characters.dnaHash, hash),
                exclude ? ne(characters.id, exclude) : undefined,
              ),
            )
            .limit(5);

    const body: DnaReport = {
      genes: genes.length,
      complete: genes.length >= MIN_GENES,
      // A cut-short string can't say much about mods; suggest only for a whole face.
      suggestedMods: genes.length >= MIN_GENES ? guess.mods : [],
      unknownGenes: guess.unknownGenes,
      duplicates,
    };
    return c.json(body);
  });
