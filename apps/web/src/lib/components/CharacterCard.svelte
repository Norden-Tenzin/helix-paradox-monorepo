<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import type { Character } from '#lib/api.ts';
	import { button, dialogContent, overlay } from '#lib/ui.ts';

	let {
		chara,
		isOwner = false,
		onDelete
	}: { chara: Character; isOwner?: boolean; onDelete?: (id: string) => Promise<void> } = $props();

	let alertOpen = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');

	const modsLabel = $derived(chara.mods.map((m) => (m === 'vanilla' ? 'Vanilla' : m.toUpperCase())).join(' · '));

	async function confirmDelete() {
		if (!onDelete) return;
		deleting = true;
		deleteError = '';
		try {
			await onDelete(chara.id);
			alertOpen = false;
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Could not delete this character.';
		} finally {
			deleting = false;
		}
	}
</script>

<article class="group">
	<a href="/chara/{chara.id}" class="block aspect-[2/3] overflow-hidden bg-surface">
		<img
			class="h-full w-full object-cover transition-[scale] duration-300 ease-out group-hover:scale-[1.04]"
			src={chara.display_image}
			alt="Portrait of {chara.name}"
			loading="lazy"
		/>
	</a>
	<h3 class="mt-3 line-clamp-2 text-[1.125rem] leading-tight tracking-[-0.02em]">
		<a href="/chara/{chara.id}" class="hover:text-accent">{chara.name}</a>
	</h3>
	<p class="mt-1 truncate text-small text-muted">{modsLabel} · by {chara.author_name}</p>
	{#if isOwner}
		<p class="mt-2 flex gap-4 text-small">
			<a href="/upload/{chara.id}" class="link">Edit</a>
			<button type="button" class="link text-danger" onclick={() => (alertOpen = true)}>Delete</button>
		</p>
	{/if}
</article>

{#if isOwner}
	<AlertDialog.Root bind:open={alertOpen}>
		<AlertDialog.Portal>
			<AlertDialog.Overlay class={overlay} />
			<AlertDialog.Content class={dialogContent}>
				<div class="space-y-3">
					<AlertDialog.Title class="text-lead font-semibold tracking-[-0.02em]">Delete {chara.name}?</AlertDialog.Title>
					<AlertDialog.Description class="text-body">
						The portrait and its DNA leave the library for good. This can't be undone.
					</AlertDialog.Description>
					{#if deleteError}<p class="text-small text-danger">{deleteError}</p>{/if}
				</div>
				<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<AlertDialog.Cancel class={button('quiet')}>Keep it</AlertDialog.Cancel>
					<AlertDialog.Action class={button('danger')} disabled={deleting} onclick={confirmDelete}>
						Delete character
					</AlertDialog.Action>
				</div>
			</AlertDialog.Content>
		</AlertDialog.Portal>
	</AlertDialog.Root>
{/if}
