import { redirect } from '@sveltejs/kit';
import { loadJson } from '#lib/api.ts';
import type { PageLoad } from './$types';

// The Random button: straight on to a character picked at random. Links here turn preloading
// off, so hovering doesn't pick one.
export const load: PageLoad = async ({ fetch }) => {
	const { id } = await loadJson<{ id: string }>(fetch, '/api/characters/random');
	redirect(307, `/chara/${id}`);
};
