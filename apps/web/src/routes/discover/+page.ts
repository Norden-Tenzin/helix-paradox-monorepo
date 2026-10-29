import { error } from '@sveltejs/kit';
import { apiErrorMessage, type DiscoverPage } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/api/discover', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{}'
	});
	if (!response.ok) error(response.status, await apiErrorMessage(response));
	const feed: DiscoverPage = await response.json();
	return { feed };
};
