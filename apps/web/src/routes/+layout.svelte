<script lang="ts">
	import './layout.css';
	import { navigating, page } from '$app/state';
	import Footer from '#lib/components/Footer.svelte';
	import Navbar from '#lib/components/Navbar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// The home page lays out its own hero and <main>.
	const isHome = $derived(page.url.pathname === '/');

	// A bar along the top while a page loads, once it's taken long enough to notice (quick
	// switches don't flicker).
	const busy = $derived(!!navigating.to);
	let slow = $state(false);
	$effect(() => {
		if (!busy) return;
		const timer = setTimeout(() => (slow = true), 150);
		return () => {
			clearTimeout(timer);
			slow = false;
		};
	});
</script>

<svelte:head>
	<title>Helix Paradox</title>
	<meta name="description" content="Share and copy character DNA from Paradox games, starting with Crusader Kings III." />
	<meta property="og:site_name" content="Helix Paradox" />
	<!-- Character pages share their portrait instead; scrapers take the first og:image they see. -->
	{#if page.route.id !== '/chara/[id]'}
		<meta property="og:image" content={new URL('/images/bayeux-comet.jpg', page.url.origin).href} />
	{/if}
</svelte:head>

{#if slow}
	<div class="loading-bar" role="progressbar" aria-label="Loading page"></div>
{/if}
<Navbar user={data.user} />
{#if isHome}
	{@render children()}
{:else}
	<main id="main" class="min-h-[70svh]">
		{@render children()}
	</main>
{/if}
<Footer />

<style>
	.loading-bar {
		position: fixed;
		inset-inline: 0;
		top: 0;
		z-index: 60;
		height: 2px;
		background: var(--accent);
		transform-origin: left;
		animation: loading 8s cubic-bezier(0.1, 0.7, 0.2, 1) forwards;
	}
	/* Creeps towards the end without reaching it; it goes when the page arrives. */
	@keyframes loading {
		from {
			scale: 0 1;
		}
		to {
			scale: 0.9 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.loading-bar {
			animation: none;
			scale: 1 1;
			opacity: 0.6;
		}
	}
</style>
