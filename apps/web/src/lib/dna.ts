// DNA reading is shared with the API, which validates uploads with the same code.
export {
	MIN_GENES,
	REGIONS,
	geneLabel,
	geneRegion,
	parseDna,
	type Gene,
	type Region
} from 'api/dna';

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
