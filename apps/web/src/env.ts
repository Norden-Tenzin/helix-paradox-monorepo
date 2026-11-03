import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_URL: {
		description:
			'Where to forward /api/* when the API service binding is unavailable (local dev runs the worker on :8787).',
		schema: (value) => value || 'http://localhost:8787'
	},
	WEB_ANALYTICS_TOKEN: {
		description:
			'Cloudflare Web Analytics token (Dashboard > Web Analytics > the site > Manage site > JS snippet). Empty turns the beacon off, as in local dev.',
		public: true,
		schema: (value) => value || ''
	},
	TURNSTILE_SITE_KEY: {
		description:
			'Cloudflare Turnstile site key for the sign-up check (set in wrangler.jsonc vars). Defaults to Turnstile’s always-pass test key for local dev.',
		public: true,
		schema: (value) => value || '1x00000000000000000000AA'
	}
});
