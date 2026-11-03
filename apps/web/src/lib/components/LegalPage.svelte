<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LEGAL_UPDATED } from '#lib/legal.ts';

	let { title, intro, children }: { title: string; intro: string; children: Snippet } = $props();
</script>

<!-- A long read: one narrow column at a comfortable measure, plain headings. -->
<article class="wrap pt-16 pb-24 sm:pt-24">
	<header class="max-w-[62ch]">
		<h1 class="text-head">{title}</h1>
		<p class="mt-4 text-lead">{intro}</p>
		<p class="mt-4 text-small text-muted">Last updated {LEGAL_UPDATED}.</p>
	</header>
	<div class="legal mt-14 max-w-[62ch] text-body">
		{@render children()}
	</div>
</article>

<style>
	.legal :global(h2) {
		margin-top: 3rem;
		font-size: var(--step-lead);
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	.legal :global(h2:first-child) {
		margin-top: 0;
	}
	.legal :global(p),
	.legal :global(ul) {
		margin-top: 1rem;
	}
	.legal :global(ul) {
		padding-left: 1.25rem;
		list-style: disc;
	}
	.legal :global(li + li) {
		margin-top: 0.5rem;
	}
	.legal :global(strong) {
		font-weight: 600;
	}
</style>
