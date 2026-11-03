import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { characters, characterTags } from "./db/schema";
import { deleteImages, imagesOf } from "./images";
import { recountTags } from "./tags";

/**
 * Deletes every character someone has shared, with their pictures in R2, and keeps tag counts
 * right. Used when an account is deleted (auth.ts) and when an admin bans and removes one
 * (routes/admin.ts). Favourites, collections and reports of those characters go with them
 * (foreign keys cascade). Returns how many there were.
 */
export async function deleteCharactersOf(db: Db, bucket: R2Bucket, authorId: string) {
  const owned = await db.select().from(characters).where(eq(characters.authorId, authorId));
  for (const character of owned) {
    const tagged = await db.select({ tag: characterTags.tag }).from(characterTags).where(eq(characterTags.cid, character.id));
    await db.batch([
      db.delete(characters).where(eq(characters.id, character.id)),
      recountTags(db, character.game, tagged.map((t) => t.tag)),
    ]);
  }
  await deleteImages(bucket, owned.flatMap(imagesOf));
  return owned.length;
}
