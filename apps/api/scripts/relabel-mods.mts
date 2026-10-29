// Sets each character's mods to what its DNA shows (guessMods, as uploads do now), for characters
// labelled by hand before mods came from the DNA alone. A DNA with genes no known mod accounts for
// is left alone and listed: its mod needs naming first. Choose the database explicitly:
//
//   node scripts/relabel-mods.mts --local
//   node scripts/relabel-mods.mts --remote     (production)
//
// Add --dry-run to print the changes without applying them. Anything after `--` is passed on to
// `wrangler d1 execute` (e.g. `-- --config other.jsonc --persist-to dir` for a scratch database).

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guessMods, parseDna } from "../src/dna.ts";
import { BASE_MOD } from "../src/games.ts";

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
const query = <T,>(sql: string) => (JSON.parse(d1("--json", "--command", sql)) as [{ results: T[] }])[0].results;

const characters = query<{ id: string; name: string; game: string; dna: string; mods: string | null }>(
  `SELECT c.id, c.name, c.game, c.dna, (SELECT group_concat(mod) FROM character_mods WHERE cid = c.id) AS mods FROM characters c`,
);
const mods = query<{ game: string; id: string; genes: string }>(`SELECT game, id, genes FROM mods`);

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const statements: string[] = [];
for (const c of characters) {
  const gameMods = mods.filter((m) => m.game === c.game).map((m) => ({ id: m.id, genes: JSON.parse(m.genes) as string[] }));
  const base = gameMods.find((m) => m.id === BASE_MOD);
  if (!base) {
    console.log(`skip  ${c.name}: its game (${c.game}) has no base-game row`);
    continue;
  }
  const guess = guessMods(parseDna(c.dna), base, gameMods.filter((m) => m.id !== BASE_MOD));
  const current = (c.mods ?? "").split(",").filter(Boolean).sort();
  const shown = [...guess.mods].sort();
  if (guess.unknownGenes.length > 0) {
    console.log(`skip  ${c.name}: ${guess.unknownGenes.length} genes from a mod we don't know (labelled ${current.join(" + ") || "nothing"})`);
    continue;
  }
  if (current.join() === shown.join()) {
    console.log(`keep  ${c.name}: ${current.join(" + ")}`);
    continue;
  }
  console.log(`set   ${c.name}: ${current.join(" + ") || "nothing"} → ${shown.join(" + ")}`);
  statements.push(
    `DELETE FROM character_mods WHERE cid = ${quote(c.id)};`,
    ...shown.map((mod) => `INSERT INTO character_mods (cid, mod) VALUES (${quote(c.id)}, ${quote(mod)});`),
  );
}

if (statements.length === 0) {
  console.log("\nNothing to change.");
  process.exit(0);
}
if (dryRun) {
  console.log(`\n${statements.join("\n")}`);
  process.exit(0);
}
const dir = mkdtempSync(join(tmpdir(), "relabel-mods-"));
try {
  const file = join(dir, "relabel.sql");
  writeFileSync(file, statements.join("\n"));
  d1("--file", file, "--yes");
  console.log("\nDone.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
