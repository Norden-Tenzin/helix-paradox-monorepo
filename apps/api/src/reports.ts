import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "./db";
import { characters, characterTags, reports } from "./db/schema";
import { recountTags } from "./tags";

/** Open reports from this many different people hide a character until someone reviews them. */
export const HIDE_AFTER_REPORTS = 3;

/** Who can see a character: everyone while it's visible; once hidden, only its owner. */
export const visibleTo = (viewer: string | null) =>
  or(isNull(characters.hiddenAt), viewer ? eq(characters.authorId, viewer) : sql`0`);

/**
 * Hides a character once enough different people have open reports on it, and takes it out of
 * its tags' counts. Never un-hides: that's a reviewer's call (setHidden), since reports being
 * withdrawn isn't the same as the problem being fixed.
 */
export async function hideIfReportedEnough(db: Db, characterId: string) {
  const [{ open }] = await db
    .select({ open: count() })
    .from(reports)
    .where(and(eq(reports.characterId, characterId), eq(reports.status, "open")));
  if (open < HIDE_AFTER_REPORTS) return false;
  await setHidden(db, characterId, true);
  return true;
}

/** Hides or shows a character, recounting its tags so popular tags only count visible ones. */
export async function setHidden(db: Db, characterId: string, hidden: boolean) {
  const [row] = await db.select({ game: characters.game }).from(characters).where(eq(characters.id, characterId));
  if (!row) return;
  const tagged = await db.select({ tag: characterTags.tag }).from(characterTags).where(eq(characterTags.cid, characterId));
  await db.batch([
    db
      .update(characters)
      .set({ hiddenAt: hidden ? Date.now() : null })
      .where(and(eq(characters.id, characterId), hidden ? isNull(characters.hiddenAt) : sql`1`)),
    recountTags(db, row.game, tagged.map((t) => t.tag)),
  ]);
}
