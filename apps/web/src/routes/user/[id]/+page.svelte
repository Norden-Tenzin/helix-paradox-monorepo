<script lang="ts">
	import { apiErrorMessage } from '#lib/api.ts';
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isMyProfile = $derived(data.user?.id === data.profile.id);
	let count = $derived(data.profile.character_count);

	async function handleDelete(id: string) {
		const response = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
		if (!response.ok) throw new Error(await apiErrorMessage(response));
		count -= 1;
	}
</script>

<svelte:head>
	<title>{data.profile.name} · Helix Paradox</title>
</svelte:head>

<header class="wrap flex flex-col gap-6 pt-16 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-24">
	<div>
		<h1 class="text-head">{isMyProfile ? 'Your characters' : data.profile.name}</h1>
		<p class="mt-4 text-body">
			{#if isMyProfile}Signed in as {data.profile.name}. {/if}{count}
			{count === 1 ? 'character' : 'characters'} shared.
		</p>
	</div>
	{#if isMyProfile}
		<a href="/upload" class={button('accent')}>Share a character</a>
	{/if}
</header>

<CharacterGrid
	initial={data.characters}
	authorId={data.profile.id}
	isOwner={isMyProfile}
	onDelete={handleDelete}
	emptyMessage={isMyProfile ? "You haven't shared a character yet." : 'Nothing shared yet.'}
/>
