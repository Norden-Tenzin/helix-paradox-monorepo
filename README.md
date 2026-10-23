# CK3 Helix

Share Crusader Kings III character DNA and portraits.

```
apps/
  api/   Hono worker — Better Auth, Cloudflare D1 (Drizzle) and R2
  web/   SvelteKit site on Cloudflare Workers
website/ the previous Next.js + Convex + Clerk app (reference only)
```

## How it fits together

The browser only ever talks to the SvelteKit site. `apps/web/src/hooks.server.ts` forwards every
`/api/*` request to the API worker — over a service binding in production, or to
`http://localhost:8787` in dev. Because everything is same-origin, Better Auth's session cookies
are first-party and there is no CORS to configure.

| Route                            | Description                                                   |
| -------------------------------- | ------------------------------------------------------------- |
| `/api/auth/*`                    | Better Auth (email + password, sign in with username or email) |
| `GET /api/characters`            | List. Query: `author, sex, mods=epe,cfp, q, sort, cursor, limit` |
| `GET /api/characters/:id`        | One character                                                 |
| `POST /api/characters`           | Create (multipart, see below)                                 |
| `PATCH /api/characters/:id`      | Update (owner only)                                           |
| `DELETE /api/characters/:id`     | Delete with its R2 images (owner only)                        |
| `GET /api/users/me`              | Signed-in user or `null`                                      |
| `GET /api/users/:id`             | Public profile + character count                              |
| `GET /api/images/*`              | Images served from R2                                         |

Create/update take `multipart/form-data` with `name`, `sex`, `description`, `dna`, repeated `mods`,
a `display` image, and up to three `grid` entries. Each image entry is either a new file or the URL of
one of the character's existing images, which keeps it. Images that an update drops are deleted from R2.

## Local development

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then set BETTER_AUTH_SECRET
pnpm --filter api db:migrate:local
pnpm dev                                           # api on :8787, web on :5173
```

Open http://localhost:5173. Tasks run through [Turborepo](https://turbo.build): `pnpm dev` opens a
pane per app (arrow keys to switch, `i` to interact, `q` to quit). `pnpm dev:api` / `pnpm dev:web`
run one side only; `pnpm build` and `pnpm check` are cached.

Schema changes: edit `apps/api/src/db/schema.ts`, then `pnpm --filter api db:generate` and apply
the migration.

## Deploying

```sh
cd apps/api
wrangler d1 create helix-db            # paste the database_id into wrangler.jsonc
wrangler r2 bucket create helix-images
wrangler secret put BETTER_AUTH_SECRET
# set BETTER_AUTH_URL in wrangler.jsonc to the site's public URL
pnpm db:migrate:remote
pnpm deploy

cd ../web
pnpm build && wrangler deploy           # binds to the helix-api worker as API
```
