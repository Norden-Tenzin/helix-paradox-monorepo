import { error, redirect } from '@sveltejs/kit';
import { loadJson, type CharacterPage, type Mod } from '#lib/api.ts';
import { characterListPath, readFilters } from '#lib/filters.ts';
import type { PageLoad } from './$types';

// Favourites are private: only their owner can open this page.
export const load: PageLoad = async ({ parent, params, fetch, url }) => {
	const { user } = await parent();
	if (!user) redirect(303, `/sign-in?redirect=${encodeURIComponent(url.pathname)}`);
	if (user.id !== params.id) error(404, 'Not found');

	const [characters, mods] = await Promise.all([
		loadJson<CharacterPage>(fetch, characterListPath(readFilters(url), { favourites: true })),
		loadJson<Mod[]>(fetch, '/api/mods')
	]);
	return { characters, mods };
};
