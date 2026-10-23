<script lang="ts">
	import { goto } from '$app/navigation';
	import { Ellipsis } from '@lucide/svelte';
	import { AlertDialog, DropdownMenu } from 'bits-ui';
	import type { Character } from '#lib/api.ts';
	import { button, dialogContent, menuContent, menuItem, overlay } from '#lib/ui.ts';
	import Tag from './Tag.svelte';

	let {
		chara,
		isOwner = false,
		onDelete
	}: { chara: Character; isOwner?: boolean; onDelete?: (id: string) => Promise<void> } = $props();

	let alertOpen = $state(false);
	let deleting = $state(false);

	async function confirmDelete() {
		if (!onDelete) return;
		deleting = true;
		try {
			await onDelete(chara.id);
			alertOpen = false;
		} finally {
			deleting = false;
		}
	}
</script>

<div class="relative aspect-3/5 w-full overflow-hidden bg-card hover:opacity-90">
	<a href="/chara/{chara.id}" class="absolute inset-0" aria-label={chara.name}>
		<img class="h-full w-full object-cover" src={chara.display_image} alt={chara.name} loading="lazy" />
		<!-- Overlay gradient for readability -->
		<div class="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/40"></div>
	</a>

	<div class="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
		<div class="pointer-events-auto self-end p-2">
			{#if isOwner}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{button('ghost', 'icon')} h-8 w-8 text-white hover:bg-white/20 hover:text-white"
						aria-label="Character actions"
					>
						<Ellipsis class="size-6!" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content align="end" sideOffset={4} class="{menuContent} w-32">
							<DropdownMenu.Item class={menuItem} onSelect={() => goto(`/upload/${chara.id}`)}>Edit</DropdownMenu.Item>
							<DropdownMenu.Item
								class="{menuItem} text-destructive data-highlighted:bg-destructive! data-highlighted:text-destructive-foreground!"
								onSelect={() => (alertOpen = true)}
							>
								Delete
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{/if}
		</div>

		<div class="flex flex-col space-y-1 p-3">
			<p class="font-mono leading-none font-bold text-white">{chara.name}</p>
			<p class="text-sm text-white/70">{chara.author_name}</p>
			<div class="mt-2 flex flex-wrap gap-1">
				{#each chara.mods as mod (mod)}
					<Tag text={mod} />
				{/each}
			</div>
		</div>
	</div>
</div>

{#if isOwner}
	<AlertDialog.Root bind:open={alertOpen}>
		<AlertDialog.Portal>
			<AlertDialog.Overlay class={overlay} />
			<AlertDialog.Content class={dialogContent}>
				<div class="flex flex-col space-y-2">
					<AlertDialog.Title class="text-lg font-semibold">Are you absolutely sure?</AlertDialog.Title>
					<AlertDialog.Description class="text-sm text-muted-foreground">
						This action cannot be undone. This will permanently delete <strong>{chara.name}</strong>.
					</AlertDialog.Description>
				</div>
				<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<AlertDialog.Cancel class={button('secondary')}>Cancel</AlertDialog.Cancel>
					<AlertDialog.Action class={button('destructive')} disabled={deleting} onclick={confirmDelete}>
						Delete Character
					</AlertDialog.Action>
				</div>
			</AlertDialog.Content>
		</AlertDialog.Portal>
	</AlertDialog.Root>
{/if}
