// Sitemap XML for search engines (sitemaps.org). /sitemap.xml is an index of the files below it:
// /sitemaps/pages.xml (the fixed pages, profiles, collections and per-mod libraries) and
// /sitemaps/characters-N.xml (characters, up to 45,000 a file; the limit is 50,000).

export interface SitemapUrl {
	path: string;
	/** Milliseconds since 1970, when the page last changed. */
	updated?: number | null;
}

const escapeXml = (s: string) =>
	s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);

const lastmod = (ms?: number | null) => (ms ? `<lastmod>${new Date(ms).toISOString()}</lastmod>` : '');

function xml(body: string) {
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			// Crawlers fetch these often; an hour old is fine.
			'cache-control': 'public, max-age=3600'
		}
	});
}

export function urlset(origin: string, urls: SitemapUrl[]) {
	const entries = urls.map((u) => `<url><loc>${escapeXml(origin + u.path)}</loc>${lastmod(u.updated)}</url>`);
	return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`);
}

export function sitemapIndex(origin: string, paths: string[]) {
	const entries = paths.map((p) => `<sitemap><loc>${escapeXml(origin + p)}</loc></sitemap>`);
	return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>`);
}
