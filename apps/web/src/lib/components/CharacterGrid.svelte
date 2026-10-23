<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Search } from '@lucide/svelte';
	import { apiErrorMessage, MODS, type CharacterPage, type Sex } from '#lib/api.ts';
	import { characterListPath, filtersToParams, readFilters, type Filters } from '#lib/filters.ts';
	import { button, field } from '#lib/ui.ts';
	import CharacterCard from './CharacterCard.svelte';

	let {
		initial,
		authorId,
		isOwner = false,
		onDelete,
		emptyMessage = 'No characters match these filters.'
	}: {
		initial: CharacterPage;
		authorId?: string;
		isOwner?: boolean;
		onDelete?: (id: string) => Promise<void>;
		emptyMessage?: string;
	} = $props();

	const filters = $derived(readFilters(page.url));
	const filtered = $derived(!!(filters.sex || filters.mods.length || filters.q));

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

	const setSex = (sex: Sex | undefined) => applyFilters({ sex });
	const toggleMod = (mod: string) =>
		applyFilters({
			mods: filters.mods.includes(mod) ? filters.mods.filter((m) => m !== mod) : [...filters.mods, mod]
		});

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
			loadError = err instanceof Error ? err.message : 'Could not load more characters.';
		} finally {
			loadingMore = false;
		}
	}

	async function handleDelete(id: string) {
		await onDelete?.(id);
		results = results.filter((c) => c.id !== id);
	}

	const toggle =
		'h-10 px-4 text-small font-medium transition-colors aria-pressed:bg-ink aria-pressed:text-ground bg-surface text-ink hover:bg-raised';
	const sexOptions: { label: string; value: Sex | undefined }[] = [
		{ label: 'Anyone', value: undefined },
		{ label: 'Women', value: 'female' },
		{ label: 'Men', value: 'male' }
	];
</script>

<div class="wrap">
	<!-- Filters: plain toggles, all visible. -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<form
			class="flex w-full max-w-md"
			role="search"
			onsubmit={(e) => {
				e.preventDefault();
				applyFilters({ q: searchText.trim() });
			}}
		>
			<input class="{field} h-10" placeholder="Search by name or author" aria-label="Search" bind:value={searchText} />
			<button type="submit" class="{button('solid', 'sm')} w-12 px-0" aria-label="Search"><Search /></button>
		</form>

		<div class="flex flex-wrap gap-x-6 gap-y-3">
			<div class="flex gap-px" role="group" aria-label="Sex">
				{#each sexOptions as option (option.label)}
					<button type="button" class={toggle} aria-pressed={filters.sex === option.value} onclick={() => setSex(option.value)}>
						{option.label}
					</button>
				{/each}
			</div>
			<div class="flex gap-px" role="group" aria-label="Mods">
				{#each MODS as mod (mod)}
					<button type="button" class={toggle} aria-pressed={filters.mods.includes(mod)} onclick={() => toggleMod(mod)}>
						{mod === 'vanilla' ? 'Vanilla' : mod.toUpperCase()}
					</button>
				{/each}
			</div>
			<button
				type="button"
				class="{toggle} bg-transparent hover:bg-surface"
				onclick={() => applyFilters({ sort: filters.sort === 'newest' ? 'oldest' : 'newest' })}
			>
				{filters.sort === 'newest' ? 'Newest first' : 'Oldest first'}
			</button>
		</div>
	</div>

	<!-- Portraits -->
	{#if results.length === 0}
		<div class="py-32">
			<p class="max-w-[28ch] text-lead">{emptyMessage}</p>
			{#if filtered}
				<a href={page.url.pathname} class="link mt-4 inline-block text-body">Clear the filters</a>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-x-4 gap-y-10 pt-10 pb-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
			{#each results as chara (chara.id)}
				<CharacterCard {chara} {isOwner} onDelete={handleDelete} />
			{/each}
		</div>
	{/if}

	<div class="flex flex-col items-start gap-3 pb-24">
		{#if loadError}
			<p class="text-small text-danger">{loadError}</p>
		{/if}
		{#if cursor}
			<button onclick={loadMore} disabled={loadingMore} class={button('quiet')}>
				{loadingMore ? 'Loading…' : `Show more · ${initial.total - results.length} left`}
			</button>
		{/if}
	</div>
</div>
