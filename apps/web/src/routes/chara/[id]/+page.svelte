<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import Carousel from '#lib/components/Carousel.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const character = $derived(data.character);

	let copied = $state(false);

	async function copyDna() {
		await navigator.clipboard.writeText(character.dna);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}
</script>

<svelte:head>
	<title>{character.name} · CK3 Helix</title>
</svelte:head>

<div class="flex min-h-[calc(100dvh-40px)] justify-center bg-background px-4 py-4">
	<div class="w-full max-w-5xl space-y-4">
		<!-- HERO CARD -->
		<div class="overflow-hidden bg-card shadow-sm">
			<div class="h-[45vh]">
				<Carousel images={[character.display_image, ...character.grid_images]} alt={character.name} />
			</div>
			<!-- META SECTION -->
			<div class="space-y-2 p-4">
				<div class="flex flex-wrap items-end justify-between gap-2">
					<h1 class="font-mono text-3xl font-bold tracking-tight">{character.name}</h1>
					<span class="text-sm text-muted-foreground">
						{new Date(character.posted_at).toLocaleDateString()}
					</span>
				</div>
				<a href="/user/{character.author_id}" class="inline-block text-sm font-medium text-primary hover:underline">
					@{character.author_name}
				</a>
				{#if character.mods.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each character.mods as mod (mod)}
							<Tag text={mod} />
						{/each}
					</div>
				{/if}
				{#if character.description}
					<p class="pt-2 text-sm whitespace-pre-line">{character.description}</p>
				{/if}
			</div>
		</div>

		<!-- DNA CARD -->
		<div class="flex flex-col">
			<p class="ps-4 font-mono text-base font-bold text-muted-foreground">DNA</p>
			<div class="group relative rounded-md bg-card shadow-sm">
				<!-- Sticky wrapper keeps the copy button in view without taking up space -->
				<div class="sticky top-12 z-10 h-0 w-full">
					<button
						class="{button('default', 'icon')} absolute top-2 right-2 opacity-30 transition-opacity group-hover:opacity-100 focus:opacity-100"
						onclick={copyDna}
						aria-label="Copy DNA"
					>
						{#if copied}<Check />{:else}<Copy />{/if}
					</button>
				</div>
				<pre class="overflow-x-auto overflow-y-hidden rounded-md p-4 text-xs leading-relaxed whitespace-pre">{character.dna}</pre>
			</div>
		</div>
	</div>
</div>
