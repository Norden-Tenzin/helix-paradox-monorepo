<script lang="ts" module>
	// Cloudflare Turnstile, the "are you a person" check on sign-up. Loads Cloudflare's script once
	// (allowed by the CSP in vite.config.ts) and renders the widget explicitly.
	interface TurnstileApi {
		render(el: HTMLElement, options: Record<string, unknown>): string;
		reset(id: string): void;
		remove(id: string): void;
	}

	let loading: Promise<TurnstileApi> | undefined;

	function loadTurnstile() {
		loading ??= new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
			script.onerror = () => {
				loading = undefined;
				reject(new Error('Turnstile failed to load'));
			};
			document.head.appendChild(script);
		});
		return loading;
	}
</script>

<script lang="ts">
	import { TURNSTILE_SITE_KEY } from '$app/env/public';

	/** The widget's token once it has passed, or '' while there isn't one. Each token works once. */
	let { token = $bindable(''), action }: { token?: string; action: string } = $props();

	let container: HTMLDivElement;
	let api: TurnstileApi | undefined;
	let widget: string | undefined;
	let failed = $state(false);

	$effect(() => {
		let gone = false;
		loadTurnstile()
			.then((turnstile) => {
				if (gone) return;
				api = turnstile;
				widget = turnstile.render(container, {
					sitekey: TURNSTILE_SITE_KEY,
					action,
					theme: 'auto',
					size: 'flexible',
					callback: (t: string) => (token = t),
					'expired-callback': () => (token = ''),
					'error-callback': () => {
						token = '';
					}
				});
			})
			.catch(() => (failed = true));
		return () => {
			gone = true;
			if (widget) api?.remove(widget);
		};
	});

	/** Gets a fresh token, for after one has been used. */
	export function reset() {
		token = '';
		if (widget) api?.reset(widget);
	}
</script>

<div bind:this={container} class="min-h-[65px]"></div>
{#if failed}
	<p class="text-small text-danger" role="alert">
		The “are you a person” check didn’t load. Turn off anything blocking challenges.cloudflare.com and reload.
	</p>
{/if}
