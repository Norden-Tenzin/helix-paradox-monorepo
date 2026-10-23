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

export function displayName(u: { displayUsername?: string | null; username?: string | null; name: string }) {
  return u.displayUsername || u.username || u.name;
}
