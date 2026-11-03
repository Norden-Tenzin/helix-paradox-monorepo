<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import ProfileTabs from '#lib/components/ProfileTabs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const total = $derived(data.characters.total);
</script>

<!-- Only its owner can see this list, so it's never in search results. -->
<Seo title="Your favourites · Helix Paradox" noindex />

<header class="wrap pt-16 pb-10 sm:pt-24">
	<h1 class="text-head">Your favourites</h1>
	<p class="mt-4 text-body">
		{total}
		{total === 1 ? 'character' : 'characters'}, newest favourite first. Only you can see this list.
	</p>
</header>

<ProfileTabs userId={data.user!.id} isMe />

<CharacterGrid
	initial={data.characters}
	mods={data.mods}
	scope={{ favourites: true }}
	emptyMessage="Nothing here yet. Press Favourite on any character to keep it here."
/>
