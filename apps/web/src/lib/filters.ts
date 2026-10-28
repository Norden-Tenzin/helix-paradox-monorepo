import type { Sex, Sort } from './api.ts';

const SORTS: Sort[] = ['newest', 'popular', 'oldest'];

type URLSearchParamsReader = Pick<URLSearchParams, 'get'>;

export interface Filters {
	sex?: Sex;
	mods: string[];
	/** Tag slugs; characters must carry all of them. */
	tags: string[];
	sort: Sort;
	q: string;
}

/** Filters live in the page URL so they survive reloads and can be shared. */
export function readFilters(url: { searchParams: URLSearchParamsReader }): Filters {
	const sex = url.searchParams.get('sex');
	return {
		sex: sex === 'male' || sex === 'female' ? sex : undefined,
		mods: url.searchParams.get('mods')?.split(',').filter(Boolean) ?? [],
		tags: url.searchParams.get('tags')?.split(',').filter(Boolean) ?? [],
		sort: SORTS.find((s) => s === url.searchParams.get('sort')) ?? 'newest',
		q: url.searchParams.get('q') ?? ''
	};
}

export function filtersToParams(filters: Filters) {
	const params = new URLSearchParams();
	if (filters.sex) params.set('sex', filters.sex);
	if (filters.mods.length > 0) params.set('mods', filters.mods.join(','));
	if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
	if (filters.sort !== 'newest') params.set('sort', filters.sort);
	if (filters.q) params.set('q', filters.q);
	return params;
}

/** Which characters a list shows: everyone's, one author's, or the signed-in person's favourites. */
export type ListScope = { author: string } | { favourites: true } | undefined;

/** API path for listing characters in a scope. */
export function characterListPath(filters: Filters, scope?: ListScope, cursor?: string) {
	const params = filtersToParams(filters);
	if (scope && 'author' in scope) params.set('author', scope.author);
	if (scope && 'favourites' in scope) params.set('favourites', 'mine');
	if (cursor) params.set('cursor', cursor);
	return `/api/characters?${params}`;
}
