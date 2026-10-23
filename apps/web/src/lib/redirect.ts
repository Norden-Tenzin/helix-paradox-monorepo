/** Only allow same-site relative redirects after auth. */
export function safeRedirect(url: { searchParams: Pick<URLSearchParams, 'get'> }, fallback = '/') {
	const target = url.searchParams.get('redirect');
	return target && target.startsWith('/') && !target.startsWith('//') ? target : fallback;
}
