<script lang="ts">
	// One place for each page's <head> search and sharing tags, so none are missing or doubled.
	// Every page renders one. Canonical defaults to the page's path without its query string: the
	// library's filter and sort combinations all point at the plain /characters (a page that wants
	// its query kept, like a per-mod library, passes its own).
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		noindex = false,
		canonical,
		image = '/images/bayeux-comet.jpg',
		imageAlt,
		type = 'website',
		largeImage = false,
		children
	}: {
		/** The whole <title>, brand included. */
		title: string;
		description?: string;
		/** Keep out of search results: pages with nothing to find, or that are private. */
		noindex?: boolean;
		/** Path (with query, if it matters) of the page search engines should index. */
		canonical?: string;
		image?: string;
		imageAlt?: string;
		type?: 'website' | 'article' | 'profile';
		/** Share previews show the picture large (character portraits). */
		largeImage?: boolean;
		children?: Snippet;
	} = $props();

	const url = $derived(new URL(canonical ?? page.url.pathname, page.url.origin).href);
	const imageUrl = $derived(new URL(image, page.url.origin).href);
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}
		<meta name="description" content={description} />
		<meta property="og:description" content={description} />
	{/if}
	{#if noindex}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={url} />
	{/if}
	<meta property="og:site_name" content="Helix Paradox" />
	<meta property="og:title" content={title} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={imageUrl} />
	{#if imageAlt}<meta property="og:image:alt" content={imageAlt} />{/if}
	<meta name="twitter:card" content={largeImage ? 'summary_large_image' : 'summary'} />
	{@render children?.()}
</svelte:head>
