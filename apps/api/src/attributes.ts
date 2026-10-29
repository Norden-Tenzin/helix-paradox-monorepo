// Body attributes read from the DNA at upload: height and build, stored as the gene's 0–255
// value so the bands below can be retuned without a backfill. (Age isn't in the DNA: `gene_age`
// is how aging shows, not how old someone is.) Imported by the web app as "api/attributes".

import type { Gene } from "./dna";

export const HEIGHTS = ["short", "average", "tall"] as const;
export type Height = (typeof HEIGHTS)[number];

export const BUILDS = ["slim", "average", "heavy"] as const;
export type Build = (typeof BUILDS)[number];

/**
 * Gene values (0–255, about 127 for the average person) each band covers. The middle band is
 * roughly the spread the game gives randomly generated characters.
 */
const BANDS = { low: [0, 105], middle: [106, 149], high: [150, 255] } as const;

export const HEIGHT_RANGES: Record<Height, readonly [number, number]> = {
  short: BANDS.low,
  average: BANDS.middle,
  tall: BANDS.high,
};

export const BUILD_RANGES: Record<Build, readonly [number, number]> = {
  slim: BANDS.low,
  average: BANDS.middle,
  heavy: BANDS.high,
};

export const HEIGHT_LABELS: Record<Height, string> = { short: "Short", average: "Average", tall: "Tall" };
export const BUILD_LABELS: Record<Build, string> = { slim: "Slim", average: "Average", heavy: "Heavy" };

/**
 * Height (`gene_height`) and build (`gene_bs_body_type`, how much body fat) as the DNA sets them,
 * 0–255, or null where the DNA doesn't carry the gene. Uses the first strand: the one the game shows.
 */
export function bodyMeasures(genes: Gene[]) {
  const value = (name: string) => genes.find((g) => g.name === name)?.a ?? null;
  return { height: value("gene_height"), build: value("gene_bs_body_type") };
}

const bandOf = <K extends string>(ranges: Record<K, readonly [number, number]>, value: number | null) =>
  value === null ? null : ((Object.keys(ranges) as K[]).find((k) => value >= ranges[k][0] && value <= ranges[k][1]) ?? null);

export const heightBand = (value: number | null) => bandOf(HEIGHT_RANGES, value);
export const buildBand = (value: number | null) => bandOf(BUILD_RANGES, value);
