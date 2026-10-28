import { loadJson, type AdminMod } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	return { mods: await loadJson<AdminMod[]>(fetch, '/api/admin/mods') };
};
