// Makes the small card-sized portrait (thumb_image) for characters shared before the upload page
// made one. Downloads each portrait, shrinks it to 1200px on its long side with cwebp (brew install
// webp), stores it next to the original in R2, and records it. Choose where explicitly:
//
//   node scripts/backfill-thumbs.mts --local
//   node scripts/backfill-thumbs.mts --remote     (production)
//
// Add --dry-run to list what it would do. Anything after `--` is passed on to wrangler (e.g.
// `-- --config other.jsonc --persist-to dir` for a scratch setup).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const where = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
if (!where) {
  console.error("Choose where: --local or --remote");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const separator = process.argv.indexOf("--");
const passThrough = separator === -1 ? [] : process.argv.slice(separator + 1);
const BUCKET = "helix-images";
const LONG_SIDE = 1200;

const wrangler = (...args: string[]) =>
  execFileSync("npx", ["wrangler", ...args, where, ...passThrough], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const query = <T,>(sql: string) =>
  (JSON.parse(wrangler("d1", "execute", "helix-db", "--json", "--command", sql)) as [{ results: T[] }])[0].results;
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

const rows = query<{ id: string; name: string; display_image: string }>(
  `SELECT id, name, display_image FROM characters WHERE thumb_image IS NULL`,
);
console.log(`${rows.length} characters without a thumbnail`);

const dir = mkdtempSync(join(tmpdir(), "thumbs-"));
let made = 0;
try {
  for (const row of rows) {
    const original = join(dir, "original");
    const thumb = join(dir, "thumb.webp");
    try {
      if (/^https?:\/\//.test(row.display_image)) {
        // Older characters (imported) point at pictures hosted elsewhere.
        const response = await fetch(row.display_image);
        if (!response.ok) throw new Error(`download failed (${response.status})`);
        writeFileSync(original, Buffer.from(await response.arrayBuffer()));
      } else {
        wrangler("r2", "object", "get", `${BUCKET}/${row.display_image}`, "--file", original);
      }
      // Shrink along whichever side is longer; never enlarge.
      const dims = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", original], { encoding: "utf8" });
      const width = Number(/pixelWidth: (\d+)/.exec(dims)?.[1]);
      const height = Number(/pixelHeight: (\d+)/.exec(dims)?.[1]);
      if (!width || !height) throw new Error("not an image sips can read");
      const resize = Math.max(width, height) <= LONG_SIDE ? [] : width >= height ? ["-resize", String(LONG_SIDE), "0"] : ["-resize", "0", String(LONG_SIDE)];
      execFileSync("cwebp", ["-quiet", "-q", "78", ...resize, original, "-o", thumb]);

      const key = `characters/${row.id}/${crypto.randomUUID()}.webp`;
      const size = readFileSync(thumb).length;
      if (dryRun) {
        console.log(`would  ${row.name}: ${width}×${height} → ${key} (${Math.round(size / 1024)} KB)`);
        continue;
      }
      wrangler(
        "r2", "object", "put", `${BUCKET}/${key}`, "--file", thumb,
        "--content-type", "image/webp", "--cache-control", "public, max-age=31536000, immutable",
      );
      wrangler("d1", "execute", "helix-db", "--command", `UPDATE characters SET thumb_image = ${quote(key)} WHERE id = ${quote(row.id)} AND thumb_image IS NULL`);
      made += 1;
      console.log(`made   ${row.name}: ${Math.round(size / 1024)} KB`);
    } catch (err) {
      console.log(`skip   ${row.name}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
    } finally {
      rmSync(original, { force: true });
      rmSync(thumb, { force: true });
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(dryRun ? "Dry run: nothing changed." : `Made ${made} thumbnails.`);
