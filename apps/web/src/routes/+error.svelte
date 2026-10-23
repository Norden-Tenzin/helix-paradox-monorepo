<script lang="ts">
	import { page } from '$app/state';
	import { button } from '#lib/ui.ts';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} · Helix Paradox</title>
</svelte:head>

<div class="wrap pt-24 pb-32 sm:pt-32">
	<p class="text-[clamp(6rem,24vw,20rem)] leading-[0.8] font-semibold tracking-[-0.06em] text-accent" aria-hidden="true">
		{page.status}
	</p>
	<h1 class="mt-10 max-w-[22ch] text-head">
		{notFound ? 'This character isn’t in the library' : 'Something went wrong'}
	</h1>
	<p class="mt-5 max-w-[52ch] text-body">
		{notFound
			? 'It may have been deleted by the person who shared it, or the link is mistyped.'
			: (page.error?.message ?? 'Try again in a moment.')}
	</p>
	<div class="mt-10 flex flex-wrap items-center gap-6">
		<a href="/characters" class={button('accent')}>Browse the library</a>
		<a href="/" class="link text-body">Go to the start</a>
	</div>
</div>
