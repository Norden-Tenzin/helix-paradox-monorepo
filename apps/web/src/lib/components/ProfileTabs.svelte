<script lang="ts">
	import { page } from '$app/state';

	// Your own profile has two lists: what you shared and what you favourited. Favourites are
	// private, so only you see these tabs.
	let { userId }: { userId: string } = $props();

	const tabs = $derived([
		{ href: `/user/${userId}`, label: 'Shared' },
		{ href: `/user/${userId}/favourites`, label: 'Favourites' }
	]);
</script>

<nav class="wrap mb-8 flex gap-6 text-body" aria-label="Your lists">
	{#each tabs as tab (tab.href)}
		<a href={tab.href} class="nav-link" aria-current={page.url.pathname === tab.href ? 'page' : undefined}>
			{tab.label}
		</a>
	{/each}
</nav>
