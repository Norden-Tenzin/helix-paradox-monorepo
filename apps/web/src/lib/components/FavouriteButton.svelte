<script lang="ts">
	import { page } from '$app/state';
	import { Heart } from '@lucide/svelte';
	import { apiErrorMessage, type FavouriteState } from '#lib/api.ts';
	import { button } from '#lib/ui.ts';

	// Favouriting shows at once and is undone if the server says no. Signed out, the button is a
	// link to sign in that comes back here.
	let {
		id,
		count,
		favourited,
		signedIn
	}: { id: string; count: number; favourited: boolean; signedIn: boolean } = $props();

	let current = $derived<FavouriteState>({ favourited, favourite_count: count });
	let busy = $state(false);
	let error = $state('');

	async function toggle() {
		if (busy) return;
		const before = current;
		const next = !before.favourited;
		current = { favourited: next, favourite_count: Math.max(0, before.favourite_count + (next ? 1 : -1)) };
		busy = true;
		error = '';
		try {
			const response = await fetch(`/api/characters/${id}/favourite`, { method: next ? 'PUT' : 'DELETE' });
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			current = await response.json();
		} catch (err) {
			current = before;
			error = err instanceof Error ? err.message : 'That didn’t save. Try again.';
		} finally {
			busy = false;
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
