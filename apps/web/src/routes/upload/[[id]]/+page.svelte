<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ImagePlus, X } from '@lucide/svelte';
	import { apiErrorMessage, MODS, type Sex } from '#lib/api.ts';
	import Strand from '#lib/components/Strand.svelte';
	import { MIN_GENES, parseDna } from '#lib/dna.ts';
	import { takeStashedDna } from '#lib/dna-stash.ts';
	import { button, field, fieldLabel } from '#lib/ui.ts';
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

	const geneCount = $derived(parseDna(dna).length);

	// A DNA string pasted on the home page arrives here (possibly via sign-up).
	onMount(() => {
		const stashed = takeStashedDna();
		if (stashed && !existing && !dna) dna = stashed;
	});

	// Errors only show after the first submit attempt, then track the fields live.
	let attempted = $state(false);
	const errors = $derived(attempted ? validationErrors() : {});
	let submitError = $state('');
	let isLoading = $state(false);

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
			submitError = 'That file isn’t an image. Choose a PNG, JPEG or WebP.';
			return undefined;
		}
		if (file.size > MAX_INPUT_BYTES) {
			submitError = 'That image is over 20MB. Choose a smaller one.';
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
		if (!name.trim()) next.name = 'Give the character a name.';
		if (!dna.trim()) next.dna = 'Paste the DNA from the Ruler Designer.';
		else if (geneCount < MIN_GENES) next.dna = 'This DNA looks cut short. Copy the whole string from the game.';
		if (mods.length === 0) next.mods = 'Choose the mods this face was made with.';
		if (!displayImage) next.displayImage = 'Add a portrait.';
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
			const { id }: { id: string } = await response.json();
			await goto(`/chara/${id}`, { refreshAll: true });
		} catch (err) {
			console.error('Upload Error:', err);
			submitError = err instanceof Error ? err.message : 'The upload failed. Try again.';
		} finally {
			isLoading = false;
		}
	}

	const toggle =
		'h-11 px-5 text-small font-medium transition-colors bg-surface text-ink hover:bg-raised aria-pressed:bg-ink aria-pressed:text-ground';
</script>

<svelte:head>
	<title>{isEditMode ? `Edit ${existing?.name}` : 'Share a character'} · Helix Paradox</title>
</svelte:head>

<div class="wrap pt-16 pb-24 sm:pt-24">
	<header class="max-w-[52ch]">
		<h1 class="text-head">{isEditMode ? `Edit ${existing?.name}` : 'Share a character'}</h1>
		<p class="mt-4 text-body">
			{isEditMode
				? 'Change the details or pictures. Pictures you remove are deleted when you save.'
				: 'A portrait, its DNA and the mods it was made with. In the game, the Ruler Designer’s Copy DNA button gives you the string.'}
		</p>
	</header>

	<form onsubmit={onSubmit} class="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-12 [&>*]:min-w-0" novalidate>
		<!-- Pictures -->
		<div class="lg:col-span-5">
			<span class={fieldLabel}>Portrait</span>
			<label
				class="group relative flex aspect-[2/3] w-full max-w-md cursor-pointer items-center justify-center overflow-hidden bg-surface transition-colors hover:bg-raised {errors.displayImage
					? 'outline-2 outline-danger'
					: ''}"
			>
				{#if displayPreview}
					<img src={displayPreview} class="absolute inset-0 h-full w-full object-cover" alt="Portrait preview" />
					<span class="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-small opacity-0 transition-opacity group-hover:opacity-100">
						Choose another portrait
					</span>
				{:else}
					<span class="flex flex-col items-center gap-3 px-6 text-center text-body text-muted">
						<ImagePlus class="size-8" />
						Choose a portrait<br />PNG, JPEG or WebP
					</span>
				{/if}
				<input
					type="file"
					class="sr-only"
					accept="image/*"
					onchange={(e) => {
						const file = pickFile(e);
						if (file) displayImage = file;
					}}
				/>
			</label>
			{#if errors.displayImage}<p class="mt-2 text-small text-danger">{errors.displayImage}</p>{/if}

			<span class="{fieldLabel} mt-8">More pictures, if you like</span>
			<div class="grid max-w-md grid-cols-3 gap-3">
				{#each gridPreviews as src, i (i)}
					<label
						class="group relative flex aspect-[2/3] cursor-pointer items-center justify-center overflow-hidden bg-surface transition-colors hover:bg-raised"
					>
						{#if src}
							<img {src} class="absolute inset-0 h-full w-full object-cover" alt="Gallery {i + 1}" />
							<button
								type="button"
								class="absolute top-2 right-2 z-10 grid size-9 place-items-center bg-ground/85 text-ink transition-colors hover:bg-danger"
								aria-label="Remove image"
								onclick={(e) => {
									e.preventDefault();
									gridImages = gridImages.map((img, j) => (j === i ? undefined : img));
								}}
							>
								<X class="size-4" />
							</button>
						{:else}
							<ImagePlus class="size-5 text-muted" />
							<span class="sr-only">Add picture {i + 1}</span>
						{/if}
						<input
							type="file"
							class="sr-only"
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

		<!-- Details -->
		<div class="space-y-9 lg:col-span-7">
			<div>
				<label for="name" class={fieldLabel}>Name</label>
				<input id="name" bind:value={name} class="{field} h-14 text-lead" autocomplete="off" />
				{#if errors.name}<p class="mt-2 text-small text-danger">{errors.name}</p>{/if}
			</div>

			<div class="flex flex-wrap gap-x-10 gap-y-9">
				<div>
					<span class={fieldLabel}>Sex</span>
					<div class="flex gap-px" role="group" aria-label="Sex">
						{#each [['female', 'Female'], ['male', 'Male']] as const as [value, text] (value)}
							<button type="button" class={toggle} aria-pressed={sex === value} onclick={() => (sex = value)}>
								{text}
							</button>
						{/each}
					</div>
				</div>
				<div>
					<span class={fieldLabel}>Made with</span>
					<div class="flex gap-px" role="group" aria-label="Mods">
						{#each MODS as mod (mod)}
							<button type="button" class={toggle} aria-pressed={mods.includes(mod)} onclick={() => toggleMod(mod)}>
								{mod === 'vanilla' ? 'Vanilla' : mod.toUpperCase()}
							</button>
						{/each}
					</div>
					{#if errors.mods}<p class="mt-2 text-small text-danger">{errors.mods}</p>{/if}
				</div>
			</div>

			<div>
				<label for="description" class={fieldLabel}>About them (optional)</label>
				<textarea
					id="description"
					bind:value={description}
					class="{field} min-h-28 py-3"
					placeholder="Who they are, which campaign they come from…"
				></textarea>
			</div>

			<div>
				<label for="dna" class={fieldLabel}>DNA</label>
				<textarea
					id="dna"
					bind:value={dna}
					spellcheck="false"
					class="{field} min-h-44 py-3 font-code text-small"
					placeholder={'ruler_designer_…={\n  genes={\n    hair_color={ 30 13 72 250 }'}
				></textarea>
				{#if errors.dna}
					<p class="mt-2 text-small text-danger">{errors.dna}</p>
				{:else if geneCount > 0}
					<p class="mt-2 text-small text-muted">{geneCount} genes read.</p>
				{/if}
				{#if geneCount > 0}
					<div class="mt-5"><Strand {dna} interactive class="h-24" /></div>
				{/if}
			</div>

			{#if submitError}
				<p class="text-body text-danger" role="alert">{submitError}</p>
			{/if}

			<div class="flex flex-wrap items-center gap-6">
				<button type="submit" disabled={isLoading} class={button('accent')}>
					{#if isLoading}
						{isEditMode ? 'Saving…' : 'Uploading…'}
					{:else}
						{isEditMode ? 'Save changes' : 'Share character'}
					{/if}
				</button>
				<a href={isEditMode ? `/chara/${existing?.id}` : '/characters'} class="link text-body">Cancel</a>
			</div>
		</div>
	</form>
</div>
