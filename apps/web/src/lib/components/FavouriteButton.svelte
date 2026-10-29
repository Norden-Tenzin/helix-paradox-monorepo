<script lang="ts">
	import { page } from '$app/state';
	import { Heart } from '@lucide/svelte';
	import { apiErrorMessage, type FavouriteState } from '#lib/api.ts';
	import { button } from '#lib/ui.ts';

	// Favouriting shows at once, however fast people click: each click flips what's shown, and
	// whatever is showing once a request finishes is what gets saved next. If the server says no,
	// it goes back to the last saved state. Signed out, the button is a link to sign in.
	let {
		id,
		count,
		favourited,
		signedIn
	}: { id: string; count: number; favourited: boolean; signedIn: boolean } = $props();

	// What the server last confirmed, and what's shown (and wanted).
	let saved = $derived<FavouriteState>({ favourited, favourite_count: count });
	let current = $derived<FavouriteState>({ favourited, favourite_count: count });
	let sending = false;
	let error = $state('');

	function toggle() {
		const next = !current.favourited;
		current = { favourited: next, favourite_count: Math.max(0, current.favourite_count + (next ? 1 : -1)) };
		error = '';
		if (!sending) sync();
	}

	async function sync() {
		sending = true;
		try {
			while (current.favourited !== saved.favourited) {
				const want = current.favourited;
				const response = await fetch(`/api/characters/${id}/favourite`, { method: want ? 'PUT' : 'DELETE' });
				if (!response.ok) throw new Error(await apiErrorMessage(response));
				saved = await response.json();
				// Clicked again meanwhile: keep showing that, with the server's count adjusted to match.
				current =
					current.favourited === saved.favourited
						? saved
						: { favourited: current.favourited, favourite_count: Math.max(0, saved.favourite_count + (current.favourited ? 1 : -1)) };
			}
		} catch (err) {
			current = saved;
			error = err instanceof Error ? err.message : 'That didn’t save. Try again.';
		} finally {
			sending = false;
		}
	}

	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);
</script>

{#snippet label()}
	<Heart class={current.favourited ? 'fill-current text-accent' : ''} />
	{current.favourited ? 'Favourited' : 'Favourite'}
	<span class="tabular-nums text-muted">{current.favourite_count}</span>
{/snippet}

{#if signedIn}
	<button type="button" class={button('quiet')} aria-pressed={current.favourited} onclick={toggle}>
		{@render label()}
	</button>
	{#if error}<p class="mt-2 text-small text-danger" role="alert">{error}</p>{/if}
{:else}
	<a href={signInHref} class={button('quiet')} title="Sign in to favourite characters">{@render label()}</a>
{/if}
