// Reads Crusader Kings III DNA strings (Ruler Designer "Copy DNA" output). Shared by the API,
// which validates uploads with it, and the web app, which draws with it (imported as "api/dna").
//
// Exports come in two shapes. Older ones are a bare genes block:
//
//   ruler_designer_123={
//     genes={
//       hair_color={ 30 13 72 250 }
//       gene_chin_forward={ "chin_forward_pos" 136 "chin_forward_pos" 114 }
//       ...
//
// Newer ones add `type=` and `id=` before it and `override={ portrait_modifier_overrides={...} }`
// and `entity={ 0 0 }` after it. Only entries inside `genes={...}` are genes.
//
// Each gene carries two values (0–255), one per strand. Colour genes carry two x/y pairs; we keep x.

export interface Gene {
  name: string;
  /** First value of the pair, 0–255. */
  a: number;
  /** Second value of the pair, 0–255. */
  b: number;
}

/** A DNA string with fewer genes than this is treated as incomplete. */
export const MIN_GENES = 20;

const GENE_PATTERN = /([a-z0-9_]+)\s*=\s*\{([^{}]*)\}/gi;

/** The text inside `genes={ ... }`, or the whole string when there is no such block. */
function genesBlock(dna: string) {
  const open = /\bgenes\s*=\s*\{/.exec(dna);
  if (!open) return dna;
  let depth = 1;
  for (let i = open.index + open[0].length; i < dna.length; i++) {
    if (dna[i] === "{") depth++;
    else if (dna[i] === "}" && --depth === 0) return dna.slice(open.index + open[0].length, i);
  }
  return dna.slice(open.index + open[0].length);
}

export function parseDna(dna: string): Gene[] {
  const genes: Gene[] = [];
  for (const [, name, body] of genesBlock(dna).matchAll(GENE_PATTERN)) {
    const numbers = body.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length < 2) continue;
    const half = Math.floor(numbers.length / 2);
    genes.push({ name, a: clampByte(numbers[0]), b: clampByte(numbers[half]) });
  }
  return genes;
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/**
 * The same face always gives the same fingerprint, whatever the export's layout, spacing or
 * random `ruler_designer_<n>` name: every gene entry, whitespace collapsed, sorted by name.
 */
export async function dnaFingerprint(dna: string) {
  const entries = [...genesBlock(dna).matchAll(GENE_PATTERN)]
    .map(([, name, body]) => `${name}=${body.trim().replace(/\s+/g, " ")}`)
    .sort();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(entries.join("\n")));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "gene_chin_forward" → "Chin forward" */
export function geneLabel(name: string) {
  const words = name.replace(/^gene_(bs_)?/, "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The part of the face (or body) a gene shapes, in the order a face map reads, top to bottom. */
export const REGIONS = ["Head", "Brow", "Eyes", "Nose", "Cheeks", "Mouth", "Jaw", "Body", "Hair & skin"] as const;
export type Region = (typeof REGIONS)[number];

const REGION_PATTERNS: [RegExp, Region][] = [
  [/hair|eyebrow|eyelash|beard|bald|skin_color|eye_color|complexion|accessory/, "Hair & skin"],
  [/forehead|brow|expression/, "Brow"],
  [/eye/, "Eyes"],
  [/nose|nasolabial/, "Nose"],
  [/mouth|teeth/, "Mouth"],
  [/chin|jaw/, "Jaw"],
  [/cheek|ear|temple/, "Cheeks"],
  [/head|neck/, "Head"],
];

export function geneRegion(name: string): Region {
  return REGION_PATTERNS.find(([pattern]) => pattern.test(name))?.[1] ?? "Body";
}

export interface ModSignature {
  id: string;
  /** Gene names that only this mod adds. For the base game: every gene it has. */
  genes: string[];
}

export interface ModGuess {
  /** Mods whose genes the DNA carries; the base game when it carries nothing else. */
  mods: string[];
  /** Genes neither the base game nor any known mod accounts for: likely a mod we don't know. */
  unknownGenes: string[];
}

/**
 * Guesses which mods a face was made with from the genes it carries. A mod counts when the DNA
 * has at least half of that mod's own genes. This is a suggestion for the uploader to confirm:
 * game patches add genes too, so a signature can be wrong until it's checked against real files.
 */
export function guessMods(genes: Gene[], base: ModSignature, mods: ModSignature[]): ModGuess {
  const names = new Set(genes.map((g) => g.name));
  const matched = mods.filter((m) => m.genes.length > 0 && m.genes.filter((g) => names.has(g)).length * 2 >= m.genes.length);
  const known = new Set([...base.genes, ...mods.flatMap((m) => m.genes)]);
  const unknownGenes = [...names].filter((n) => !known.has(n));
  return {
    mods: matched.length > 0 ? matched.map((m) => m.id) : unknownGenes.length === 0 ? [base.id] : [],
    unknownGenes,
  };
}
