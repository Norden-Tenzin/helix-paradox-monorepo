import { loadJson, type CharacterPage, type Mod, type TagSummary } from '#lib/api.ts';
import { characterListPath, readFilters } from '#lib/filters.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const [characters, mods, popularTags] = await Promise.all([
		loadJson<CharacterPage>(fetch, characterListPath(readFilters(url))),
		loadJson<Mod[]>(fetch, '/api/mods'),
		loadJson<TagSummary[]>(fetch, '/api/tags?limit=16')
	]);
	return { characters, mods, popularTags };
};
