import { loadJson, type CharacterPage } from '#lib/api.ts';
import { characterListPath, readFilters } from '#lib/filters.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	return { characters: await loadJson<CharacterPage>(fetch, characterListPath(readFilters(url))) };
};
