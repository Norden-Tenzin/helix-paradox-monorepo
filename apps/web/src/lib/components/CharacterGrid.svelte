<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronDown, Search } from '@lucide/svelte';
	import { DropdownMenu } from 'bits-ui';
	import { apiErrorMessage, MODS, type CharacterPage, type Sex, type Sort } from '#lib/api.ts';
	import { characterListPath, filtersToParams, readFilters, type Filters } from '#lib/filters.ts';
	import { button, input, menuContent, menuItem } from '#lib/ui.ts';
	import CharacterCard from './CharacterCard.svelte';
	import Spinner from './Spinner.svelte';

	let {
		initial,
		authorId,
		isOwner = false,
		onDelete
	}: {
		initial: CharacterPage;
		authorId?: string;
		isOwner?: boolean;
		onDelete?: (id: string) => Promise<void>;
	} = $props();

	const filters = $derived(readFilters(page.url));

	// Reset to the server-loaded page whenever the filters (and therefore `initial`) change.
	let results = $derived(initial.page);
	let cursor = $derived(initial.nextCursor);
	let loadingMore = $state(false);
	let loadError = $state('');

	let searchText = $derived(filters.q);

	function applyFilters(next: Partial<Filters>) {
		const params = filtersToParams({ ...filters, ...next });
		const query = params.size > 0 ? `?${params}` : '';
		goto(`${page.url.pathname}${query}`, { replace: true, reset: false });
	}

	const toggleSex = (sex: Sex) => applyFilters({ sex: filters.sex === sex ? undefined : sex });
	const toggleMod = (mod: string) =>
		applyFilters({
			mods: filters.mods.includes(mod) ? filters.mods.filter((m) => m !== mod) : [...filters.mods, mod]
		});
	const setSort = (sort: Sort) => applyFilters({ sort });
	const handleSearch = () => applyFilters({ q: searchText.trim() });

	async function loadMore() {
		if (!cursor) return;
		loadingMore = true;
		loadError = '';
		try {
			const response = await fetch(characterListPath(filters, authorId, cursor));
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			const next: CharacterPage = await response.json();
			results = [...results, ...next.page];
			cursor = next.nextCursor;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load more';
		} finally {
			loadingMore = false;
		}
	}

	async function handleDelete(id: string) {
		await onDelete?.(id);
		results = results.filter((c) => c.id !== id);
	}
</script>

<!-- Filter/Search bar -->
<div class="sticky top-12 z-20 flex flex-wrap items-center justify-between gap-2 bg-muted/50 p-2 backdrop-blur">
	<div class="flex w-full flex-row gap-2">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={button('secondary', 'sm')}>
				Filters <ChevronDown class="ml-1" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content align="start" sideOffset={4} class="{menuContent} w-48">
					<p class="px-3 py-1 text-sm font-bold text-muted-foreground">Sex</p>
					{#each ['male', 'female'] as const as sex (sex)}
						<DropdownMenu.CheckboxItem
							class="{menuItem} pl-8"
							checked={filters.sex === sex}
							onCheckedChange={() => toggleSex(sex)}
							closeOnSelect={false}
						>
							{#snippet children({ checked })}
								<span class="absolute left-2 flex size-3.5 items-center justify-center" aria-hidden="true">{checked ? '✓' : ''}</span>
								{sex === 'male' ? 'Male' : 'Female'}
							{/snippet}
						</DropdownMenu.CheckboxItem>
					{/each}
					<p class="mt-2 px-3 py-1 text-sm font-bold text-muted-foreground">Mods</p>
					{#each MODS as mod (mod)}
						<DropdownMenu.CheckboxItem
							class="{menuItem} pl-8"
							checked={filters.mods.includes(mod)}
							onCheckedChange={() => toggleMod(mod)}
							closeOnSelect={false}
						>
							{#snippet children({ checked })}
								<span class="absolute left-2 flex size-3.5 items-center justify-center" aria-hidden="true">{checked ? '✓' : ''}</span>
								{mod.toUpperCase()}
							{/snippet}
						</DropdownMenu.CheckboxItem>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={button('secondary', 'sm')}>
				Sort: {filters.sort === 'newest' ? 'Newest' : 'Oldest'} <ChevronDown class="ml-1" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content align="start" sideOffset={4} class="{menuContent} w-40">
					<DropdownMenu.Item class={menuItem} onSelect={() => setSort('newest')}>Newest</DropdownMenu.Item>
					<DropdownMenu.Item class={menuItem} onSelect={() => setSort('oldest')}>Oldest</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<form
			class="flex flex-1 gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				handleSearch();
			}}
		>
			<input
				class="{input} h-8"
				placeholder="Search by name or author..."
				aria-label="Search"
				bind:value={searchText}
			/>
			<button type="submit" class={button('default', 'sm')} aria-label="Search"><Search /></button>
		</form>
	</div>
</div>

<!-- Grid -->
<div class="flex flex-1 justify-center">
	{#if results.length === 0}
		<p class="mt-8 text-center text-muted-foreground">No characters found.</p>
	{:else}
		<div class="grid w-full max-w-5xl grid-cols-2 content-start gap-3 p-4 sm:grid-cols-4">
			{#each results as chara (chara.id)}
				<CharacterCard {chara} {isOwner} onDelete={handleDelete} />
			{/each}
		</div>
	{/if}
</div>

<!-- Load More -->
<div class="flex flex-col items-center gap-2 p-4 pb-8">
	{#if loadError}
		<p class="text-sm text-destructive">{loadError}</p>
	{/if}
	{#if loadingMore}
		<button disabled class={button('secondary')}>
			<Spinner class="mr-2 h-4 w-4 border-primary" />
			Loading...
		</button>
	{:else if cursor}
		<button onclick={loadMore} class={button('secondary')}>Load More</button>
	{/if}
</div>
