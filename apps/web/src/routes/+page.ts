import { loadJson, type CharacterPage } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	return { latest: await loadJson<CharacterPage>(fetch, '/api/characters?limit=18') };
};
