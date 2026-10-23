<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { button } from '#lib/ui.ts';

	let { images, alt }: { images: string[]; alt: string } = $props();

	let index = $state(0);
	const go = (delta: number) => (index = (index + delta + images.length) % images.length);
</script>

<div class="relative h-full w-full overflow-hidden" role="region" aria-roledescription="carousel">
	<div class="flex h-full transition-transform duration-300" style:transform="translateX(-{index * 100}%)">
		{#each images as img, i (i)}
			<div class="relative h-full w-full shrink-0" aria-hidden={i !== index}>
				<img src={img} {alt} class="h-full w-full object-contain" loading={i === 0 ? 'eager' : 'lazy'} />
			</div>
		{/each}
	</div>

	{#if images.length > 1}
		<button
			class="{button('secondary', 'icon')} absolute top-1/2 left-3 h-8 w-8 -translate-y-1/2 rounded-full"
			onclick={() => go(-1)}
			aria-label="Previous image"
		>
			<ChevronLeft />
		</button>
		<button
			class="{button('secondary', 'icon')} absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2 rounded-full"
			onclick={() => go(1)}
			aria-label="Next image"
		>
			<ChevronRight />
		</button>
	{/if}
</div>
