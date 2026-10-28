import type { ReportReason } from 'api/types';

/** What each report reason means, as people choosing one (and reviewing them) read it. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
	broken_dna: 'The DNA doesn’t work in the game',
	wrong_mods: 'It’s labelled with the wrong mods',
	duplicate: 'It’s a copy of another character',
	inappropriate: 'Inappropriate picture, name or description',
	other: 'Something else'
};
