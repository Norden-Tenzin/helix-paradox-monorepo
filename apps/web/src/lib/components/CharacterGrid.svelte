<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { Search } from '@lucide/svelte';
	import { apiErrorMessage, type CharacterPage, type Mod, type Sex, type Sort, type TagSummary } from '#lib/api.ts';
	import { BASE_MOD } from 'api/games';
	import { characterListPath, filtersToParams, readFilters, type Filters, type ListScope } from '#lib/filters.ts';
	import { button, field } from '#lib/ui.ts';
	import CharacterCard from './CharacterCard.svelte';

	let {
		initial,
		mods,
		popularTags = [],
		scope,
		isOwner = false,
		onDelete,
		onRemove,
		emptyMessage = 'No characters match these filters.'
	}: {
		initial: CharacterPage;
		/** The mods to offer as filters (GET /api/mods). */
		mods: Mod[];
		/** Most-used tags to offer as filters (GET /api/tags). */
		popularTags?: TagSummary[];
		/** Whose characters these are; matches what the page loaded `initial` with. */
		scope?: ListScope;
		isOwner?: boolean;
		onDelete?: (id: string) => Promise<void>;
		/** Offers "Remove" on each card (a collection's owner taking it out of the collection). */
		onRemove?: (id: string) => Promise<void>;
		emptyMessage?: string;
	} = $props();

	// A filter click shows at once: while the new results load, the toggles show the filters being
	// loaded and the portraits make way for placeholders. Clicks in quick succession build on each
	// other, since each starts from what's shown.
	const loading = $derived(!!navigating.to && navigating.to.url.pathname === page.url.pathname);
	const filters = $derived(readFilters(loading ? navigating.to!.url : page.url));
	const filtered = $derived(!!(filters.sex || filters.mods.length || filters.tags.length || filters.q));

	// Active tags first (even ones too rare to be popular, e.g. arrived at from a character's
	// page), then the popular ones.
	const tagChips = $derived([
		...filters.tags.map((id) => ({ id, name: popularTags.find((t) => t.id === id)?.name ?? id.replace(/-/g, ' ') })),
		...popularTags.filter((t) => !filters.tags.includes(t.id))
	]);

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
	// Mods combine (EPE + CFP: made with both), but the base game stands alone, as on the upload
	// form: no character is both unmodded and modded.
	function toggleMod(mod: string) {
		const on = filters.mods.includes(mod);
		if (mod === BASE_MOD) return applyFilters({ mods: on ? [] : [BASE_MOD] });
		const others = filters.mods.filter((m) => m !== BASE_MOD);
		applyFilters({ mods: on ? others.filter((m) => m !== mod) : [...others, mod] });
	}

	const toggleTag = (tag: string) =>
		applyFilters({
			tags: filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag]
		});

	async function loadMore() {
		if (!cursor) return;
		loadingMore = true;
		loadError = '';
		try {
			// The filters the shown results were loaded with.
			const response = await fetch(characterListPath(readFilters(page.url), scope, cursor));
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			const next: CharacterPage = await response.json();
			// Popular order can shift while someone scrolls (a favourite lands between pages), so a
			// character may come round twice; show it once.
			const seen = new Set(results.map((c) => c.id));
			results = [...results, ...next.page.filter((c) => !seen.has(c.id))];
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

	async function handleRemove(id: string) {
		await onRemove?.(id);
		results = results.filter((c) => c.id !== id);
	}

	const toggle =
		'h-10 px-4 text-small font-medium transition-colors aria-pressed:bg-ink aria-pressed:text-ground bg-surface text-ink hover:bg-raised';
	const sortOptions: { label: string; value: Sort; title: string }[] = [
		{ label: 'Newest', value: 'newest', title: 'Newest first' },
		{ label: 'Popular', value: 'popular', title: 'Most favourited this week, then of all time' },
		{ label: 'Oldest', value: 'oldest', title: 'Oldest first' }
	];
	const sexOptions: { label: string; value: Sex | undefined }[] = [
		{ label: 'Anyone', value: undefined },
		{ label: 'Women', value: 'female' },
		{ label: 'Men', value: 'male' }
	];
</script>

<div class="wrap">
	<!-- Filters: plain toggles, all visible. Search on its own line until there's room for it and
	     the toggles side by side. -->
	<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
		<form
			class="flex w-full xl:max-w-md"
			role="search"
			onsubmit={(e) => {
				e.preventDefault();
				applyFilters({ q: searchText.trim() });
			}}
		>
			<input class="{field} h-10" placeholder="Search names, authors, tags, mods" aria-label="Search" bind:value={searchText} />
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
			<div class="flex flex-wrap gap-px" role="group" aria-label="Mods">
				{#each mods as mod (mod.id)}
					<button type="button" class={toggle} aria-pressed={filters.mods.includes(mod.id)} onclick={() => toggleMod(mod.id)}>
						{mod.name}
					</button>
				{/each}
			</div>
			<div class="flex gap-px" role="group" aria-label="Order">
				{#each sortOptions as option (option.value)}
					<button
						type="button"
						class={toggle}
						aria-pressed={filters.sort === option.value}
						title={option.title}
						onclick={() => applyFilters({ sort: option.value })}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if tagChips.length > 0}
		<div class="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Tags">
			{#each tagChips as tag (tag.id)}
				{@const on = filters.tags.includes(tag.id)}
				<button
					type="button"
					class="h-8 px-3 text-small transition-colors {on
						? 'bg-ink text-ground'
						: 'bg-surface text-muted hover:bg-raised hover:text-ink'}"
					aria-pressed={on}
					onclick={() => toggleTag(tag.id)}
				>
					{tag.name}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Portraits -->
	{#if loading}
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-10 pt-10 pb-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5"
			aria-busy="true"
			aria-label="Loading characters"
		>
			{#each { length: 10 } as _, i (i)}
				<div class="motion-safe:animate-pulse">
					<div class="aspect-[2/3] bg-surface"></div>
					<div class="mt-3 h-5 w-3/4 bg-surface"></div>
					<div class="mt-2 h-4 w-1/2 bg-surface"></div>
				</div>
			{/each}
		</div>
	{:else if results.length === 0}
		<div class="py-32">
			<p class="max-w-[28ch] text-lead">{emptyMessage}</p>
			{#if filtered}
				<a href={page.url.pathname} class="link mt-4 inline-block text-body">Clear the filters</a>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-x-4 gap-y-10 pt-10 pb-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
			{#each results as chara (chara.id)}
				<CharacterCard {chara} {isOwner} onDelete={handleDelete} onRemove={onRemove ? handleRemove : undefined} />
			{/each}
		</div>
	{/if}

	<div class="flex flex-col items-start gap-3 pb-24">
		{#if loadError}
			<p class="text-small text-danger">{loadError}</p>
		{/if}
		{#if cursor && !loading}
			<button onclick={loadMore} disabled={loadingMore} class={button('quiet')}>
				{loadingMore ? 'Loading…' : `Show more · ${initial.total - results.length} left`}
			</button>
		{/if}
	</div>
</div>
