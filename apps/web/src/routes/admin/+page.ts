import { loadJson, type ReportedCharacter } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	return { reported: await loadJson<ReportedCharacter[]>(fetch, '/api/admin/reports') };
};
