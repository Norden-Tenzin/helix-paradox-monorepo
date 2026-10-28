<script lang="ts">
	import { REGIONS, geneLabel, geneRegion, parseDna } from '#lib/dna.ts';

	// A character's DNA, one bar pair per gene. Each gene is a pair of values (0–255): the first
	// rises above the axis, the second hangs below.
	//   bars  every gene in the order the game lists them, gold above and ink below
	//   map   the genes grouped by the part of the face they shape, each region braced and named,
	//         in a sequencing gel's dyes: the first value runs red to yellow, the second green to
	//         cyan, so colour repeats what the bar's length says. Set it on the gel's blue
	//         (.gel-ground in layout.css).
	let {
		dna,
		variant = 'bars',
		interactive = false,
		animate = false,
		class: className = ''
	}: {
		dna: string;
		variant?: 'bars' | 'map';
		interactive?: boolean;
		animate?: boolean;
		class?: string;
	} = $props();

	const genes = $derived(parseDna(dna));
	const n = $derived(genes.length);
	let active = $state<number | null>(null);

	const fraction = (v: number) => v / 255;
	const enter = (i: number) => (interactive ? () => (active = i) : undefined);

	// Both drawings share one coordinate system, stretched to the box.
	const STEP = 10;
	const BAR = 6;
	const HALF = 96;
	const HEIGHT = HALF * 2 + 8;
	const AXIS = HALF + 4;

	// Map: genes in face order, each region as wide as its gene count.
	const regions = $derived(
		REGIONS.map((name) => ({
			name,
			genes: genes.flatMap((gene, i) => (geneRegion(gene.name) === name ? [{ gene, i }] : []))
		})).filter((r) => r.genes.length > 0)
	);
	const activeRegion = $derived(active === null ? null : geneRegion(genes[active].name));
	const warm = (v: number) => `hsl(${4 + fraction(v) * 52} 95% 58%)`;
	const cool = (v: number) => `hsl(${135 + fraction(v) * 55} 85% 56%)`;

	// A curly brace under each region, drawn at the region's real pixel width so it never stretches.
	// Regions sit edge to edge, so each brace stops a little short of its region's sides.
	let braceWidths = $state<number[]>([]);
	const BRACE = 9;
	const bracePath = (w: number) => {
		const m = BRACE / 2;
		const [l, rt] = [2, w - 2];
		const r = Math.min(5, (rt - l) / 4);
		const c = w / 2;
		return `M${l} 0 Q${l} ${m} ${l + r} ${m} L${c - r} ${m} Q${c} ${m} ${c} ${BRACE} Q${c} ${m} ${c + r} ${m} L${rt - r} ${m} Q${rt} ${m} ${rt} 0`;
	};

	// Region names sit side by side until any two would touch at this width; then they all stand
	// vertical. Widths are measured from the names' own font, so it holds for any card size.
	let labelRow = $state(0);
	let labelEls = $state<HTMLElement[]>([]);
	let measurer: CanvasRenderingContext2D | null = null;
	const verticalLabels = $derived.by(() => {
		if (!labelRow || !labelEls[0]) return false;
		measurer ??= document.createElement('canvas').getContext('2d');
		if (!measurer) return false;
		measurer.font = getComputedStyle(labelEls[0]).font;
		let start = 0;
		let lastRight = -Infinity;
		for (const region of regions) {
			const centre = ((start + region.genes.length / 2) / n) * labelRow;
			const half = measurer.measureText(region.name).width / 2;
			if (centre - half < lastRight + 6) return true;
			lastRight = centre + half;
			start += region.genes.length;
		}
		return false;
	});
</script>

{#if n > 0}
	<figure class="strand flex flex-col {className}" class:animate>
		{#if variant === 'map'}
			<!-- Three rows sharing one set of column widths: the bars, all one height; the braces; the
			     names. A name may overhang its column but never widens it, so the bars keep their spacing. -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex min-h-0 min-w-0 flex-1 flex-col"
				role="img"
				aria-label="DNA of {n} genes, by part of the face"
				onpointerleave={() => (active = null)}
			>
				<div class="flex h-24 shrink-0">
					{#each regions as region (region.name)}
						<svg
							viewBox="0 0 {region.genes.length * STEP} {HEIGHT}"
							preserveAspectRatio="none"
							aria-hidden="true"
							class="block h-full min-w-0 basis-0"
							style:flex-grow={region.genes.length}
						>
							<line x1="0" x2={region.genes.length * STEP} y1={AXIS} y2={AXIS} class="axis" />
							{#each region.genes as { gene, i }, j (i)}
								{@const up = Math.max(2, fraction(gene.a) * HALF)}
								{@const down = Math.max(2, fraction(gene.b) * HALF)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g class="gene" class:dim={active !== null && active !== i} style:--i={i} onpointerenter={enter(i)}>
									<title>{geneLabel(gene.name)}: {gene.a} / {gene.b}</title>
									<rect class="grow-up" x={j * STEP + 2} y={AXIS - up} width={BAR} height={up} fill={warm(gene.a)} />
									<rect class="grow-down" x={j * STEP + 2} y={AXIS} width={BAR} height={down} fill={cool(gene.b)} />
									{#if interactive}
										<rect x={j * STEP} y="0" width={STEP} height={HEIGHT} fill="transparent" />
									{/if}
								</g>
							{/each}
						</svg>
					{/each}
				</div>
				<div class="mt-1.5 flex">
					{#each regions as region, k (region.name)}
						<div class="min-w-0 basis-0" style:flex-grow={region.genes.length} bind:clientWidth={braceWidths[k]}>
							<svg height={BRACE} class="block w-full overflow-visible" aria-hidden="true">
								{#if braceWidths[k]}
									<path d={bracePath(braceWidths[k])} class="brace" class:lit={activeRegion === region.name} />
								{/if}
							</svg>
						</div>
					{/each}
				</div>
				<div class="mt-1 flex" bind:clientWidth={labelRow}>
					{#each regions as region, k (region.name)}
						<div class="flex min-w-0 basis-0 items-start justify-center" style:flex-grow={region.genes.length}>
							<!-- Vertical names read bottom to top and hang from their brace. -->
							<span
								bind:this={labelEls[k]}
								class="text-[0.6875rem] leading-tight whitespace-nowrap {verticalLabels ? 'rotate-180 [writing-mode:vertical-rl]' : ''} {activeRegion === region.name ? 'text-ink' : 'text-muted'}"
							>
								{region.name}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<svg
				viewBox="0 0 {n * STEP} {HEIGHT}"
				preserveAspectRatio="none"
				role="img"
				aria-label="DNA strand of {n} genes"
				class="block min-h-0 w-full flex-1"
				onpointerleave={() => (active = null)}
			>
				{#each genes as gene, i (i)}
					{@const up = Math.max(2, fraction(gene.a) * HALF)}
					{@const down = Math.max(2, fraction(gene.b) * HALF)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g class="gene" class:dim={active !== null && active !== i} style:--i={i} onpointerenter={enter(i)}>
						<title>{geneLabel(gene.name)}: {gene.a} / {gene.b}</title>
						<rect class="grow-up" x={i * STEP} y={AXIS - up} width={BAR} height={up} fill="var(--accent)" />
						<rect class="grow-down" x={i * STEP} y={AXIS} width={BAR} height={down} fill="var(--ink)" opacity="0.72" />
						{#if interactive}
							<rect x={i * STEP - 2} y="0" width={STEP} height={HEIGHT} fill="transparent" />
						{/if}
					</g>
				{/each}
			</svg>
		{/if}
		{#if interactive}
			<figcaption
				class="{variant === 'map' ? 'mt-5' : 'mt-3'} flex min-h-[1.5em] items-baseline justify-between gap-4 text-small text-muted"
				aria-live="polite"
			>
				{#if active !== null}
					<span class="text-ink">{geneLabel(genes[active].name)}</span>
					<span class="tabular-nums">{genes[active].a} / {genes[active].b}</span>
				{:else}
					<span>{n} genes. Point at one to read it.</span>
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
	.axis {
		stroke: var(--ink);
		stroke-opacity: 0.2;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.brace {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1;
		stroke-linecap: round;
		transition: stroke 200ms var(--ease-out);
	}
	.brace.lit {
		stroke: var(--ink);
	}

	/* The strand draws itself outward from the axis, gene by gene. */
	.animate .gene > :is(.grow-up, .grow-down) {
		transform-box: fill-box;
		animation: grow 800ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 9ms + 150ms);
	}
	.animate .grow-up {
		transform-origin: 50% 100%;
	}
	.animate .grow-down {
		transform-origin: 50% 0%;
	}
	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.animate .gene > * {
			animation: none;
		}
	}
</style>
