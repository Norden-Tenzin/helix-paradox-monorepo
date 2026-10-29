<script lang="ts">
	import { Dices } from '@lucide/svelte';
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>The library · Helix Paradox</title>
</svelte:head>

<header class="wrap flex flex-col gap-6 pt-16 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-24">
	<div>
		<h1 class="text-head">The library</h1>
		<p class="mt-4 max-w-[52ch] text-body">
			{data.characters.total}
			{data.characters.total === 1 ? 'character' : 'characters'} from Crusader Kings III, each with the DNA to copy into
			the Ruler Designer.
		</p>
	</div>
	<a href="/random" class={button('quiet')} data-sveltekit-preload-data="off"><Dices /> Random character</a>
</header>

<CharacterGrid initial={data.characters} mods={data.mods} popularTags={data.popularTags} />
