<script lang="ts">
	import { geneLabel, parseDna } from '#lib/dna.ts';

	// A character's DNA drawn as a double strand: one bar per gene, the pair's first value
	// rising above the axis in gold and its second hanging below in ink.
	let {
		dna,
		interactive = false,
		animate = false,
		class: className = ''
	}: { dna: string; interactive?: boolean; animate?: boolean; class?: string } = $props();

	const genes = $derived(parseDna(dna));
	let active = $state<number | null>(null);

	const STEP = 10;
	const BAR = 6;
	const HALF = 96;
</script>

{#if genes.length > 0}
	<figure class="strand {className}" class:animate>
		<svg
			viewBox="0 0 {genes.length * STEP} {HALF * 2 + 8}"
			preserveAspectRatio="none"
			role="img"
			aria-label="DNA strand of {genes.length} genes"
			class="block h-full w-full"
			onpointerleave={() => (active = null)}
		>
			{#each genes as gene, i (i)}
				{@const up = Math.max(2, (gene.a / 255) * HALF)}
				{@const down = Math.max(2, (gene.b / 255) * HALF)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					class="gene"
					class:dim={active !== null && active !== i}
					style:--i={i}
					onpointerenter={interactive ? () => (active = i) : undefined}
				>
					<title>{geneLabel(gene.name)}: {gene.a} / {gene.b}</title>
					<rect x={i * STEP} y={HALF + 4 - up} width={BAR} height={up} fill="var(--accent)" />
					<rect x={i * STEP} y={HALF + 4} width={BAR} height={down} fill="var(--ink)" opacity="0.72" />
					{#if interactive}
						<rect x={i * STEP - 2} y="0" width={STEP} height={HALF * 2 + 8} fill="transparent" />
					{/if}
				</g>
			{/each}
		</svg>
		{#if interactive}
			<figcaption class="mt-3 flex min-h-[1.5em] items-baseline justify-between gap-4 text-small text-muted" aria-live="polite">
				{#if active !== null}
					<span class="text-ink">{geneLabel(genes[active].name)}</span>
					<span class="tabular-nums">{genes[active].a} / {genes[active].b}</span>
				{:else}
					<span>{genes.length} genes. Point at one to read it.</span>
				{/if}
			</figcaption>
		{/if}
	</figure>
{/if}

<style>
	.gene {
		transition: opacity 200ms var(--ease-out);
	}
	.gene.dim {
		opacity: 0.25;
	}
	/* The strand draws itself outward from the axis, gene by gene. */
	.animate .gene rect {
		transform-box: fill-box;
		animation: grow 800ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 9ms + 150ms);
	}
	.animate .gene rect:first-of-type {
		transform-origin: 50% 100%;
	}
	.animate .gene rect:nth-of-type(2) {
		transform-origin: 50% 0%;
	}
	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.animate .gene rect {
			animation: none;
		}
	}
</style>
