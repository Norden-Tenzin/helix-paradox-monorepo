<script lang="ts">
	import { page } from '$app/state';
	import { Check, FolderPlus, Plus } from '@lucide/svelte';
	import { DropdownMenu } from 'bits-ui';
	import { apiErrorMessage, type CollectionChoice } from '#lib/api.ts';
	import { button, menuContent, menuItem } from '#lib/ui.ts';
	import CollectionDialog, { type CollectionFields } from './CollectionDialog.svelte';

	// "Add to collection" on a character's page. Your collections load when the menu opens, each
	// ticked if it holds this character; adding also favourites it (collections hold favourites),
	// so the page's Favourite button is told. Signed out, it's a link to sign in.
	let {
		id,
		name,
		signedIn,
		onFavourited
	}: { id: string; name: string; signedIn: boolean; onFavourited?: () => void } = $props();

	let choices = $state<CollectionChoice[] | null>(null);
	let error = $state('');

	async function loadChoices() {
		error = '';
		try {
			const response = await fetch(`/api/collections/mine?character=${encodeURIComponent(id)}`);
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			choices = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Couldn’t load your collections.';
		}
	}

	// Ticks at once and is undone if the server says no.
	async function toggle(choice: CollectionChoice) {
		const adding = !choice.has;
		choice.has = adding;
		error = '';
		try {
			const response = await fetch(`/api/collections/${choice.id}/characters/${id}`, { method: adding ? 'PUT' : 'DELETE' });
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			if (adding) onFavourited?.();
		} catch (err) {
			choice.has = !adding;
			error = err instanceof Error ? err.message : 'That didn’t save. Try again.';
		}
	}

	let creating = $state(false);

	async function create(fields: CollectionFields) {
		const response = await fetch('/api/collections', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...fields, character: id })
		});
		if (!response.ok) throw new Error(await apiErrorMessage(response));
		onFavourited?.();
		choices = null;
	}

	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);
</script>

{#if !signedIn}
	<a href={signInHref} class={button('quiet')} title="Sign in to keep characters in collections">
		<FolderPlus /> Add to collection
	</a>
{:else}
	<DropdownMenu.Root onOpenChange={(open) => open && loadChoices()}>
		<DropdownMenu.Trigger class={button('quiet')}><FolderPlus /> Add to collection</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content align="start" sideOffset={8} class="{menuContent} max-h-80 overflow-y-auto">
				{#if choices === null && !error}
					<p class="px-3 py-2.5 text-small text-muted">Loading…</p>
				{:else if choices}
					{#each choices as choice (choice.id)}
						<DropdownMenu.CheckboxItem
							class={menuItem}
							checked={choice.has}
							closeOnSelect={false}
							onCheckedChange={() => toggle(choice)}
						>
							<span class="grid size-4 place-items-center">{#if choice.has}<Check class="size-4" />{/if}</span>
							<span class="truncate">{choice.name}</span>
						</DropdownMenu.CheckboxItem>
					{/each}
				{/if}
				{#if error}<p class="px-3 py-2.5 text-small text-danger" role="alert">{error}</p>{/if}
				<DropdownMenu.Item class={menuItem} onSelect={() => (creating = true)}>
					<Plus class="size-4" /> New collection…
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>

	<CollectionDialog
		bind:open={creating}
		title="New collection"
		note="{name} goes in it, and into your favourites."
		submitLabel="Create"
		onSave={create}
	/>
{/if}
