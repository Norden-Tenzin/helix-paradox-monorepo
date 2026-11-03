import { error } from '@sveltejs/kit';
import { urlset, type SitemapUrl } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

type Updated = { id: string; updated_at: number | null };

// Pages that are always there and worth finding.
const FIXED = ['/', '/characters', '/discover', '/convert', '/terms', '/privacy'];

export const GET: RequestHandler = async ({ fetch, params, url }) => {
	const load = async <T>(path: string): Promise<T> => {
		const response = await fetch(path);
		if (!response.ok) error(502, 'Sitemap unavailable');
		return response.json();
	};

	if (params.file === 'pages.xml') {
		const { users, collections, mods } = await load<{ users: Updated[]; collections: Updated[]; mods: Updated[] }>(
			'/api/sitemap/pages'
		);
		const urls: SitemapUrl[] = [
			...FIXED.map((path) => ({ path })),
			...mods.map((m) => ({ path: `/characters?mods=${encodeURIComponent(m.id)}`, updated: m.updated_at })),
			...users.map((u) => ({ path: `/user/${u.id}`, updated: u.updated_at })),
			...collections.map((c) => ({ path: `/collection/${c.id}`, updated: c.updated_at }))
		];
		return urlset(url.origin, urls);
	}

	const page = /^characters-(\d+)\.xml$/.exec(params.file);
	if (!page || Number(page[1]) < 1) error(404, 'Not found');
	const characters = await load<Updated[]>(`/api/sitemap/characters/${Number(page[1]) - 1}`);
	if (characters.length === 0 && page[1] !== '1') error(404, 'Not found');
	return urlset(
		url.origin,
		characters.map((c) => ({ path: `/chara/${c.id}`, updated: c.updated_at }))
	);
};
