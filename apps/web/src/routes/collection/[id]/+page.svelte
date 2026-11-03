<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { Lock } from '@lucide/svelte';
	import { AlertDialog } from 'bits-ui';
	import { apiErrorMessage } from '#lib/api.ts';
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import CollectionDialog, { type CollectionFields } from '#lib/components/CollectionDialog.svelte';
	import { button, dialogContent, overlay } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const collection = $derived(data.collection);
	const isOwner = $derived(data.user?.id === collection.owner_id);
	let count = $derived(collection.count);

	const reloadCollection = () => invalidate((url) => url.pathname === `/api/collections/${collection.id}`);

	let editing = $state(false);
	async function save(fields: CollectionFields) {
		const response = await fetch(`/api/collections/${collection.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(fields)
		});
		if (!response.ok) throw new Error(await apiErrorMessage(response));
		await reloadCollection();
	}

	// Out of this collection only: it stays in the owner's favourites.
	async function remove(id: string) {
		const response = await fetch(`/api/collections/${collection.id}/characters/${id}`, { method: 'DELETE' });
		if (!response.ok) throw new Error(await apiErrorMessage(response));
		count -= 1;
	}

	let confirmingDelete = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');
	async function deleteCollection() {
		deleting = true;
		deleteError = '';
		try {
			const response = await fetch(`/api/collections/${collection.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			await goto(`/user/${collection.owner_id}/collections`);
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Could not delete this collection.';
		} finally {
			deleting = false;
		}
	}
</script>

<Seo
	title="{collection.name}, a CK3 character collection · Helix Paradox"
	description={collection.description ||
		`${collection.count} Crusader Kings 3 characters collected by ${collection.owner_name}, each with DNA to copy.`}
	noindex={!collection.public || collection.count === 0}
/>

<header class="wrap flex flex-col gap-6 pt-16 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-24">
	<div>
		<p class="text-small text-muted">
			A collection by <a href="/user/{collection.owner_id}/collections" class="link">{collection.owner_name}</a>
		</p>
		<h1 class="mt-2 text-head">{collection.name}</h1>
		{#if collection.description}
			<p class="mt-4 max-w-[60ch] text-body whitespace-pre-line">{collection.description}</p>
		{/if}
		<p class="mt-4 flex items-center gap-2 text-small text-muted">
			{count}
			{count === 1 ? 'character' : 'characters'}
			{#if !collection.public}
				<span class="inline-flex items-center gap-1">· <Lock class="size-3.5" aria-hidden="true" /> Private: only you can see it</span>
			{:else if isOwner}
				<span>· Public: anyone with the link, and on your profile</span>
			{/if}
		</p>
	</div>
	{#if isOwner}
		<div class="flex gap-3">
			<button type="button" class={button('quiet')} onclick={() => (editing = true)}>Edit</button>
			<button type="button" class={button('quiet')} onclick={() => (confirmingDelete = true)}>Delete</button>
		</div>
	{/if}
</header>

<CharacterGrid
	initial={data.characters}
	mods={data.mods}
	scope={{ collection: collection.id }}
	onRemove={isOwner ? remove : undefined}
	emptyMessage={isOwner && count === 0
		? 'Nothing here yet. Use Add to collection on any character’s page.'
		: 'No characters match these filters.'}
/>

{#if isOwner}
	<CollectionDialog
		bind:open={editing}
		title="Edit collection"
		initial={{ name: collection.name, description: collection.description, public: collection.public }}
		onSave={save}
	/>

	<AlertDialog.Root bind:open={confirmingDelete}>
		<AlertDialog.Portal>
			<AlertDialog.Overlay class={overlay} />
			<AlertDialog.Content class={dialogContent}>
				<div class="space-y-3">
					<AlertDialog.Title class="text-lead font-semibold tracking-[-0.02em]">Delete {collection.name}?</AlertDialog.Title>
					<AlertDialog.Description class="text-body">
						The list goes; the characters in it stay in your favourites.
					</AlertDialog.Description>
					{#if deleteError}<p class="text-small text-danger">{deleteError}</p>{/if}
				</div>
				<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<AlertDialog.Cancel class={button('quiet')}>Keep it</AlertDialog.Cancel>
					<AlertDialog.Action class={button('danger')} disabled={deleting} onclick={deleteCollection}>
						Delete collection
					</AlertDialog.Action>
				</div>
			</AlertDialog.Content>
		</AlertDialog.Portal>
	</AlertDialog.Root>
{/if}
