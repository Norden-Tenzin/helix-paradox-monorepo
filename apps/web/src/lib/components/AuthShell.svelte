<script lang="ts">
	import type { Snippet } from 'svelte';
	import ImageCredit from './ImageCredit.svelte';

	let { title, intro, children }: { title: string; intro: string; children: Snippet } = $props();
</script>

<!-- Fills the screen below the header, so the footer never starts partway up it. Side by side
     on wide landscape screens; otherwise the picture is a band on top and the form is centred
     in the space below. -->
<div class="grid min-h-[calc(100svh-4rem)] grid-rows-[auto_1fr] split:grid-cols-12 split:grid-rows-1">
	<div class="relative h-56 overflow-hidden bg-surface sm:h-72 split:col-span-6 split:h-auto">
		<img
			src="/images/bayeux-oath.jpg"
			alt="The Bayeux Tapestry: Harold swears an oath to Duke William with his hands on two reliquaries."
			width="2000"
			height="838"
			class="drift absolute inset-0 h-full w-full object-cover object-[48%_50%]"
		/>
		<ImageCredit href="https://commons.wikimedia.org/wiki/File:Bayeux_Tapestry_scene23_Harold_oath_William.jpg">
			Bayeux Tapestry, 1070s. Photo by Myrabella, public domain.
		</ImageCredit>
	</div>
	<!-- The form block is centred in its space (left-aligned inside), wide enough for the
	     longest heading ("Create an account") so it never leans towards one edge. -->
	<div class="wrap flex flex-col justify-center py-16 split:col-span-6 split:py-24">
		<div class="mx-auto w-full max-w-lg">
			<h1 class="text-head">{title}</h1>
			<p class="mt-4 max-w-[40ch] text-body">{intro}</p>
			<div class="mt-10">
				{@render children()}
			</div>
		</div>
	</div>
</div>
