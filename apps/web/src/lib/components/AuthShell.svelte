<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, intro, children }: { title: string; intro: string; children: Snippet } = $props();
</script>

<div class="grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12">
	<div class="relative h-56 overflow-hidden bg-surface sm:h-72 lg:col-span-6 lg:h-auto">
		<img
			src="/images/bayeux-oath.jpg"
			alt="The Bayeux Tapestry: Harold swears an oath to Duke William with his hands on two reliquaries."
			width="2000"
			height="838"
			class="drift absolute inset-0 h-full w-full object-cover object-[48%_50%]"
		/>
	</div>
	<div class="wrap flex flex-col justify-center py-16 lg:col-span-5 lg:col-start-8 lg:py-24">
		<h1 class="text-head">{title}</h1>
		<p class="mt-4 max-w-[40ch] text-body">{intro}</p>
		<div class="mt-10 max-w-md">
			{@render children()}
		</div>
	</div>
</div>
