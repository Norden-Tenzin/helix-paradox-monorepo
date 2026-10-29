<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { button, dialogContent, field, fieldLabel, overlay } from '#lib/ui.ts';

	export interface CollectionFields {
		name: string;
		description: string;
		public: boolean;
	}

	// Creating or editing a collection: its name, a line about it, and whether it's public.
	// `onSave` throws to show an error and keep the dialog open.
	let {
		open = $bindable(false),
		title,
		note = '',
		submitLabel = 'Save',
		initial = { name: '', description: '', public: false },
		onSave
	}: {
		open?: boolean;
		title: string;
		note?: string;
		submitLabel?: string;
		initial?: CollectionFields;
		onSave: (fields: CollectionFields) => Promise<void>;
	} = $props();

	let name = $state('');
	let description = $state('');
	let isPublic = $state(false);
	let saving = $state(false);
	let error = $state('');

	// Start from `initial` each time it opens.
	$effect.pre(() => {
		if (!open) return;
		name = initial.name;
		description = initial.description;
		isPublic = initial.public;
		error = '';
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return (error = 'Give it a name.');
		saving = true;
		error = '';
		try {
			await onSave({ name: name.trim(), description: description.trim(), public: isPublic });
			open = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'That didn’t save. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class={overlay} />
		<Dialog.Content class={dialogContent}>
			<form class="space-y-6" onsubmit={submit} oninput={() => (error = '')}>
				<div class="space-y-2">
					<Dialog.Title class="text-lead font-semibold tracking-[-0.02em]">{title}</Dialog.Title>
					{#if note}<Dialog.Description class="text-small text-muted">{note}</Dialog.Description>{/if}
				</div>
				<div>
					<label for="collection-name" class={fieldLabel}>Name</label>
					<input
						id="collection-name"
						bind:value={name}
						maxlength="60"
						class="{field} h-12"
						placeholder="e.g. My Norse dynasty"
						autocomplete="off"
					/>
				</div>
				<div>
					<label for="collection-description" class={fieldLabel}>About it (optional)</label>
					<textarea id="collection-description" bind:value={description} maxlength="1000" class="{field} min-h-20 py-3"></textarea>
				</div>
				<label class="flex cursor-pointer items-start gap-3 text-body">
					<input type="checkbox" bind:checked={isPublic} class="mt-1 size-4 accent-[var(--accent)]" />
					<span>
						Public
						<span class="block text-small text-muted">Anyone can see it on your profile. Otherwise only you can.</span>
					</span>
				</label>
				{#if error}<p class="text-small text-danger" role="alert">{error}</p>{/if}
				<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<Dialog.Close type="button" class={button('quiet')}>Cancel</Dialog.Close>
					<button type="submit" class={button('solid')} disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
