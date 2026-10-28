import { and, eq, exists, lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { characters, characterViews } from "./db/schema";

const DAY = 24 * 60 * 60 * 1000;

/** Crawlers and link previews (chat apps unfurling a shared link) aren't people viewing. */
const NOT_A_PERSON = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Counts a view of a character, at most once per person per day. Signed-in people count by
 * account; signed-out visitors by a hash of their connection and browser that also changes
 * every day, so no IP address is ever stored and visits can't be linked across days.
 */
export async function recordView(db: Db, secret: string, characterId: string, request: Request, userId: string | null) {
  const agent = request.headers.get("user-agent") ?? "";
  if (NOT_A_PERSON.test(agent)) return false;

  const now = Date.now();
  const day = Math.floor(now / DAY);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const viewer = userId ? `u:${userId}` : `a:${(await sha256(`${secret}:${day}:${ip}:${agent}`)).slice(0, 32)}`;

  const [, counted] = await db.batch([
    db.insert(characterViews).values({ characterId, viewer, day, createdAt: now }).onConflictDoNothing(),
    // Only if the row above is new: its created_at is this request's own timestamp.
    db
      .update(characters)
      .set({ viewCount: sql`${characters.viewCount} + 1` })
      .where(
        and(
          eq(characters.id, characterId),
          exists(
            db
              .select({ one: sql`1` })
              .from(characterViews)
              .where(
                and(
                  eq(characterViews.characterId, characterId),
                  eq(characterViews.viewer, viewer),
                  eq(characterViews.day, day),
                  eq(characterViews.createdAt, now),
                ),
              ),
          ),
        ),
      ),
    // Earlier days' rows are no use: each day counts everyone afresh.
    db.delete(characterViews).where(lt(characterViews.day, day)),
  ]);
  return counted.meta.changes > 0;
}
