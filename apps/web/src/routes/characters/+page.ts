import { loadJson, type CharacterPage, type Mod } from '#lib/api.ts';
import { characterListPath, readFilters } from '#lib/filters.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const [characters, mods] = await Promise.all([
		loadJson<CharacterPage>(fetch, characterListPath(readFilters(url))),
		loadJson<Mod[]>(fetch, '/api/mods')
	]);
	return { characters, mods };
};
