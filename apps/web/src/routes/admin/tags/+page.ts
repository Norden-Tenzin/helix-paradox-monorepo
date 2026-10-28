import { loadJson, type AdminTag } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const q = url.searchParams.get('q') ?? '';
	return { q, tags: await loadJson<AdminTag[]>(fetch, `/api/admin/tags?q=${encodeURIComponent(q)}`) };
};
