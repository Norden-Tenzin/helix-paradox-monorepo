<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { apiErrorMessage } from '#lib/api.ts';
	import { button, field } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let renaming = $state<string | null>(null);
	let newName = $state('');
	let error = $state('');

	async function update(id: string, change: { name?: string; listed?: boolean }) {
		error = '';
		const response = await fetch(`/api/admin/mods/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(change)
		});
		if (!response.ok) error = await apiErrorMessage(response);
		renaming = null;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Mods · Admin · Helix Paradox</title>
</svelte:head>

<p class="mb-8 max-w-[70ch] text-body text-muted">
	Pending mods were named by uploaders whose DNA had genes we didn’t recognise. They show on their characters and on the
	upload form; <strong class="font-medium text-ink">list</strong> one to offer it in the library’s filters too.
</p>
{#if error}<p class="mb-4 text-small text-danger" role="alert">{error}</p>{/if}

<div class="overflow-x-auto">
	<table class="w-full min-w-[640px] text-left text-small">
		<thead class="text-muted">
			<tr class="border-b border-raised">
				<th class="py-3 pr-4 font-normal">Mod</th>
				<th class="py-3 pr-4 font-normal">Status</th>
				<th class="py-3 pr-4 font-normal tabular-nums">Characters</th>
				<th class="py-3 pr-4 font-normal tabular-nums" title="Genes that identify it from a DNA string">Signature genes</th>
				<th class="py-3 pr-4 font-normal">Named by</th>
				<th class="py-3 font-normal"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.mods as mod (mod.id)}
				<tr class="border-b border-raised/60 align-middle">
					<td class="py-3 pr-4">
						{#if renaming === mod.id}
							<form class="flex gap-2" onsubmit={(e) => (e.preventDefault(), update(mod.id, { name: newName }))}>
								<input bind:value={newName} class="{field} h-9 w-48 text-small" aria-label="New name for {mod.name}" />
								<button type="submit" class={button('solid', 'sm')}>Save</button>
							</form>
						{:else}
							<span class="text-body text-ink">{mod.name}</span> <span class="text-muted">{mod.id}</span>
						{/if}
					</td>
					<td class="py-3 pr-4 {mod.pending ? 'text-accent' : 'text-muted'}">{mod.pending ? 'Pending' : 'Listed'}</td>
					<td class="py-3 pr-4 tabular-nums">{mod.characters}</td>
					<td class="py-3 pr-4 tabular-nums {mod.signature_genes === 0 ? 'text-muted' : ''}">
						{mod.signature_genes === 0 ? 'none (picked by hand)' : mod.signature_genes}
					</td>
					<td class="py-3 pr-4 text-muted">{mod.created_by ?? 'Seeded'}</td>
					<td class="py-3 text-right whitespace-nowrap">
						{#if mod.id !== 'vanilla'}
							<button type="button" class="link mr-4" onclick={() => update(mod.id, { listed: mod.pending })}>
								{mod.pending ? 'List' : 'Unlist'}
							</button>
						{/if}
						<button type="button" class="link" onclick={() => ((renaming = mod.id), (newName = mod.name))}>Rename</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
