import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { captcha, username } from "better-auth/plugins";
import type { Db } from "./db";
import { schema } from "./db";
import { user as users } from "./db/schema";
import { deleteCharactersOf } from "./accounts";
import { sendEmail, verificationEmail } from "./email";

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
        await sendEmail(env, verificationEmail(user.email, user.name, url));
      },
    },
    session: {
      // Keeps a signed copy of the session in a cookie for 5 minutes, so most requests (and every
      // page the site renders) don't need a database round trip just to know who's asking. The
      // cost: signing out elsewhere, or a role change, can take up to 5 minutes to apply.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      // "Delete my account" on /account, confirmed with the password. Everything they shared goes
      // too: the pictures in R2 here, the rest by foreign keys cascading from the user row.
      deleteUser: {
        enabled: true,
        beforeDelete: async (u) => {
          await deleteCharactersOf(db, env.BUCKET, u.id);
        },
      },
      additionalFields: {
        // Read by requireAdmin; sign-up can't set it.
        role: { type: "string", defaultValue: "user", input: false },
        // Set by an admin (routes/admin.ts). A banned account can't sign in or change anything.
        bannedAt: { type: "number", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Every sign-in makes a session, so this is where a banned account is turned away.
          before: async (session) => {
            const [row] = await db.select({ bannedAt: users.bannedAt }).from(users).where(eq(users.id, session.userId));
            if (row?.bannedAt) throw new APIError("FORBIDDEN", { message: "This account has been banned." });
          },
        },
      },
    },
    plugins: [
      username(),
      // Turnstile on sign-up, so scripts can't make accounts in bulk. The browser sends the
      // widget's token as x-captcha-response (routes/sign-up). Without a secret (local dev without
      // one in .dev.vars) the check is skipped.
      ...(env.TURNSTILE_SECRET_KEY
        ? [captcha({ provider: "cloudflare-turnstile", secretKey: env.TURNSTILE_SECRET_KEY, endpoints: ["/sign-up/email"] })]
        : []),
    ],
    advanced: {
      // The worker sits behind the SvelteKit proxy; trust its forwarded client IP for rate limiting.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];
