import { loadJson, type CharacterPage, type Collection, type Mod } from '#lib/api.ts';
import { characterListPath, readFilters } from '#lib/filters.ts';
import type { PageLoad } from './$types';

// A private collection is "not found" to anyone but its owner (the API says so).
export const load: PageLoad = async ({ fetch, params, url }) => {
	const [collection, characters, mods] = await Promise.all([
		loadJson<Collection>(fetch, `/api/collections/${encodeURIComponent(params.id)}`),
		loadJson<CharacterPage>(fetch, characterListPath(readFilters(url), { collection: params.id })),
		loadJson<Mod[]>(fetch, '/api/mods')
	]);
	return { collection, characters, mods };
};
