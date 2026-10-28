import { redirect } from '@sveltejs/kit';
import { safeRedirect } from '#lib/redirect.ts';
import type { PageLoad } from './$types';

// The link in a verification email lands here. A good link has already signed the person in,
// so carry on to where they were going; a bad one comes back with ?error= to explain.
export const load: PageLoad = async ({ parent, url }) => {
	const { user } = await parent();
	const error = url.searchParams.get('error');
	if (user && !error) redirect(303, safeRedirect(url));
	return { error, redirectTo: safeRedirect(url) };
};
