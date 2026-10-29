import { loadJson, type Collection, type PublicUser } from '#lib/api.ts';
import type { PageLoad } from './$types';

// Someone's public collections; on your own profile, your private ones too.
export const load: PageLoad = async ({ fetch, params }) => {
	const id = encodeURIComponent(params.id);
	const [profile, collections] = await Promise.all([
		loadJson<PublicUser>(fetch, `/api/users/${id}`),
		loadJson<Collection[]>(fetch, `/api/collections?user=${id}`)
	]);
	return { profile, collections };
};
