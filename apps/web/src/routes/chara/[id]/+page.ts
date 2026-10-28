import { loadJson, type Character } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const id = encodeURIComponent(params.id);
	// "More like this" is a nice-to-have: if it fails, the page still loads without it.
	const similar = fetch(`/api/characters/${id}/similar`)
		.then((r): Promise<Character[]> => (r.ok ? r.json() : Promise.resolve([])))
		.catch((): Character[] => []);
	const character = await loadJson<Character>(fetch, `/api/characters/${id}`);
	return { character, similar: await similar };
};
