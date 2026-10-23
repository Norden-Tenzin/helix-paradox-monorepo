import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { API_URL } from '$app/env/private';
import type { Me } from 'api/types';

/**
 * Forwards a request to the Hono API worker. Going through the site's own origin keeps
 * Better Auth cookies first-party, so no CORS or cross-site cookie setup is needed.
 */
const HOP_BY_HOP = [
	'host',
	'connection',
	'keep-alive',
	'expect',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'content-length'
];

async function callApi(event: RequestEvent, request: Request) {
	const url = new URL(request.url);
	const target = new URL(url.pathname + url.search, API_URL);

	const headers = new Headers(request.headers);
	// Hop-by-hop headers describe the client's connection to us, not ours to the API.
	// (Node's fetch rejects `expect`, which curl sends for large uploads.)
	for (const name of HOP_BY_HOP) headers.delete(name);
	headers.set('x-forwarded-host', event.url.host);
	headers.set('x-forwarded-proto', event.url.protocol.slice(0, -1));

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const forwarded = new Request(target, {
		method: request.method,
		headers,
		body: hasBody ? await request.arrayBuffer() : undefined,
		redirect: 'manual'
	});

	const binding = event.platform?.env?.API;
	if (binding && !dev) {
		const response = await binding.fetch(forwarded);
		// Re-wrap so headers are mutable further down the chain.
		return new Response(response.body, response);
	}

	// Node's fetch (dev) transparently decompresses the body but keeps the original
	// content-encoding/length headers, which would make the browser try to decode it twice.
	const response = await fetch(forwarded);
	const responseHeaders = new Headers(response.headers);
	responseHeaders.delete('content-encoding');
	responseHeaders.delete('content-length');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders
	});
}

async function getCurrentUser(event: RequestEvent): Promise<Me | null> {
	const cookie = event.request.headers.get('cookie');
	if (!cookie) return null;
	try {
		const request = new Request(new URL('/api/users/me', event.url), { headers: { cookie } });
		const response = await callApi(event, request);
		return response.ok ? await response.json() : null;
	} catch (err) {
		console.error('Failed to load session', err);
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/')) {
		try {
			return await callApi(event, event.request);
		} catch (err) {
			console.error('API proxy failed', err);
			return Response.json({ error: 'The API is unreachable. Try again in a moment.' }, { status: 502 });
		}
	}
	event.locals.user = await getCurrentUser(event);
	return resolve(event);
};
