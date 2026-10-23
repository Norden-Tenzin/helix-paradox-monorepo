import { createAuthClient } from 'better-auth/svelte';
import { usernameClient } from 'better-auth/client/plugins';

// Same-origin: /api/* is proxied to the API worker by hooks.server.ts.
export const authClient = createAuthClient({
	basePath: '/api/auth',
	plugins: [usernameClient()]
});
