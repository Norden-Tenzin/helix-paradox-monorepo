<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ href: '/admin', label: 'Reports' },
		{ href: '/admin/mods', label: 'Mods' },
		{ href: '/admin/tags', label: 'Tags' }
	];
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<header class="wrap pt-16 pb-6 sm:pt-24">
	<h1 class="text-head">Admin</h1>
</header>
<nav class="wrap mb-10 flex gap-6 text-body" aria-label="Admin">
	{#each tabs as tab (tab.href)}
		<a href={tab.href} class="nav-link" aria-current={page.url.pathname === tab.href ? 'page' : undefined}>{tab.label}</a>
	{/each}
</nav>

<div class="wrap pb-24">
	{@render children()}
</div>
