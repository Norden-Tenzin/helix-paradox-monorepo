// Builds src/dna-game-genes.ts, the layout of CK3's base64 DNA for the base game and for mods that
// add genes, from the game's gene files.
//
//   node scripts/gene-tables.mts \
//     --layout vanilla "Base game" "<CK3>/game/common/genes" \
//     --layout epe EPE "<CK3>/game/common/genes" "<workshop>/<EPE id>/common/genes" \
//     …
//
// On Steam the game's folder is Steam/steamapps/common/Crusader Kings III/game/common/genes, and
// mods are in Steam/steamapps/workshop/content/1158310/<mod id>. Each path is a folder of .txt
// gene files or a single file. A layout's paths load the way the game loads them: put the game's
// folder first, then the mod's; a file with the same name as an earlier one replaces it, and the
// files are then read in name order.
//
// Base64 DNA stores 4 bytes per gene: every colour, morph and (non-special) accessory gene, in the
// order the files define them. Special genes (hairstyles, beards, clothes…) aren't in it; only the
// first beard and hairstyle are kept, so converted Ruler Designer text can name them.
//
// A gene defined again in a later file keeps its first position; the later file's templates are
// laid over the earlier ones. That also lets an extra file add templates another copy is missing.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Node = [key: string | null, value: string | Node[]];

function tokenize(text: string) {
  return text.replace(/^﻿/, "").replace(/#[^\n]*/g, "").match(/"[^"]*"|[{}=]|[^\s{}="]+/g) ?? [];
}

function parse(tokens: string[], start = 0): [Node[], number] {
  const nodes: Node[] = [];
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "}") return [nodes, i + 1];
    if (tokens[i + 1] === "=") {
      if (tokens[i + 2] === "{") {
        const [children, next] = parse(tokens, i + 3);
        nodes.push([token, children]);
        i = next;
      } else {
        nodes.push([token, tokens[i + 2]]);
        i += 3;
      }
    } else if (token === "{") {
      const [children, next] = parse(tokens, i + 1);
      nodes.push([null, children]);
      i = next;
    } else {
      nodes.push([null, token]);
      i++;
    }
  }
  return [nodes, i];
}

interface Layout {
  id: string;
  name: string;
  sources: string[];
  genes: string[];
  /** Genes whose 4 numbers are colour positions rather than template + value pairs. */
  colours: string[];
  templates: Record<string, Record<string, number>>;
  /** First template of each special gene the Ruler Designer lists (beards, hairstyles). */
  defaults: Record<string, string>;
  /** Every special gene's name: not in base64 DNA, so dropped without comment. */
  specials: string[];
}

const SPECIAL_DEFAULTS = ["beards", "hairstyles"];

function templatesOf(body: Node[]) {
  const table: Record<string, number> = {};
  for (const [name, templateBody] of body) {
    if (!name || typeof templateBody === "string") continue;
    const index = templateBody.find(([key]) => key === "index")?.[1];
    if (typeof index === "string" && /^\d+$/.test(index)) table[name] = Number(index);
  }
  return table;
}

function addGenes(layout: Layout, block: Node[], special: boolean, colour = false) {
  for (const [gene, body] of block) {
    if (!gene || typeof body === "string") continue;
    const table = templatesOf(body);
    if (special) {
      if (!layout.specials.includes(gene)) layout.specials.push(gene);
      if (SPECIAL_DEFAULTS.includes(gene) && !layout.defaults[gene]) {
        const first = Object.entries(table).sort((a, b) => a[1] - b[1])[0];
        if (first) layout.defaults[gene] = first[0];
      }
      continue;
    }
    if (!layout.genes.includes(gene)) layout.genes.push(gene);
    if (colour && !layout.colours.includes(gene)) layout.colours.push(gene);
    const existing = (layout.templates[gene] ??= {});
    for (const [name, index] of Object.entries(table)) {
      // A later definition wins: drop any earlier template that held this index under another name.
      for (const other of Object.keys(existing)) if (existing[other] === index && other !== name) delete existing[other];
      existing[name] = index;
    }
  }
}

function readGeneFile(layout: Layout, path: string) {
  const [tree] = parse(tokenize(readFileSync(path, "utf8")));
  for (const [key, value] of tree) {
    if (typeof value === "string") continue;
    if (key === "color_genes") addGenes(layout, value, false, true);
    else if (key === "morph_genes" || key === "accessory_genes") addGenes(layout, value, false);
    else if (key === "special_genes") {
      for (const [, inner] of value) if (typeof inner !== "string") addGenes(layout, inner, true);
    }
  }
}

function build(id: string, name: string, paths: string[]): Layout {
  // Same-named files replace earlier ones, like a mod's files replace the game's.
  const files = new Map<string, string>();
  for (const path of paths) {
    const list = statSync(path).isDirectory()
      ? readdirSync(path).filter((f) => f.endsWith(".txt")).map((f) => join(path, f))
      : [path];
    for (const file of list) files.set(basename(file).toLowerCase(), file);
  }
  const layout: Layout = { id, name, sources: paths, genes: [], colours: [], templates: {}, defaults: {}, specials: [] };
  for (const key of [...files.keys()].sort()) readGeneFile(layout, files.get(key)!);
  return layout;
}

// --layout <id> <name> <path>… [--layout …]
const args = process.argv.slice(2);
const layouts: Layout[] = [];
for (let i = 0; i < args.length; ) {
  if (args[i] !== "--layout" || !args[i + 1] || !args[i + 2]) {
    console.error('Usage: node scripts/gene-tables.mts --layout vanilla "Base game" <genes folder>… [--layout <id> <name> <folders>…]');
    process.exit(1);
  }
  const [id, name] = [args[i + 1], args[i + 2]];
  const paths: string[] = [];
  for (i += 3; i < args.length && args[i] !== "--layout"; i++) paths.push(args[i]);
  layouts.push(build(id, name, paths));
}
if (layouts[0]?.id !== "vanilla") {
  console.error("The first layout must be vanilla; the others only store where they differ from it.");
  process.exit(1);
}

const [vanilla] = layouts;
const same = (a: Record<string, number> | undefined, b: Record<string, number>) =>
  !!a && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([k, v]) => a[k] === v);
const table = (templates: Record<string, Record<string, number>>, skip?: Layout) =>
  Object.entries(templates)
    .filter(([gene, t]) => Object.keys(t).length > 0 && !(skip && same(skip.templates[gene], t)))
    .map(([gene, t]) => {
      const entries = Object.entries(t).sort((a, b) => a[1] - b[1]);
      return `      ${gene}: { ${entries.map(([n, i]) => `${n}: ${i}`).join(", ")} },`;
    })
    .join("\n");

const body = layouts
  .map((layout) => {
    const genes = layout.genes.map((g) => `"${g}"`).join(", ");
    return `  {
    id: "${layout.id}",
    name: "${layout.name}",
    genes: [${genes}],
    colours: ${JSON.stringify(layout.colours)},
    defaults: ${JSON.stringify(layout.defaults)},
    specials: ${JSON.stringify(layout.specials)},
    templates: {
${table(layout.templates, layout === vanilla ? undefined : vanilla)}
    },
  },`;
  })
  .join("\n");

const out = `// Generated by scripts/gene-tables.mts on ${new Date().toISOString().slice(0, 10)}. Don't edit by hand; rerun it.
${layouts.map((l) => `// ${l.id}: ${l.sources.map((p) => basename(p)).join(", ")}`).join("\n")}

export interface GeneLayout {
  /** The mod's id in the mods table ("vanilla" for the base game). */
  id: string;
  name: string;
  /** Every gene in this layout's base64 DNA, in the order its bytes come: 4 bytes per gene. */
  genes: readonly string[];
  /** Genes whose 4 numbers are colour positions rather than template + value pairs. */
  colours: readonly string[];
  /** First template of the special genes the Ruler Designer lists but base64 DNA leaves out. */
  defaults: Record<string, string>;
  /** Special genes (clothes, headgear…): listed in Ruler Designer text and dna_data, never in base64 DNA. */
  specials: readonly string[];
  /** Each gene's templates, by the index base64 DNA stores. Mods list only genes that differ from vanilla. */
  templates: Record<string, Record<string, number>>;
}

export const GENE_LAYOUTS: GeneLayout[] = [
${body}
];
`;
writeFileSync(new URL("../src/dna-game-genes.ts", import.meta.url), out);
for (const l of layouts) {
  const extra = l.genes.filter((g) => !vanilla.genes.includes(g)).length;
  console.log(`${l.id}: ${l.genes.length} genes${l === vanilla ? "" : ` (${extra} not in vanilla)`}`);
}
