<script lang="ts">
	import { goto } from '$app/navigation';
	import { CloudUpload, LoaderCircle, Plus, X } from '@lucide/svelte';
	import { Dialog } from 'bits-ui';
	import { apiErrorMessage, MODS, type Sex } from '#lib/api.ts';
	import { button, dialogContent, input, label, overlay } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	type ImageValue = File | string | undefined;

	const MAX_INPUT_BYTES = 20 * 1024 * 1024;

	let { data }: PageProps = $props();

	const existing = $derived(data.existing);
	const isEditMode = $derived(!!existing);

	// Form state, seeded from the character being edited.
	let name = $derived(existing?.name ?? '');
	let description = $derived(existing?.description ?? '');
	let dna = $derived(existing?.dna ?? '');
	let sex = $derived<Sex>(existing?.sex ?? 'male');
	let mods = $derived<string[]>(existing?.mods ?? []);
	let displayImage = $derived<ImageValue>(existing?.display_image);
	let gridImages = $derived<ImageValue[]>([0, 1, 2].map((i) => existing?.grid_images[i]));

	// Errors only show after the first submit attempt, then track the fields live.
	let attempted = $state(false);
	const errors = $derived(attempted ? validationErrors() : {});
	let submitError = $state('');
	let isLoading = $state(false);
	let dialogOpen = $state(false);

	const preview = (value: ImageValue) => (value instanceof File ? URL.createObjectURL(value) : (value ?? ''));
	const displayPreview = $derived(preview(displayImage));
	const gridPreviews = $derived(gridImages.map(preview));

	// Release object URLs when the previews change or the page unmounts.
	$effect(() => {
		const urls = [displayPreview, ...gridPreviews].filter((u) => u.startsWith('blob:'));
		return () => urls.forEach((u) => URL.revokeObjectURL(u));
	});

	function pickFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return undefined;
		if (!file.type.startsWith('image/')) {
			submitError = 'Only images allowed';
			return undefined;
		}
		if (file.size > MAX_INPUT_BYTES) {
			submitError = 'Max size 20MB';
			return undefined;
		}
		submitError = '';
		return file;
	}

	function toggleMod(mod: string) {
		const isSelected = mods.includes(mod);
		if (mod === 'vanilla') {
			mods = isSelected ? [] : ['vanilla'];
		} else {
			const withoutVanilla = mods.filter((m) => m !== 'vanilla');
			mods = isSelected ? withoutVanilla.filter((m) => m !== mod) : [...withoutVanilla, mod];
		}
	}

	function validationErrors() {
		const next: Record<string, string> = {};
		if (!name.trim()) next.name = 'Name is required';
		if (!dna.trim()) next.dna = 'DNA is required';
		if (mods.length === 0) next.mods = 'Select at least one';
		if (!displayImage) next.displayImage = 'Primary image is required';
		return next;
	}

	function validate() {
		attempted = true;
		return Object.keys(validationErrors()).length === 0;
	}

	/** Shrinks screenshots before upload; the API rejects images over 5MB. */
	async function compress(file: File) {
		const { default: imageCompression } = await import('browser-image-compression');
		return imageCompression(file, {
			maxSizeMB: 2,
			maxWidthOrHeight: 2560,
			fileType: 'image/webp',
			useWebWorker: true
		});
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		submitError = '';
		if (!validate()) return;

		isLoading = true;
		try {
			const form = new FormData();
			form.set('name', name.trim());
			form.set('sex', sex);
			form.set('description', description);
			form.set('dna', dna);
			for (const mod of mods) form.append('mods', mod);

			const append = async (key: string, value: File | string) => {
				if (typeof value === 'string') form.append(key, value);
				else {
					const file = await compress(value);
					form.append(key, file, file.name);
				}
			};
			await append('display', displayImage!);
			for (const img of gridImages) if (img) await append('grid', img);

			const response = await fetch(isEditMode ? `/api/characters/${existing!.id}` : '/api/characters', {
				method: isEditMode ? 'PATCH' : 'POST',
				body: form
			});
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			dialogOpen = true;
		} catch (err) {
			console.error('Upload Error:', err);
			submitError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{isEditMode ? 'Edit Character' : 'New Character'} · CK3 Helix</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
	<div class="mx-auto max-w-6xl space-y-4 p-6 md:p-10">
		<header class="space-y-1">
			<h1 class="font-sans text-xl font-black tracking-tight uppercase">
				{isEditMode ? 'Edit Character' : 'Create New Character'}
			</h1>
			<div class="h-px w-full bg-border"></div>
		</header>

		<form onsubmit={onSubmit} class="space-y-4" novalidate>
			<div class="grid grid-cols-12 gap-4">
				<!-- PRIMARY IMAGE -->
				<div class="col-span-12 space-y-2 sm:col-span-3">
					<span class={label}>Primary Asset *</span>
					<label
						class="group relative flex aspect-3/4 cursor-pointer items-center justify-center overflow-hidden border border-dashed bg-muted transition hover:border-primary/50 {errors.displayImage
							? 'border-destructive'
							: 'border-border'}"
					>
						{#if displayPreview}
							<img src={displayPreview} class="absolute inset-0 h-full w-full object-cover" alt="Display" />
						{:else}
							<CloudUpload class="h-8 w-8 text-muted-foreground" />
						{/if}
						<input
							type="file"
							class="hidden"
							accept="image/*"
							onchange={(e) => {
								const file = pickFile(e);
								if (file) displayImage = file;
							}}
						/>
					</label>
					{#if errors.displayImage}
						<p class="font-mono text-[10px] text-destructive uppercase">{errors.displayImage}</p>
					{/if}
				</div>

				<!-- GRID IMAGES -->
				<div class="col-span-12 grid grid-cols-3 gap-x-4 gap-y-2 sm:col-span-9">
					<div class="col-span-3">
						<span class={label}>Gallery Assets (Optional)</span>
					</div>
					{#each gridPreviews as src, i (i)}
						<label
							class="group relative flex aspect-3/4 cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-muted transition hover:border-primary/40"
						>
							{#if src}
								<img {src} class="absolute inset-0 h-full w-full object-cover" alt="Gallery {i + 1}" />
								<div
									class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
								>
									<button
										type="button"
										class="scale-75 transform rounded-full bg-destructive p-2 shadow-xl transition-transform group-hover:scale-100"
										aria-label="Remove image"
										onclick={(e) => {
											e.preventDefault();
											gridImages = gridImages.map((img, j) => (j === i ? undefined : img));
										}}
									>
										<X class="h-5 w-5 text-white" />
									</button>
								</div>
							{:else}
								<Plus class="h-5 w-5 text-muted-foreground" />
							{/if}
							<input
								type="file"
								class="hidden"
								accept="image/*"
								onchange={(e) => {
									const file = pickFile(e);
									if (file) gridImages = gridImages.map((img, j) => (j === i ? file : img));
								}}
							/>
						</label>
					{/each}
				</div>
			</div>

			<div class="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
				<div class="grid grid-cols-2 gap-4">
					<div class="col-span-2 space-y-2 md:col-span-1">
						<label for="name" class={label}>Name *</label>
						<input id="name" bind:value={name} class="{input} h-8 text-lg" />
						{#if errors.name}<p class="text-xs text-destructive">{errors.name}</p>{/if}
					</div>
					<div class="col-span-2 space-y-2 md:col-span-1">
						<span class={label}>Sex *</span>
						<div class="flex gap-2">
							{#each ['male', 'female'] as const as option (option)}
								<button
									type="button"
									class="{button(sex === option ? 'default' : 'secondary')} flex-1 text-xs font-bold uppercase"
									aria-pressed={sex === option}
									onclick={() => (sex = option)}
								>
									{option}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="space-y-2">
					<span class={label}>Mods *</span>
					<div class="flex flex-wrap gap-2">
						{#each MODS as mod (mod)}
							<button
								type="button"
								class="rounded-md px-4 py-1 text-[10px] font-semibold uppercase transition-colors {mods.includes(mod)
									? 'bg-primary text-primary-foreground'
									: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
								aria-pressed={mods.includes(mod)}
								onclick={() => toggleMod(mod)}
							>
								{mod}
							</button>
						{/each}
					</div>
					{#if errors.mods}<p class="text-xs text-destructive">{errors.mods}</p>{/if}
				</div>

				<div class="space-y-2">
					<label for="description" class={label}>Description</label>
					<textarea
						id="description"
						bind:value={description}
						class="{input} min-h-20 py-2 font-mono"
						placeholder="Enter character background..."
					></textarea>
				</div>

				<div class="space-y-2">
					<label for="dna" class={label}>DNA *</label>
					<textarea
						id="dna"
						bind:value={dna}
						class="{input} min-h-30 py-2 font-mono"
						placeholder="Paste DNA string here..."
					></textarea>
					{#if errors.dna}<p class="text-xs text-destructive">{errors.dna}</p>{/if}
				</div>
			</div>

			{#if submitError}
				<p class="text-sm text-destructive">{submitError}</p>
			{/if}

			<button
				type="submit"
				disabled={isLoading}
				class="{button()} h-8 w-full font-sans text-sm font-black tracking-widest uppercase"
			>
				{#if isLoading}
					<LoaderCircle class="mr-2 animate-spin" />
				{:else}
					{isEditMode ? 'Edit Character' : 'Create Character'}
				{/if}
			</button>
		</form>

		<Dialog.Root bind:open={dialogOpen}>
			<Dialog.Portal>
				<Dialog.Overlay class={overlay} />
				<Dialog.Content class={dialogContent}>
					<Dialog.Title class="font-mono font-black uppercase">Upload/ Edit Complete</Dialog.Title>
					<div class="flex justify-end">
						<button onclick={() => goto('/')} class="{button()} font-mono font-bold">Return to Discovery</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	</div>
</div>
