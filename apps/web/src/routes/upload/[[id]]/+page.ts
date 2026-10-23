import { error, redirect } from '@sveltejs/kit';
import { loadJson, type Character } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params, fetch, url }) => {
	const { user } = await parent();
	if (!user) redirect(303, `/sign-up?redirect=${encodeURIComponent(url.pathname)}`);

	if (!params.id) return { existing: null };
	const existing = await loadJson<Character>(fetch, `/api/characters/${encodeURIComponent(params.id)}`);
	if (existing.author_id !== user.id) error(403, 'You can only edit your own characters');
	return { existing };
};
