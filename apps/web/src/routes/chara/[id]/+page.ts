import { loadJson, type Character } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	return { character: await loadJson<Character>(fetch, `/api/characters/${encodeURIComponent(params.id)}`) };
};
