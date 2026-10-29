<script lang="ts">
	import { page } from '$app/state';

	// A profile's lists: what they shared and their public collections. On your own profile,
	// your favourites too, and your private collections; favourites are only ever yours to see.
	let { userId, isMe }: { userId: string; isMe: boolean } = $props();

	const tabs = $derived([
		{ href: `/user/${userId}`, label: 'Shared' },
		...(isMe ? [{ href: `/user/${userId}/favourites`, label: 'Favourites' }] : []),
		{ href: `/user/${userId}/collections`, label: 'Collections' }
	]);
</script>

<nav class="wrap mb-8 flex gap-6 text-body" aria-label={isMe ? 'Your lists' : 'Their lists'}>
	{#each tabs as tab (tab.href)}
		<a href={tab.href} class="nav-link" aria-current={page.url.pathname === tab.href ? 'page' : undefined}>
			{tab.label}
		</a>
	{/each}
</nav>
