// Makes an account an admin, or a normal user again. Choose the database explicitly:
//
//   node scripts/set-role.mts --remote someone@example.com admin
//   node scripts/set-role.mts --local  someone@example.com user
//
// Anything after `--` is passed on to `wrangler d1 execute` (as in backfill-dna.mts).
// The person needs to sign in again (or wait for their session to refresh) to see the change.

import { execFileSync } from "node:child_process";

const separator = process.argv.indexOf("--");
const args = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator);
const passThrough = separator === -1 ? [] : process.argv.slice(separator + 1);

const where = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;
const [email, role] = args.filter((a) => !a.startsWith("--"));
if (!where || !email || (role !== "admin" && role !== "user")) {
  console.error("Usage: node scripts/set-role.mts --local|--remote <email> admin|user");
  process.exit(1);
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const d1 = (sql: string) =>
  JSON.parse(
    execFileSync("npx", ["wrangler", "d1", "execute", "helix-db", where, ...passThrough, "--json", "--command", sql], {
      encoding: "utf8",
    }),
  ) as [{ results: Record<string, unknown>[] }];

d1(`UPDATE user SET role = ${quote(role)} WHERE lower(email) = lower(${quote(email)})`);
const [{ results }] = d1(`SELECT username, email, role FROM user WHERE lower(email) = lower(${quote(email)})`);
if (results.length === 0) {
  console.error(`No account with the email ${email} (${where}).`);
  process.exit(1);
}
console.log(`${results[0].username} <${results[0].email}> is now: ${results[0].role} (${where})`);
