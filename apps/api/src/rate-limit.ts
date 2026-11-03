// Request limits, counted by Cloudflare's Rate Limiting bindings (wrangler.jsonc: ratelimits).
// Better Auth's own limiter keeps its counts in each isolate's memory, so on Workers it barely
// limits anything; these counts are shared across the whole location instead.
//
// Counted per visitor IP (cf-connecting-ip, which Cloudflare sets and the SvelteKit proxy passes
// on), so they also cover people who aren't signed in yet:
//   AUTH_LIMITER    signing in and up, verification emails, password changes: 10 a minute
//   UPLOAD_LIMITER  sharing or editing a character: 10 a minute
//   WRITE_LIMITER   everything else that changes something (favourites, "works", collections,
//                   reports): 60 a minute
// The limits are deliberately loose for a person and tight for a script.

import type { Context, Next } from "hono";
import type { AppEnv } from "./context";

const clientIp = (c: Context<AppEnv>) =>
  c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

// Auth endpoints that are reads under POST, or harmless to repeat, so they don't use up the budget.
const AUTH_FREE = ["/api/auth/sign-out", "/api/auth/get-session"];

function pickLimiter(c: Context<AppEnv>): RateLimit | null {
  const path = c.req.path;
  if (READS.has(c.req.method)) return null;
  if (path.startsWith("/api/auth/")) return AUTH_FREE.includes(path) ? null : c.env.AUTH_LIMITER;
  // Counting a view is anonymous and already counted once per person (views.ts).
  if (/^\/api\/characters\/[^/]+\/view$/.test(path)) return null;
  if (path === "/api/characters" || /^\/api\/characters\/[^/]+$/.test(path)) {
    return c.req.method === "DELETE" ? c.env.WRITE_LIMITER : c.env.UPLOAD_LIMITER;
  }
  // The Discover feed is a read sent as POST (its body is the list already seen).
  if (path === "/api/discover") return null;
  return c.env.WRITE_LIMITER;
}

export async function rateLimit(c: Context<AppEnv>, next: Next) {
  const limiter = pickLimiter(c);
  if (limiter) {
    const { success } = await limiter.limit({ key: clientIp(c) });
    if (!success) {
      return c.json({ error: "Too many requests. Wait a minute and try again.", message: "Too many requests. Wait a minute and try again." }, 429, {
        "retry-after": "60",
      });
    }
  }
  await next();
}
