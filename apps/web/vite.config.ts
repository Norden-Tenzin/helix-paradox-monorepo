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
			adapter: adapter()
		})
	]
});
