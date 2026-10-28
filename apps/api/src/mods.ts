import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Db } from "./db";
import { mods } from "./db/schema";
import type { ModSignature } from "./dna";
import { BASE_MOD, type GameId } from "./games";

export type ModRow = typeof mods.$inferSelect;

export async function gameMods(db: Db, game: GameId) {
  return db.select().from(mods).where(eq(mods.game, game));
}

/** The game's base-game signature and every other mod's, ready for guessMods(). */
export function signatures(rows: ModRow[]): { base: ModSignature; others: ModSignature[] } {
  const base = rows.find((m) => m.id === BASE_MOD);
  if (!base) throw new HTTPException(500, { message: "This game has no base-game mod row" });
  return {
    base: { id: base.id, genes: base.genes },
    others: rows.filter((m) => m.id !== BASE_MOD).map((m) => ({ id: m.id, genes: m.genes })),
  };
}

/** "Game of Thrones" → "game-of-thrones" */
export const modSlug = (name: string) =>
  name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/**
 * The mod an uploader named because the DNA has genes we don't recognise. Reuses a mod with the
 * same slug if there is one; otherwise adds it as pending, with those genes as its signature.
 */
export async function namedMod(db: Db, game: GameId, name: string, unknownGenes: string[], userId: string) {
  const id = modSlug(name);
  if (!id) throw new HTTPException(400, { message: "Give the mod a name with letters or numbers in it" });
  const [existing] = await db.select().from(mods).where(and(eq(mods.game, game), eq(mods.id, id)));
  if (existing) return existing.id;
  await db.insert(mods).values({
    game,
    id,
    name: name.trim().slice(0, 60),
    genes: unknownGenes,
    status: "pending",
    createdBy: userId,
    createdAt: Date.now(),
  });
  return id;
}
