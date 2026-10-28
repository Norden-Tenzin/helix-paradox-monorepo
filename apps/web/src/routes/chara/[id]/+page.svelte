<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import FavouriteButton from '#lib/components/FavouriteButton.svelte';
	import ReportButton from '#lib/components/ReportButton.svelte';
	import Strand from '#lib/components/Strand.svelte';
	import { parseDna } from '#lib/dna.ts';
	import { REPORT_REASON_LABELS } from '#lib/reports.ts';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const character = $derived(data.character);
	const images = $derived([character.display_image, ...character.grid_images]);
	const geneCount = $derived(parseDna(character.dna).length);
	const isOwner = $derived(data.user?.id === character.author_id);
	// A pending mod was named by an uploader and hasn't been added to the list yet.
	const modsLabel = $derived(
		character.mods.map((m) => (m.pending ? `${m.name} (not yet listed)` : m.name)).join(', ')
	);
	const posted = $derived(
		new Date(character.posted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
	);

	let shown = $state(0);
	$effect.pre(() => {
		// Back to the first picture when navigating to another character.
		void character.id;
		shown = 0;
	});

	let copied = $state(false);
	let copyFailed = $state(false);
	async function copyDna() {
		try {
			await navigator.clipboard.writeText(character.dna);
			copied = true;
			copyFailed = false;
			setTimeout(() => (copied = false), 1600);
		} catch {
			copyFailed = true;
		}
	}
</script>

<svelte:head>
	<title>{character.name} · Helix Paradox</title>
	<meta name="description" content="{character.name}, a Crusader Kings III character by {character.author_name}. Copy the DNA." />
	<meta property="og:image" content={character.display_image} />
</svelte:head>

<article class="wrap grid grid-cols-1 gap-x-12 gap-y-10 pt-8 pb-24 lg:grid-cols-12 [&>*]:min-w-0">
	<!-- Portraits -->
	<div class="lg:col-span-7">
		<div class="bg-surface">
			<img
				src={images[shown]}
				alt="Portrait of {character.name}{shown > 0 ? `, picture ${shown + 1} of ${images.length}` : ''}"
				class="mx-auto max-h-[78svh] w-full object-contain"
			/>
		</div>
		{#if images.length > 1}
			<div class="mt-3 flex gap-3" role="group" aria-label="Pictures">
				{#each images as img, i (i)}
					<button
						type="button"
						class="w-20 overflow-hidden bg-surface transition-opacity aria-[current=true]:opacity-100 aria-[current=false]:opacity-50 hover:opacity-100"
						aria-current={i === shown}
						aria-label="Show picture {i + 1}"
						onclick={() => (shown = i)}
					>
						<img src={img} alt="" class="aspect-[2/3] w-full object-cover" />
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Facts and the DNA -->
	<div class="lg:col-span-5 lg:pt-4">
		{#if character.hidden && !isOwner && data.user?.admin}
			<p class="mb-8 border-l-2 border-danger bg-surface px-5 py-4 text-small" role="status">
				Hidden after reports. Only its owner and admins can see it. <a href="/admin" class="link">Review the reports</a>
			</p>
		{/if}
		{#if isOwner && (character.hidden || character.open_reports.length > 0)}
			<!-- Only the owner sees this: what people reported, never who. -->
			<div class="mb-8 border-l-2 border-danger bg-surface px-5 py-4" role="status">
				<p class="font-semibold">
					{character.hidden ? 'Hidden while reports are reviewed' : 'People have reported a problem'}
				</p>
				<p class="mt-1 text-small text-muted">
					{character.hidden
						? 'Only you can see this character until someone reviews the reports.'
						: 'If more people report it, it’s hidden until someone reviews the reports.'}
					Fixing the problem (say, editing the DNA) helps the review.
				</p>
				<ul class="mt-3 space-y-1 text-small">
					{#each character.open_reports as r (r.reason)}
						<li>{REPORT_REASON_LABELS[r.reason]}: {r.count}</li>
					{/each}
				</ul>
			</div>
		{/if}
		<h1 class="text-head">{character.name}</h1>
		<dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-body">
			<dt class="text-muted">Shared by</dt>
			<dd><a href="/user/{character.author_id}" class="link">{character.author_name}</a></dd>
			<dt class="text-muted">Posted</dt>
			<dd>{posted}</dd>
			<dt class="text-muted">Mods</dt>
			<dd>{modsLabel}</dd>
			<dt class="text-muted">Sex</dt>
			<dd>{character.sex === 'female' ? 'Female' : 'Male'}</dd>
		</dl>

		{#if character.tags.length > 0}
			<ul class="mt-5 flex flex-wrap gap-2" aria-label="Tags">
				{#each character.tags as tag (tag.id)}
					<li>
						<a
							href="/characters?tags={tag.id}"
							class="inline-flex h-8 items-center bg-surface px-3 text-small text-muted transition-colors hover:bg-raised hover:text-ink"
						>
							{tag.name}
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		{#if character.description}
			<p class="mt-6 max-w-[60ch] text-body whitespace-pre-line">{character.description}</p>
		{/if}

		<div class="mt-8 flex flex-wrap items-center gap-4">
			<button class={button('accent')} onclick={copyDna}>
				{#if copied}<Check /> Copied{:else}<Copy /> Copy DNA{/if}
			</button>
			<FavouriteButton
				id={character.id}
				count={character.favourite_count}
				favourited={character.favourited}
				signedIn={!!data.user}
			/>
			{#if isOwner}
				<a href="/upload/{character.id}" class="link text-body">Edit</a>
			{/if}
		</div>
		{#if !isOwner}
			<p class="mt-4">
				<ReportButton id={character.id} name={character.name} reported={character.reported} signedIn={!!data.user} />
			</p>
		{/if}
		<p class="mt-3 text-small text-muted" aria-live="polite">
			{#if copyFailed}
				Your browser blocked the clipboard. Select the DNA below and copy it by hand.
			{:else if copied}
				In the game, open the Ruler Designer and choose Paste DNA.
			{:else}
				Then, in the game, open the Ruler Designer and choose Paste DNA.
			{/if}
		</p>

		<div class="gel-ground mt-10 px-4 pt-4 pb-3">
			<Strand dna={character.dna} variant="map" interactive />
		</div>
	</div>

	<section class="lg:col-span-12" aria-labelledby="dna-heading">
		<h2 id="dna-heading" class="text-lead">The DNA <span class="text-muted">· {geneCount} genes</span></h2>
		<!-- Focusable so keyboard users can scroll the long string. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre
			aria-label="DNA string"
			class="mt-4 max-h-96 overflow-auto bg-surface p-5 text-[0.8125rem] leading-relaxed text-ink/85"
			tabindex="0">{character.dna}</pre>
	</section>
</article>
