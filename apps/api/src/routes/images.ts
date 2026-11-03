import { Hono } from "hono";
import type { AppEnv } from "../context";

export const imageRoutes = new Hono<AppEnv>().get("/:key{.+}", async (c) => {
  const object = await c.env.BUCKET.get(c.req.param("key"), { onlyIf: c.req.raw.headers });
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // Uploads are only ever shown as images: never let a browser treat one as a page or script.
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  // Precondition (If-None-Match etc.) matched: R2 returns the object without a body.
  if (!("body" in object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});
