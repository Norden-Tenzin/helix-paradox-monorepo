<script lang="ts">
	import { X } from '@lucide/svelte';
	import { cleanTagName, MAX_TAGS, tagSlug } from 'api/tag-names';
	import type { TagSummary } from '#lib/api.ts';

	// Tags as typed. Existing tags are suggested first, most-used first, so people reuse them
	// rather than starting "Viking" next to "viking"; the API matches them the same way.
	let { tags = $bindable([]), id }: { tags: string[]; id: string } = $props();

	let text = $state('');
	let suggestions = $state<TagSummary[]>([]);
	let open = $state(false);
	let active = $state(-1);

	const chosen = $derived(new Set(tags.map(tagSlug)));
	const full = $derived(tags.length >= MAX_TAGS);
	const typed = $derived(cleanTagName(text));
	// Existing tags matching what's typed, then the typed text itself if it's a new tag.
	const options = $derived([
		...suggestions.filter((s) => !chosen.has(s.id)).map((s) => ({ name: s.name, count: s.count as number | null })),
		...(typed && tagSlug(typed) && !chosen.has(tagSlug(typed)) && !suggestions.some((s) => s.id === tagSlug(typed))
			? [{ name: typed, count: null }]
			: [])
	]);

	$effect(() => {
		const query = text;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(`/api/tags?limit=6&q=${encodeURIComponent(query)}`, { signal: controller.signal });
				if (response.ok) suggestions = await response.json();
			} catch {
				// Aborted or offline: typing still adds tags.
			}
		}, 200);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function add(name: string) {
		const clean = cleanTagName(name);
		if (full) return;
		// Already there (however it's spelled) or nothing left after cleaning: just clear the box.
		if (clean && tagSlug(clean) && !chosen.has(tagSlug(clean))) tags = [...tags, clean];
		text = '';
		active = -1;
	}

	const remove = (i: number) => (tags = tags.filter((_, j) => j !== i));

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			open = true;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = options.length ? (active + step + options.length) % options.length : -1;
		} else if (e.key === 'Enter' || e.key === ',') {
			if (!text.trim() && active < 0) return;
			e.preventDefault();
			add(active >= 0 && options[active] ? options[active].name : text);
		} else if (e.key === 'Backspace' && !text && tags.length > 0) {
			remove(tags.length - 1);
		} else if (e.key === 'Escape') {
			open = false;
			active = -1;
		}
	}
</script>

<div class="relative">
	<!-- Looks like the form's other fields (ui.ts `field`), but lays its chips out in a row. -->
	<div
		class="flex min-h-12 w-full flex-wrap items-center gap-2 border border-raised bg-surface px-3 py-2 transition-colors focus-within:border-accent"
	>
		{#each tags as tag, i (tagSlug(tag))}
			<span class="inline-flex h-8 items-center gap-1 bg-raised pr-1 pl-3 text-small">
				{tag}
				<button type="button" class="grid size-6 place-items-center hover:text-danger" aria-label="Remove {tag}" onclick={() => remove(i)}>
					<X class="size-3.5" />
				</button>
			</span>
		{/each}
		{#if !full}
			<input
				{id}
				bind:value={text}
				role="combobox"
				aria-expanded={open && options.length > 0}
				aria-controls="{id}-options"
				aria-autocomplete="list"
				aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
				autocomplete="off"
				maxlength="30"
				placeholder={tags.length === 0 ? 'e.g. Norse, Byzantine, Villain' : ''}
				class="h-8 min-w-32 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
				onfocus={() => (open = true)}
				onblur={() => setTimeout(() => (open = false), 120)}
				oninput={() => ((open = true), (active = -1))}
				onkeydown={onKeydown}
			/>
		{/if}
	</div>

	{#if open && options.length > 0 && !full}
		<ul id="{id}-options" role="listbox" class="absolute inset-x-0 top-full z-10 mt-1 bg-raised py-1 shadow-2xl shadow-black/60">
			{#each options as option, i (option.name)}
				<li
					id="{id}-option-{i}"
					role="option"
					aria-selected={i === active}
					class="flex cursor-default items-baseline justify-between gap-4 px-4 py-2 text-small aria-selected:bg-ink aria-selected:text-ground"
					onmousedown={(e) => (e.preventDefault(), add(option.name))}
				>
					<span>{option.name}</span>
					<span class="text-muted">{option.count === null ? 'new tag' : `${option.count} ${option.count === 1 ? 'character' : 'characters'}`}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
<p class="mt-2 text-small text-muted">
	{tags.length} of {MAX_TAGS}. Press Enter or comma to add one.
</p>
