import { error } from '@sveltejs/kit';
import { sitemapIndex } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const response = await fetch('/api/sitemap');
	if (!response.ok) error(502, 'Sitemap unavailable');
	const { character_pages }: { character_pages: number } = await response.json();
	const files = ['/sitemaps/pages.xml', ...Array.from({ length: character_pages }, (_, i) => `/sitemaps/characters-${i + 1}.xml`)];
	return sitemapIndex(url.origin, files);
};
