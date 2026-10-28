// Fills what's worked out from each character's DNA for characters shared before it existed:
// `dna_hash` (duplicate checks, migration 0001) and `features` ("more like this", migration 0007).
// Only fills what's missing, so it's safe to run again. Choose the database explicitly:
//
//   node scripts/backfill-dna.mts --local
//   node scripts/backfill-dna.mts --remote     (production)
//
// Add --dry-run to print the updates without applying them. Anything after `--` is passed on to
// `wrangler d1 execute` (e.g. `-- --config other.jsonc --persist-to dir` for a scratch database).

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dnaFingerprint, faceFeatures } from "../src/dna.ts";

const where = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
if (!where) {
  console.error("Choose the database: --local or --remote");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const separator = process.argv.indexOf("--");
const passThrough = separator === -1 ? [] : process.argv.slice(separator + 1);

const d1 = (...args: string[]) =>
  execFileSync("npx", ["wrangler", "d1", "execute", "helix-db", where, ...passThrough, ...args], { encoding: "utf8" });

const [{ results }] = JSON.parse(
  d1("--json", "--command", "SELECT id, dna, dna_hash IS NULL AS no_hash, features IS NULL AS no_features FROM characters WHERE dna_hash IS NULL OR features IS NULL"),
) as [{ results: { id: string; dna: string; no_hash: number; no_features: number }[] }];

if (results.length === 0) {
  console.log("Every character is already filled in.");
  process.exit(0);
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const statements = await Promise.all(
  results.map(async (r) => {
    const set = [
      ...(r.no_hash ? [`dna_hash = ${quote(await dnaFingerprint(r.dna))}`] : []),
      ...(r.no_features ? [`features = ${quote(JSON.stringify(faceFeatures(r.dna)))}`] : []),
    ];
    return `UPDATE characters SET ${set.join(", ")} WHERE id = ${quote(r.id)};`;
  }),
);
console.log(`${results.length} characters to fill in (${where}).`);
if (dryRun) {
  console.log(statements.join("\n"));
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "dna-hash-"));
try {
  const file = join(dir, "backfill.sql");
  writeFileSync(file, statements.join("\n"));
  d1("--file", file, "--yes");
  console.log("Done.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
