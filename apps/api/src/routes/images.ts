import { Hono } from "hono";
import type { AppEnv } from "../context";

export const imageRoutes = new Hono<AppEnv>().get("/:key{.+}", async (c) => {
  const object = await c.env.BUCKET.get(c.req.param("key"), { onlyIf: c.req.raw.headers });
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // Precondition (If-None-Match etc.) matched: R2 returns the object without a body.
  if (!("body" in object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});
