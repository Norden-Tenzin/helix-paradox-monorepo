<script lang="ts">
	import { goto } from '$app/navigation';
	import { apiErrorMessage } from '#lib/api.ts';
	import CollectionCard from '#lib/components/CollectionCard.svelte';
	import CollectionDialog, { type CollectionFields } from '#lib/components/CollectionDialog.svelte';
	import ProfileTabs from '#lib/components/ProfileTabs.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const isMe = $derived(data.user?.id === data.profile.id);
	let creating = $state(false);

	async function create(fields: CollectionFields) {
		const response = await fetch('/api/collections', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(fields)
		});
		if (!response.ok) throw new Error(await apiErrorMessage(response));
		const { id }: { id: string } = await response.json();
		await goto(`/collection/${id}`);
	}
</script>

<svelte:head>
	<title>{isMe ? 'Your collections' : `${data.profile.name}’s collections`} · Helix Paradox</title>
</svelte:head>

<header class="wrap flex flex-col gap-6 pt-16 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-24">
	<div>
		<h1 class="text-head">{isMe ? 'Your collections' : `${data.profile.name}’s collections`}</h1>
		<p class="mt-4 max-w-[52ch] text-body">
			{#if isMe}
				Named lists of your favourites. Private ones only you can see; public ones show here for everyone.
			{:else}
				{data.collections.length} {data.collections.length === 1 ? 'collection' : 'collections'}.
			{/if}
		</p>
	</div>
	{#if isMe}
		<button type="button" class={button('accent')} onclick={() => (creating = true)}>New collection</button>
	{/if}
</header>

<ProfileTabs userId={data.profile.id} {isMe} />

<div class="wrap pb-24">
	{#if data.collections.length === 0}
		<p class="max-w-[36ch] py-24 text-lead">
			{isMe
				? 'No collections yet. Start one here, or with Add to collection on any character.'
				: 'No public collections yet.'}
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-x-6 gap-y-10 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each data.collections as collection (collection.id)}
				<CollectionCard {collection} />
			{/each}
		</div>
	{/if}
</div>

{#if isMe}
	<CollectionDialog bind:open={creating} title="New collection" submitLabel="Create" onSave={create} />
{/if}
