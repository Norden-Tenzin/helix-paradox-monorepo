<script lang="ts">
	import './layout.css';
	import Footer from '#lib/components/Footer.svelte';
	import Navbar from '#lib/components/Navbar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>CK3 Helix</title>
	<meta name="description" content="Share Crusader Kings III character DNA and portraits." />
</svelte:head>

<div>
	<Navbar user={data.user} />
	{@render children()}
</div>
<Footer />
