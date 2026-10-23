import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_URL: {
		description:
			'Where to forward /api/* when the API service binding is unavailable (local dev runs the worker on :8787).',
		schema: (value) => value || 'http://localhost:8787'
	}
});
