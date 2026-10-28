import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

// Admin pages don't exist for anyone else.
export const load: LayoutLoad = async ({ parent }) => {
	const { user } = await parent();
	if (!user?.admin) error(404, 'Not found');
	return {};
};
