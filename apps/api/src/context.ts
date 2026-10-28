import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Auth, SessionUser } from "./auth";
import type { Db } from "./db";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    auth: Auth;
    user: SessionUser;
  };
};

/** Resolves the Better Auth session and rejects the request when there is none. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Unauthenticated" });
  c.set("user", session.user);
  await next();
});

/** Like requireUser, but only for admins (user.role = "admin"). */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Unauthenticated" });
  if (session.user.role !== "admin") throw new HTTPException(403, { message: "Admins only" });
  c.set("user", session.user);
  await next();
});

/** Who's asking on routes anyone may call, or null. Skips the session lookup without a cookie. */
export async function viewer(c: Context<AppEnv>) {
  if (!c.req.header("cookie")) return null;
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  return session ? { id: session.user.id, admin: session.user.role === "admin" } : null;
}

/** The signed-in user's id on routes anyone may call, or null. */
export async function viewerId(c: Context<AppEnv>) {
  return (await viewer(c))?.id ?? null;
}

export function displayName(u: { displayUsername?: string | null; username?: string | null; name: string }) {
  return u.displayUsername || u.username || u.name;
}
