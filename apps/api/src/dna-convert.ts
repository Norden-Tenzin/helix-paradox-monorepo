// Converts CK3 DNA between its two shapes:
//
// - Ruler Designer text, what the Ruler Designer's Copy DNA gives and what the site stores:
//     gene_chin_forward={ "chin_forward_pos" 136 "chin_forward_pos" 114 }
// - base64 ("persistent") DNA, the short code in history files and debug mode's copy: 4 bytes per
//   gene in a fixed order. For most genes the bytes are template index, value, recessive template
//   index, recessive value; for colour genes they are the two x/y pairs.
//
// The order and the templates depend on the mods loaded, so each supported mod has its own layout
// (dna-game-genes.ts, built from the game's and mods' gene files). Base64 DNA doesn't carry
// beards, hairstyles or clothes.

import { genesBlock } from "./dna";
import { GENE_LAYOUTS, type GeneLayout } from "./dna-game-genes";
import { KYUSOO_TEMPLATES } from "./dna-tables";

export type DnaFormat = "ruler_designer" | "base64";

export const LAYOUTS: readonly Pick<GeneLayout, "id" | "name">[] = GENE_LAYOUTS.map(({ id, name }) => ({ id, name }));

export type Conversion =
  | {
      ok: true;
      from: DnaFormat;
      output: string;
      /** The layout used, and whether it was picked from the DNA rather than chosen. */
      layout: { id: string; name: string; detected: boolean };
      /** Other layouts the DNA fits just as well (only when detected), to offer as a switch. */
      alternatives: { id: string; name: string }[];
      notes: string[];
    }
  | { ok: false; error: string };

export interface ConvertOptions {
  /** Copy each gene's main half over its recessive half, so children inherit the same face. */
  pureBlooded?: boolean;
  /** A layout id from LAYOUTS, to override detection; picked from the DNA when left out. */
  layout?: string;
}

type Bytes = [number, number, number, number];

const VANILLA = GENE_LAYOUTS[0];
const SPECIAL = new Set(["beards", "hairstyles", "clothes", ...GENE_LAYOUTS.flatMap((l) => l.specials)]);

function templatesFor(layout: GeneLayout, gene: string): Record<string, number> {
  return layout.templates[gene] ?? VANILLA.templates[gene] ?? KYUSOO_TEMPLATES[gene] ?? {};
}

function chosenLayout(id: string | undefined) {
  return id ? GENE_LAYOUTS.find((l) => l.id === id) : undefined;
}

/** Which shape some pasted DNA is, or null when it's neither. */
export function detectFormat(input: string): DnaFormat | null {
  const text = input.trim();
  if (!text) return null;
  if (/=\s*\{/.test(text)) return "ruler_designer";
  if (/^[A-Za-z0-9+/\s]+={0,2}$/.test(text)) return "base64";
  return null;
}

/** Converts whichever shape was pasted into the other. */
export function convertDna(input: string, options: ConvertOptions = {}): Conversion {
  const format = detectFormat(input);
  if (format === "base64") return base64ToRulerDesigner(input, options);
  if (format === "ruler_designer") return rulerDesignerToBase64(input, options);
  return {
    ok: false,
    error: "That isn’t DNA we recognise. Paste either Ruler Designer text (it starts with ruler_designer_) or a base64 code.",
  };
}

export function base64ToRulerDesigner(code: string, options: ConvertOptions = {}): Conversion {
  let bytes: number[];
  try {
    bytes = [...atob(code.replace(/\s+/g, ""))].map((c) => c.charCodeAt(0));
  } catch {
    return { ok: false, error: "That base64 code is damaged. Check it was copied in full." };
  }
  if (bytes.length % 4 !== 0) {
    return { ok: false, error: "That base64 code is cut short. Check it was copied in full." };
  }
  const count = bytes.length / 4;
  const notes: string[] = [];

  // The code's length says which layout it is: each has its own number of genes.
  let layout = chosenLayout(options.layout);
  const detected = !layout;
  if (layout && layout.genes.length !== count) {
    return {
      ok: false,
      error: `This code has ${count} genes, but ${layout.name} DNA has ${layout.genes.length}. Pick another game or mod, or let us detect it.`,
    };
  }
  let alternatives: { id: string; name: string }[] = [];
  if (!layout) {
    // Layouts can share a length (EPE's two versions). Read with the wrong one, a code lands on
    // shape numbers that layout doesn't have, so the one with the fewest unknown shapes wins.
    const scored = GENE_LAYOUTS.filter((l) => l.genes.length === count)
      .map((l) => ({ l, unknown: unknownShapes(l, bytes) }))
      .sort((a, b) => a.unknown - b.unknown || tieRank(b.l) - tieRank(a.l));
    layout = scored[0]?.l;
    alternatives = scored
      .filter((s) => s.l !== layout && s.unknown === scored[0].unknown)
      .map(({ l }) => ({ id: l.id, name: l.name }));
  }
  if (!layout) {
    if (count < VANILLA.genes.length) {
      return {
        ok: false,
        error: `That code has ${count} genes, fewer than the ${VANILLA.genes.length} the base game uses. Check it was copied in full.`,
      };
    }
    layout = VANILLA;
    notes.push(
      `This code has ${count} genes, which doesn’t match the base game or any mod we know, so we read the first ${VANILLA.genes.length} as the base game’s. If it’s from a mod, the face may come out wrong.`,
    );
  }

  const used = layout;
  const unknown: string[] = [];
  const lines = used.genes.map((gene, i) =>
    geneLine(used, gene, bytes.slice(i * 4, i * 4 + 4) as Bytes, options, unknown),
  );
  // Not in base64 DNA, but the Ruler Designer lists them; their first template is "none"/"all".
  for (const [gene, template] of Object.entries(used.defaults)) {
    lines.push(`${gene}={ "${template}" 0 "${template}" 0 }`);
  }
  if (unknown.length > 0) notes.push(unknownNote(unknown));
  notes.push("Base64 DNA doesn’t include the beard or hairstyle, so pick those in the Ruler Designer.");

  const id = Math.floor(Math.random() * 9e9) + 1e9;
  const output = `ruler_designer_${id}={\n\tgenes={\n${lines.map((l) => `\t\t${l}`).join("\n")}\n\t}\n}`;
  return { ok: true, from: "base64", output, layout: { id: used.id, name: used.name, detected }, alternatives, notes };
}

function unknownShapes(layout: GeneLayout, bytes: number[]) {
  const unknown: string[] = [];
  layout.genes.forEach((gene, i) => geneLine(layout, gene, bytes.slice(i * 4, i * 4 + 4) as Bytes, {}, unknown));
  return unknown.length;
}

/**
 * Which layout wins when the bytes fit two equally well. Tested on EPE's own faces: codes in
 * current EPE's layout always show unknown shapes when read as older EPE (11 of 11), while older
 * codes often fit both (4 of 11), so a tie points to older EPE.
 */
const tieRank = (layout: GeneLayout) => (layout.id === "epe-older" ? 1 : 0);

/**
 * One gene as Ruler Designer text. A template index we have no name for (a patch or mod we don't
 * know yet) becomes the gene's first template, and the gene is added to `unknown`.
 */
function geneLine(
  layout: GeneLayout,
  gene: string,
  [a, b, c, d]: Bytes,
  { pureBlooded }: ConvertOptions,
  unknown: string[],
) {
  if (pureBlooded) [c, d] = [a, b];
  if (layout.colours.includes(gene)) return `${gene}={ ${a} ${b} ${c} ${d} }`;
  const templates = templatesFor(layout, gene);
  const names = Object.keys(templates);
  const name = (index: number) => {
    const found = names.find((t) => templates[t] === index);
    if (!found && !unknown.includes(gene)) unknown.push(gene);
    return found ?? names[0] ?? "undefined";
  };
  return `${gene}={ "${name(a)}" ${b} "${name(c)}" ${d} }`;
}

function unknownNote(genes: string[]) {
  const one = genes.length === 1;
  return `${one ? "One gene uses" : `${genes.length} genes use`} a shape we don’t know, probably from a newer game version or another mod, so ${one ? "it was" : "they were"} set to the default shape: ${genes.join(", ")}. Check ${one ? "it" : "them"} in the Ruler Designer.`;
}

const ENTRY = /([a-z0-9_]+)\s*=\s*\{([^{}]*)\}/gi;

/** The layout whose genes best match the ones in some Ruler Designer text. */
function closestLayout(names: Set<string>) {
  let best = VANILLA;
  let bestScore = Infinity;
  for (const layout of GENE_LAYOUTS) {
    const missing = layout.genes.filter((g) => !names.has(g)).length;
    const extra = [...names].filter((g) => !SPECIAL.has(g) && !layout.genes.includes(g)).length;
    if (missing + extra < bestScore) [best, bestScore] = [layout, missing + extra];
  }
  return best;
}

export function rulerDesignerToBase64(text: string, options: ConvertOptions = {}): Conversion {
  const entries = new Map<string, string[]>();
  for (const [, gene, body] of genesBlock(text).matchAll(ENTRY)) {
    const parts = body.trim().split(/\s+/);
    if (parts.length === 4) entries.set(gene, parts);
  }
  if (entries.size === 0) {
    return { ok: false, error: "We couldn’t find any genes. Check the whole Ruler Designer text was pasted." };
  }

  const chosen = chosenLayout(options.layout);
  const layout = chosen ?? closestLayout(new Set(entries.keys()));
  const missing = layout.genes.filter((gene) => !entries.has(gene));
  if (missing.length > layout.genes.length / 10) {
    return {
      ok: false,
      error: chosen
        ? `This is missing ${missing.length} of the genes ${layout.name} DNA needs. Pick another game or mod, or let us detect it.`
        : `This is missing ${missing.length} of the genes base64 DNA needs. Check the whole Ruler Designer text was pasted.`,
    };
  }

  const notes: string[] = [];
  const unknown: string[] = [];
  // Older converters wrote "undefined" for shapes they couldn't name; the original is lost.
  const unnamed: string[] = [];
  let binary = "";
  for (const gene of layout.genes) {
    const parts = entries.get(gene);
    let bytes: Bytes = [0, 0, 0, 0];
    if (parts) {
      const templates = templatesFor(layout, gene);
      bytes = parts.map((part) => {
        if (/^-?\d+(\.\d+)?$/.test(part)) return Math.max(0, Math.min(255, Math.round(Number(part))));
        const template = part.replace(/"/g, "");
        // Files give genes a face doesn't use (a human's dragon genes) an empty name: the default.
        if (template === "") return 0;
        const index = templates[template];
        if (index === undefined) {
          const list = template === "undefined" ? unnamed : unknown;
          if (!list.includes(gene)) list.push(gene);
        }
        return index ?? 0;
      }) as Bytes;
    }
    if (options.pureBlooded) [bytes[2], bytes[3]] = [bytes[0], bytes[1]];
    binary += String.fromCharCode(...bytes);
  }

  if (missing.length > 0) {
    const one = missing.length === 1;
    notes.push(`${one ? "One gene was" : `${missing.length} genes were`} missing, so ${one ? "it was" : "they were"} set to the default: ${missing.join(", ")}.`);
  }
  const dropped = [...entries.keys()].filter((gene) => !SPECIAL.has(gene) && !layout.genes.includes(gene));
  if (dropped.length > 0) {
    const one = dropped.length === 1;
    notes.push(
      `${one ? "One gene isn’t" : `${dropped.length} genes aren’t`} part of ${layout.name} DNA, probably from another mod, and ${one ? "was" : "were"} left out: ${dropped.slice(0, 8).join(", ")}${dropped.length > 8 ? "…" : ""}.`,
    );
  }
  if (unknown.length > 0) notes.push(unknownNote(unknown));
  if (unnamed.length > 0) {
    const one = unnamed.length === 1;
    notes.push(
      `${unnamed.join(", ")} ${one ? "has" : "have"} no shape name (written as “undefined”, usually by an older converter), so the default shape was used. Check ${one ? "it" : "them"} in the Ruler Designer.`,
    );
  }
  if (entries.has("beards") || entries.has("hairstyles")) {
    notes.push("Base64 DNA doesn’t include the beard or hairstyle, so those are left out.");
  }
  return {
    ok: true,
    from: "ruler_designer",
    output: btoa(binary),
    layout: { id: layout.id, name: layout.name, detected: !chosen },
    alternatives: [],
    notes,
  };
}
