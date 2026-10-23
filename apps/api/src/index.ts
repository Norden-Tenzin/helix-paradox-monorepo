import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { createAuth } from "./auth";
import type { AppEnv } from "./context";
import { createDb } from "./db";
import { characterRoutes } from "./routes/characters";
import { imageRoutes } from "./routes/images";
import { userRoutes } from "./routes/users";

const app = new Hono<AppEnv>().basePath("/api");

app.use(logger());
app.use(async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  c.set("auth", createAuth(c.env, db));
  await next();
});

app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));

app.route("/characters", characterRoutes);
app.route("/users", userRoutes);
app.route("/images", imageRoutes);

app.get("/health", (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
