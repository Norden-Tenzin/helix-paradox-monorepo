import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { displayName, viewerId, type AppEnv } from "../context";
import { characters, collections, user } from "../db/schema";
import type { Me, PublicUser } from "../types";

export const userRoutes = new Hono<AppEnv>()
  // The signed-in user, or null.
  .get("/me", async (c) => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json(null);
    const me: Me = {
      id: session.user.id,
      name: displayName(session.user),
      email: session.user.email,
      admin: session.user.role === "admin",
    };
    return c.json(me);
  })

  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const isMe = (await viewerId(c)) === id;
    const [[found], [{ total }], [{ lists }]] = await Promise.all([
      c.var.db.select().from(user).where(eq(user.id, id)),
      c.var.db.select({ total: count() }).from(characters).where(eq(characters.authorId, id)),
      c.var.db
        .select({ lists: count() })
        .from(collections)
        .where(and(eq(collections.userId, id), isMe ? undefined : eq(collections.public, true))),
    ]);
    if (!found) throw new HTTPException(404, { message: "User not found" });
    const body: PublicUser = { id: found.id, name: displayName(found), character_count: total, collection_count: lists };
    return c.json(body);
  });
