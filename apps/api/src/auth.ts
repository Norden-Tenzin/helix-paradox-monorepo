import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import type { Db } from "./db";
import { schema } from "./db";

export function createAuth(env: Env, db: Db) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    plugins: [username()],
    advanced: {
      // The worker sits behind the SvelteKit proxy; trust its forwarded client IP for rate limiting.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];
