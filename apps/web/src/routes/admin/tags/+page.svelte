<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { apiErrorMessage } from '#lib/api.ts';
	import { button, field } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let search = $derived(data.q);
	let merging = $state<string | null>(null);
	let into = $state('');
	let message = $state<{ ok: boolean; text: string } | null>(null);

	const live = $derived(data.tags.filter((t) => !t.merged_into));
	const merged = $derived(data.tags.filter((t) => t.merged_into));

	async function merge(from: string) {
		message = null;
		const response = await fetch('/api/admin/tags/merge', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ from, into })
		});
		message = response.ok
			? { ok: true, text: `Merged “${from}” into “${into}”.` }
			: { ok: false, text: await apiErrorMessage(response) };
		if (response.ok) {
			merging = null;
			into = '';
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Tags · Admin · Helix Paradox</title>
</svelte:head>

<p class="mb-6 max-w-[70ch] text-body text-muted">
	Merge a tag into another when they mean the same thing (“vikings” into “viking”). Its characters move over, and anyone
	typing the old one later gets the new one.
</p>

<form class="mb-8 flex max-w-md" role="search" onsubmit={(e) => (e.preventDefault(), goto(`?q=${encodeURIComponent(search.trim())}`))}>
	<input bind:value={search} class="{field} h-10" placeholder="Find a tag" aria-label="Find a tag" />
	<button type="submit" class="{button('solid', 'sm')} px-5">Find</button>
</form>
{#if message}<p class="mb-4 text-small {message.ok ? 'text-ink' : 'text-danger'}" role="status">{message.text}</p>{/if}

<datalist id="tag-ids">
	{#each live as tag (tag.id)}<option value={tag.id}>{tag.name}</option>{/each}
</datalist>

{#if live.length === 0}
	<p class="text-lead text-muted">{data.q ? 'No tags match.' : 'No tags yet.'}</p>
{:else}
	<ul class="divide-y divide-raised/60">
		{#each live as tag (tag.id)}
			<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-small">
				<a href="/characters?tags={tag.id}" class="link text-body text-ink">{tag.name}</a>
				<span class="text-muted">{tag.id}</span>
				<span class="tabular-nums text-muted">{tag.count} {tag.count === 1 ? 'character' : 'characters'}</span>
				{#if merging === tag.id}
					<form class="ml-auto flex items-center gap-2" onsubmit={(e) => (e.preventDefault(), merge(tag.id))}>
						<label for="into-{tag.id}" class="text-muted">Merge into</label>
						<input id="into-{tag.id}" bind:value={into} list="tag-ids" required class="{field} h-9 w-48 text-small" />
						<button type="submit" class={button('solid', 'sm')}>Merge</button>
						<button type="button" class="link" onclick={() => (merging = null)}>Cancel</button>
					</form>
				{:else}
					<button type="button" class="link ml-auto" onclick={() => ((merging = tag.id), (into = ''))}>Merge into…</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if merged.length > 0}
	<h2 class="mt-12 mb-3 text-body font-semibold">Merged away</h2>
	<ul class="space-y-1 text-small text-muted">
		{#each merged as tag (tag.id)}<li>{tag.name} → {tag.merged_into}</li>{/each}
	</ul>
{/if}
