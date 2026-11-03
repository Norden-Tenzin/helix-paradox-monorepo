import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	optimizeDeps: {
		// Pre-bundle up front; otherwise Vite discovers them on first use (e.g. the lazy
		// image compressor on submit) and force-reloads the page, wiping form state.
		include: ['bits-ui', 'better-auth/svelte', 'better-auth/client/plugins', 'browser-image-compression']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Content Security Policy for every page. SvelteKit adds a nonce for its own inline
			// scripts (and app.html's, via %sveltekit.nonce%). Everything else must come from here
			// or Cloudflare (Turnstile on sign-up, Web Analytics). Other headers are set in
			// hooks.server.ts and static/_headers.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					// Turnstile, and Cloudflare Web Analytics' beacon (+layout.svelte).
					'script-src': ['self', 'https://challenges.cloudflare.com', 'https://static.cloudflareinsights.com'],
					// Inline style attributes (style:prop, transitions) are part of how Svelte works.
					'style-src': ['self', 'unsafe-inline'],
					'font-src': ['self'],
					// Some older characters' pictures live on other hosts; blob: and data: are
					// previews of pictures being uploaded.
					'img-src': ['self', 'data:', 'blob:', 'https:'],
					'connect-src': ['self', 'https://cloudflareinsights.com'],
					'frame-src': ['https://challenges.cloudflare.com'],
					// The upload page shrinks pictures in a worker built from a blob: URL.
					'worker-src': ['self', 'blob:'],
					'frame-ancestors': ['self'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'object-src': ['none']
				}
			}
		})
	]
});
