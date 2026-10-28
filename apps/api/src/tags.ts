import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Db } from "./db";
import { characters, characterTags, tags } from "./db/schema";
import type { GameId } from "./games";
import { cleanTagName, MAX_TAGS, tagSlug } from "./tag-names";

export { cleanTagName, MAX_TAG_LENGTH, MAX_TAGS, tagSlug } from "./tag-names";

/**
 * Turns the names an uploader typed into tag slugs, adding any tag that doesn't exist yet
 * (written as they first typed it). Duplicates collapse; empty names are dropped.
 */
export async function resolveTags(db: Db, game: GameId, names: string[], userId: string) {
  const wanted = new Map<string, string>();
  for (const raw of names) {
    const name = cleanTagName(raw);
    const slug = tagSlug(name);
    if (slug && !wanted.has(slug)) wanted.set(slug, name);
  }
  if (wanted.size === 0) return [];

  // A tag merged into another (by an admin) stands for that one from now on.
  const merged = await db
    .select({ id: tags.id, into: tags.mergedInto })
    .from(tags)
    .where(and(eq(tags.game, game), inArray(tags.id, [...wanted.keys()]), isNotNull(tags.mergedInto)));
  for (const { id, into } of merged) {
    wanted.delete(id);
    if (into && !wanted.has(into)) wanted.set(into, into);
  }
  if (wanted.size > MAX_TAGS) throw new HTTPException(400, { message: `At most ${MAX_TAGS} tags` });

  const now = Date.now();
  await db
    .insert(tags)
    .values([...wanted].map(([id, name]) => ({ game, id, name, createdBy: userId, createdAt: now })))
    .onConflictDoNothing();
  return [...wanted.keys()];
}

/**
 * Recounts how many visible characters use each tag, so counts can't drift as tags come and go
 * and a popular tag never leads to characters hidden by reports.
 */
export const recountTags = (db: Db, game: string, slugs: string[]) =>
  db
    .update(tags)
    .set({
      useCount: sql`(select count(*) from ${characterTags} inner join ${characters} on ${characters.id} = ${characterTags.cid}
        where ${characterTags.tag} = ${tags.id} and ${characters.game} = ${tags.game} and ${characters.hiddenAt} is null)`,
    })
    .where(and(eq(tags.game, game), inArray(tags.id, slugs.length > 0 ? slugs : [""])));
