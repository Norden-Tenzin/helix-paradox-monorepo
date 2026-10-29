<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import type { Collection } from '#lib/api.ts';

	// A collection in a list: the latest portraits in it side by side, then its name and size.
	let { collection }: { collection: Collection } = $props();
</script>

<article class="group">
	<a
		href="/collection/{collection.id}"
		class="grid aspect-[4/3] grid-cols-2 gap-px overflow-hidden bg-surface"
		aria-label="{collection.name}, {collection.count} {collection.count === 1 ? 'character' : 'characters'}"
	>
		{#each { length: 4 } as _, i (i)}
			{#if collection.covers[i]}
				<img
					src={collection.covers[i]}
					alt=""
					loading="lazy"
					class="h-full w-full object-cover object-top transition-[scale] duration-300 ease-out group-hover:scale-[1.04]"
				/>
			{:else}
				<span class="bg-raised/40"></span>
			{/if}
		{/each}
	</a>
	<h3 class="mt-3 line-clamp-2 text-[1.125rem] leading-tight tracking-[-0.02em]">
		<a href="/collection/{collection.id}" class="hover:text-accent">{collection.name}</a>
	</h3>
	<p class="mt-1 flex items-center gap-2 text-small text-muted">
		{collection.count}
		{collection.count === 1 ? 'character' : 'characters'}
		{#if !collection.public}
			<span class="inline-flex items-center gap-1" title="Only you can see this collection">
				· <Lock class="size-3.5" aria-hidden="true" /> Private
			</span>
		{/if}
	</p>
</article>
