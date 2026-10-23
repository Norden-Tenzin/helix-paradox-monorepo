<script lang="ts">
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>The library · Helix Paradox</title>
</svelte:head>

<header class="wrap pt-16 pb-10 sm:pt-24">
	<h1 class="text-head">The library</h1>
	<p class="mt-4 max-w-[52ch] text-body">
		{data.characters.total}
		{data.characters.total === 1 ? 'character' : 'characters'} from Crusader Kings III, each with the DNA to copy into
		the Ruler Designer.
	</p>
</header>

<CharacterGrid initial={data.characters} />
