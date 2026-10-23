import type { Sex, Sort } from './api.ts';

type URLSearchParamsReader = Pick<URLSearchParams, 'get'>;

export interface Filters {
	sex?: Sex;
	mods: string[];
	sort: Sort;
	q: string;
}

/** Filters live in the page URL so they survive reloads and can be shared. */
export function readFilters(url: { searchParams: URLSearchParamsReader }): Filters {
	const sex = url.searchParams.get('sex');
	return {
		sex: sex === 'male' || sex === 'female' ? sex : undefined,
		mods: url.searchParams.get('mods')?.split(',').filter(Boolean) ?? [],
		sort: url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest',
		q: url.searchParams.get('q') ?? ''
	};
}

export function filtersToParams(filters: Filters) {
	const params = new URLSearchParams();
	if (filters.sex) params.set('sex', filters.sex);
	if (filters.mods.length > 0) params.set('mods', filters.mods.join(','));
	if (filters.sort !== 'newest') params.set('sort', filters.sort);
	if (filters.q) params.set('q', filters.q);
	return params;
}

/** API path for listing characters, optionally scoped to one author. */
export function characterListPath(filters: Filters, author?: string, cursor?: string) {
	const params = filtersToParams(filters);
	if (author) params.set('author', author);
	if (cursor) params.set('cursor', cursor);
	return `/api/characters?${params}`;
}
