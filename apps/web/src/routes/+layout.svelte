<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import Footer from '#lib/components/Footer.svelte';
	import Navbar from '#lib/components/Navbar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// The home page lays out its own hero and <main>.
	const isHome = $derived(page.url.pathname === '/');
</script>

<svelte:head>
	<title>Helix Paradox</title>
	<meta name="description" content="Share and copy character DNA from Paradox games, starting with Crusader Kings III." />
	<meta property="og:site_name" content="Helix Paradox" />
	<meta property="og:image" content="/images/bayeux-comet.jpg" />
</svelte:head>

<Navbar user={data.user} />
{#if isHome}
	{@render children()}
{:else}
	<main id="main" class="min-h-[70svh]">
		{@render children()}
	</main>
{/if}
<Footer />
