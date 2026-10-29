<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ImagePlus, X } from '@lucide/svelte';
	import { apiErrorMessage, type DnaReport, type Sex } from '#lib/api.ts';
	import Strand from '#lib/components/Strand.svelte';
	import TagInput from '#lib/components/TagInput.svelte';
	import { dnaSex, MIN_GENES, parseDna } from '#lib/dna.ts';
	import { takeStashedDna } from '#lib/dna-stash.ts';
	import { button, field, fieldLabel } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	// The DNA comes first: it gives the sex (newer exports say it) and the mods (from the genes a
	// mod adds), so the uploader only fills in what it can't tell us: the sex for older exports,
	// and the name of a mod we don't know yet.

	type ImageValue = File | string | undefined;

	const MAX_INPUT_BYTES = 20 * 1024 * 1024;

	let { data }: PageProps = $props();

	const existing = $derived(data.existing);
	const isEditMode = $derived(!!existing);

	// Form state, seeded from the character being edited.
	let name = $derived(existing?.name ?? '');
	let description = $derived(existing?.description ?? '');
	let dna = $derived(existing?.dna ?? '');
	let tags = $derived<string[]>(existing?.tags.map((t) => t.name) ?? []);
	// A mod the uploader names because the DNA has genes we don't recognise.
	let newMod = $state('');
	let displayImage = $derived<ImageValue>(existing?.display_image);
	let gridImages = $derived<ImageValue[]>([0, 1, 2].map((i) => existing?.grid_images[i]));

	const geneCount = $derived(parseDna(dna).length);
	const hasDna = $derived(geneCount > 0);

	// Sex: the DNA's own when it says, otherwise the uploader's choice.
	const sexFromDna = $derived(dnaSex(dna));
	let chosenSex = $derived<Sex | null>(existing?.sex ?? null);
	const sex = $derived(sexFromDna ?? chosenSex);

	const modName = (id: string) =>
		[...data.mods, ...(existing?.mods ?? [])].find((m) => m.id === id)?.name ?? id;

	// The API reads the DNA as it's pasted: which mods it points to, genes it doesn't know, and
	// whether the same face is already shared. The server works the mods out the same way on save.
	let report = $state<DnaReport | null>(null);
	$effect(() => {
		const text = dna;
		if (parseDna(text).length === 0) {
			report = null;
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch('/api/dna/inspect', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ dna: text, exclude: existing?.id }),
					signal: controller.signal
				});
				if (!response.ok) return;
				report = await response.json();
			} catch {
				// Aborted or offline: the server checks again on submit.
			}
		}, 350);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});
	// Editing without touching the DNA keeps the character's mods as they are (the server does the
	// same): older exports made with a mod can lack its genes and would read as the base game.
	const dnaUnchanged = $derived(isEditMode && dna.trim() === existing!.dna.trim());
	const shownMods = $derived(dnaUnchanged ? existing!.mods.map((m) => m.id) : (report?.suggestedMods ?? []));
	const unknownGenes = $derived(dnaUnchanged ? 0 : (report?.unknownGenes.length ?? 0));

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

	function validationErrors() {
		const next: Record<string, string> = {};
		if (!dna.trim()) next.dna = 'Paste the DNA from the Ruler Designer.';
		else if (geneCount < MIN_GENES) next.dna = 'This DNA looks cut short. Copy the whole string from the game.';
		else if (!sex) next.sex = 'This DNA doesn’t say. Choose one.';
		if (unknownGenes > 0 && !newMod.trim()) next.mods = 'Say which mod you used.';
		if (!name.trim()) next.name = 'Give the character a name.';
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
			form.set('sex', sex!);
			form.set('description', description);
			form.set('dna', dna);
			if (unknownGenes > 0 && newMod.trim()) form.set('newMod', newMod.trim());
			for (const tag of tags) form.append('tags', tag);

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
		'h-10 px-4 text-small font-medium transition-colors bg-surface text-ink hover:bg-raised aria-pressed:bg-ink aria-pressed:text-ground';
	const step = 'text-lead';
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
				: 'Paste the DNA, add a portrait and a name. We read the rest from the DNA.'}
		</p>
	</header>

	<form onsubmit={onSubmit} class="mt-14 space-y-16" novalidate>
		<!-- 1. The DNA, and what it tells us -->
		<section aria-labelledby="dna-step" class="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-12 [&>*]:min-w-0">
			<div class="lg:col-span-7">
				<h2 id="dna-step" class={step}>The DNA</h2>
				<label for="dna" class="mt-2 block text-body text-muted">
					In the game’s Ruler Designer, press Copy DNA, then paste it here.
				</label>
				<textarea
					id="dna"
					bind:value={dna}
					spellcheck="false"
					class="{field} mt-4 min-h-56 py-3 font-code text-small {errors.dna ? 'border-danger' : ''}"
					placeholder={'ruler_designer_…={\n  genes={\n    hair_color={ 30 13 72 250 }'}
				></textarea>
				{#if errors.dna}<p class="mt-2 text-small text-danger">{errors.dna}</p>{/if}
				{#if report && report.duplicates.length > 0}
					<p class="mt-3 border-l-2 border-accent bg-surface px-4 py-3 text-small" role="status">
						This exact DNA is already shared as
						{#each report.duplicates as dup, i (dup.id)}{i > 0 ? ', ' : ''}<a href="/chara/{dup.id}" class="link">{dup.name}</a>{/each}.
						You can still share it, if it’s a different character.
					</p>
				{/if}
			</div>

			<!-- What the DNA says. Only asks about what it can't tell. -->
			<div class="lg:col-span-5 lg:pt-[4.75rem]" aria-live="polite">
				{#if !hasDna}
					<div class="flex min-h-56 items-center bg-surface px-6 text-body text-muted">
						Once it’s pasted, the face’s genes, sex and mods show here.
					</div>
				{:else}
					<div class="bg-surface p-6">
						<Strand {dna} interactive class="h-24" />
						<dl class="mt-6 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-5 text-body">
							<dt class="text-muted">Genes</dt>
							<dd class="tabular-nums">
								{geneCount}
								{#if geneCount < MIN_GENES}<span class="text-danger"> · looks cut short</span>{/if}
							</dd>

							<dt class="pt-0.5 text-muted">Sex</dt>
							<dd>
								{#if sexFromDna}
									{sexFromDna === 'female' ? 'Female' : 'Male'}
									<span class="text-small text-muted"> · from the DNA</span>
								{:else}
									<div class="flex gap-px" role="group" aria-label="Sex">
										{#each [['female', 'Female'], ['male', 'Male']] as const as [value, text] (value)}
											<button type="button" class={toggle} aria-pressed={chosenSex === value} onclick={() => (chosenSex = value)}>
												{text}
											</button>
										{/each}
									</div>
									<p class="mt-2 text-small {errors.sex ? 'text-danger' : 'text-muted'}">
										{errors.sex ?? 'Older exports don’t say, so choose.'}
									</p>
								{/if}
							</dd>

							<dt class="pt-0.5 text-muted">Made with</dt>
							<dd>
								{#if shownMods.length > 0}
									{shownMods.map(modName).join(' + ')}
									<span class="text-small text-muted"> · {dnaUnchanged ? 'as shared' : 'from the DNA'}</span>
								{:else if !report && !dnaUnchanged}
									<span class="text-muted">Reading…</span>
								{/if}
								{#if unknownGenes > 0}
									<p class="mt-1 text-small text-muted">and a mod we don’t know yet: name it below.</p>
								{/if}
							</dd>
						</dl>

						{#if unknownGenes > 0}
							<div class="mt-6 border-t border-raised pt-5">
								<label for="new-mod" class={fieldLabel}>Which mod did you use?</label>
								<p class="mb-3 text-small text-muted">
									This DNA has {unknownGenes}
									{unknownGenes === 1 ? 'gene' : 'genes'} from a mod we don’t list yet. Name it, and the next face made with it is
									recognised.
								</p>
								<input
									id="new-mod"
									bind:value={newMod}
									class="{field} h-11 {errors.mods ? 'border-danger' : ''}"
									placeholder="e.g. A Game of Thrones"
									autocomplete="off"
								/>
								{#if errors.mods}<p class="mt-2 text-small text-danger">{errors.mods}</p>{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</section>

		<!-- 2. Pictures and details -->
		<section
			aria-labelledby="details-step"
			class="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-12 lg:gap-x-12 [&>*]:min-w-0"
		>
			<h2 id="details-step" class="{step} md:col-span-12">Portrait and details</h2>

			<!-- The portrait, with up to three more pictures stacked beside it at the same height. -->
			<div class="md:col-span-6 lg:col-span-5">
				<span class={fieldLabel}>Portrait, and more pictures if you like</span>
				<div class="grid grid-cols-[3fr_1fr] gap-3">
					<label
						class="group relative flex aspect-[2/3] cursor-pointer items-center justify-center overflow-hidden bg-surface transition-colors hover:bg-raised {errors.displayImage
							? 'outline-2 outline-danger'
							: ''}"
					>
						{#if displayPreview}
							<img src={displayPreview} class="absolute inset-0 h-full w-full object-cover" alt="Portrait preview" />
							<span
								class="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-small opacity-0 transition-opacity group-hover:opacity-100"
							>
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

					<div class="grid grid-rows-3 gap-3">
						{#each gridPreviews as src, i (i)}
							<label
								class="group relative flex min-h-0 cursor-pointer items-center justify-center overflow-hidden bg-surface transition-colors hover:bg-raised"
							>
								{#if src}
									<img {src} class="absolute inset-0 h-full w-full object-cover" alt="Picture {i + 2}" />
									<button
										type="button"
										class="absolute top-1.5 right-1.5 z-10 grid size-8 place-items-center bg-ground/85 text-ink transition-colors hover:bg-danger"
										aria-label="Remove picture {i + 2}"
										onclick={(e) => {
											e.preventDefault();
											gridImages = gridImages.map((img, j) => (j === i ? undefined : img));
										}}
									>
										<X class="size-4" />
									</button>
								{:else}
									<ImagePlus class="size-5 text-muted" />
									<span class="sr-only">Add picture {i + 2}</span>
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
				{#if errors.displayImage}<p class="mt-2 text-small text-danger">{errors.displayImage}</p>{/if}
			</div>

			<div class="space-y-9 md:col-span-6 lg:col-span-7">
				<div>
					<label for="name" class={fieldLabel}>Name</label>
					<input id="name" bind:value={name} class="{field} h-14 text-lead" autocomplete="off" />
					{#if errors.name}<p class="mt-2 text-small text-danger">{errors.name}</p>{/if}
				</div>

				<div>
					<label for="description" class={fieldLabel}>About them (optional)</label>
					<textarea
						id="description"
						bind:value={description}
						class="{field} min-h-32 py-3"
						placeholder="Who they are, which campaign they come from…"
					></textarea>
				</div>

				<div>
					<label for="tags" class={fieldLabel}>Tags (optional)</label>
					<TagInput id="tags" bind:tags />
				</div>
			</div>
		</section>

		<!-- Send -->
		<div class="flex flex-col gap-4 border-t border-raised pt-8 sm:flex-row sm:items-center sm:gap-6">
			<button type="submit" disabled={isLoading} class={button('accent')}>
				{#if isLoading}
					{isEditMode ? 'Saving…' : 'Uploading…'}
				{:else}
					{isEditMode ? 'Save changes' : 'Share character'}
				{/if}
			</button>
			<a href={isEditMode ? `/chara/${existing?.id}` : '/characters'} class="link text-body">Cancel</a>
			{#if submitError}
				<p class="text-body text-danger sm:ml-auto" role="alert">{submitError}</p>
			{:else if attempted && Object.keys(errors).length > 0}
				<p class="text-small text-danger sm:ml-auto" role="alert">Some things need fixing above.</p>
			{/if}
		</div>
	</form>
</div>
