<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { page } from '$app/state';
	import { Dices } from '@lucide/svelte';
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The library filtered to one mod and nothing else is its own page in search results
	// ("AGOT character DNA"); every other filter or sort combination points at the plain library.
	const modPage = $derived.by(() => {
		const params = [...page.url.searchParams.keys()];
		const only = page.url.searchParams.get('mods');
		if (params.length !== 1 || !only || only.includes(',')) return null;
		return data.mods.find((m) => m.id === only) ?? null;
	});
</script>

<Seo
	title={modPage ? `${modPage.name} character DNA for CK3 · Helix Paradox` : 'CK3 character DNA library · Helix Paradox'}
	description={modPage
		? `${data.characters.total} Crusader Kings 3 characters made with ${modPage.name}, each with DNA to paste into the Ruler Designer.`
		: `Browse ${data.characters.total} Crusader Kings 3 characters, each with DNA to copy into the Ruler Designer. Filter by mod, sex, height, build and tags.`}
	canonical={modPage ? `/characters?mods=${encodeURIComponent(modPage.id)}` : '/characters'}
/>

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
