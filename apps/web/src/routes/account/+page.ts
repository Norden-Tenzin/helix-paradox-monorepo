import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
	const { user } = await parent();
	if (!user) redirect(303, `/sign-in?redirect=${encodeURIComponent(url.pathname)}`);
	return { me: user };
};
