import { loadJson, type CharacterPage, type Mod, type PublicUser } from '#lib/api.ts';
import { characterListPath, readFilters } from '#lib/filters.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
	const [profile, characters, mods] = await Promise.all([
		loadJson<PublicUser>(fetch, `/api/users/${encodeURIComponent(params.id)}`),
		loadJson<CharacterPage>(fetch, characterListPath(readFilters(url), { author: params.id })),
		loadJson<Mod[]>(fetch, '/api/mods')
	]);
	return { profile, characters, mods };
};
