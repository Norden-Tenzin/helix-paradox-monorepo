<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { invalidateAll } from '$app/navigation';
	import { Dices, RefreshCw } from '@lucide/svelte';
	import { apiErrorMessage, type DiscoverPage } from '#lib/api.ts';
	import CharacterCard from '#lib/components/CharacterCard.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Starts again from the server's batch whenever the page reloads (Shuffle).
	let picks = $derived(data.feed.picks);
	let more = $derived(data.feed.more);
	let loading = $state(false);
	let loadError = $state('');

	async function loadMore() {
		loading = true;
		loadError = '';
		try {
			const response = await fetch('/api/discover', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seen: picks.map((p) => p.character.id) })
			});
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			const next: DiscoverPage = await response.json();
			picks = [...picks, ...next.picks];
			more = next.more;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not load more characters.';
		} finally {
			loading = false;
		}
	}
</script>

<Seo
	title="Discover CK3 characters · Helix Paradox"
	description="Crusader Kings 3 characters picked for you, a batch at a time. Favourite the faces you like and see more like them."
/>

<header class="wrap flex flex-col gap-6 pt-16 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-24">
	<div>
		<h1 class="text-head">Discover</h1>
		<p class="mt-4 max-w-[52ch] text-body">
			{#if data.user}
				Faces close to ones you’ve favourited, mixed with some picked at random. The more you favourite, the better it
				gets.
			{:else}
				Characters picked at random. Sign in and favourite a few, and it mixes in faces like the ones you liked.
			{/if}
		</p>
	</div>
	<div class="flex gap-3">
		<button type="button" class={button('quiet')} onclick={() => invalidateAll()}><RefreshCw /> Shuffle</button>
		<a href="/random" class={button('accent')} data-sveltekit-preload-data="off"><Dices /> Random character</a>
	</div>
</header>

<div class="wrap">
	{#if picks.length === 0}
		<p class="max-w-[36ch] py-24 text-lead">
			You’ve seen everything there is for now. <a href="/characters" class="link">Browse the library</a>
		</p>
	{:else}
		<div class="grid grid-cols-2 gap-x-4 gap-y-10 pt-2 pb-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
			{#each picks as { character, reason } (character.id)}
				<div>
					<CharacterCard chara={character} />
					<p class="mt-1 truncate text-small text-muted">
						{#if reason.kind === 'like'}
							Like <a href="/chara/{reason.id}" class="link">{reason.name}</a>, a favourite
						{:else}
							Picked at random
						{/if}
					</p>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex flex-col items-start gap-3 pb-24">
		{#if loadError}<p class="text-small text-danger">{loadError}</p>{/if}
		{#if more && picks.length > 0}
			<button onclick={loadMore} disabled={loading} class={button('quiet')}>{loading ? 'Loading…' : 'Show more'}</button>
		{/if}
	</div>
</div>
