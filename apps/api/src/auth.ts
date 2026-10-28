import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import type { Db } from "./db";
import { schema } from "./db";
import { sendEmail, verificationEmail, type EmailEnv } from "./email";

export function createAuth(env: Env, db: Db) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    // No session until the email is confirmed, so everything that needs an account (sharing,
    // favourites) needs a real inbox: a speed bump for spam accounts.
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in before confirming sends a fresh link.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env as Env & EmailEnv, verificationEmail(user.email, user.name, url));
      },
    },
    plugins: [username()],
    advanced: {
      // The worker sits behind the SvelteKit proxy; trust its forwarded client IP for rate limiting.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];
