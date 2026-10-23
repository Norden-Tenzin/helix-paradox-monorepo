// Reads Crusader Kings III DNA strings (Ruler Designer "Copy DNA" output).
//
//   ruler_designer_123={
//     genes={
//       hair_color={ 30 13 72 250 }
//       gene_chin_forward={ "chin_forward_pos" 136 "chin_forward_pos" 114 }
//       ...
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

export function parseDna(dna: string): Gene[] {
	const genes: Gene[] = [];
	for (const [, name, body] of dna.matchAll(GENE_PATTERN)) {
		const numbers = body.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
		if (numbers.length < 2) continue;
		const half = Math.floor(numbers.length / 2);
		genes.push({ name, a: clampByte(numbers[0]), b: clampByte(numbers[half]) });
	}
	return genes;
}

/** "gene_chin_forward" → "Chin forward" */
export function geneLabel(name: string) {
	const words = name.replace(/^gene_(bs_)?/, '').replace(/_/g, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** The first `lines` entries of a DNA string, one per line and indented by depth (game exports vary in layout). */
export function formatDnaPreview(dna: string, lines: number) {
	const TOKEN = /([a-z0-9_]+\s*=\s*\{[^{}]*\})|([a-z0-9_]+\s*=\s*\{)|(\})|([a-z0-9_]+\s*=\s*[^\s{}]+)/gi;
	let depth = 0;
	const out: string[] = [];
	for (const [, leaf, open, close, value] of dna.matchAll(TOKEN)) {
		if (close) depth = Math.max(0, depth - 1);
		const text = (leaf ?? open ?? close ?? value).replace(/\s+/g, ' ').replace(/\s*=\s*/, '=');
		out.push('  '.repeat(depth) + text);
		if (open) depth += 1;
		if (out.length >= lines) break;
	}
	return out.join('\n');
}
