<script lang="ts">
	import { goto } from '$app/navigation';
	import { MIN_GENES, parseDna } from '#lib/dna.ts';
	import { stashDna } from '#lib/dna-stash.ts';
	import { button, field } from '#lib/ui.ts';
	import Strand from './Strand.svelte';

	let { signedIn }: { signedIn: boolean } = $props();

	let dna = $state('');
	const genes = $derived(parseDna(dna).length);
	const complete = $derived(genes >= MIN_GENES);

	function carryOn(e: SubmitEvent) {
		e.preventDefault();
		if (!complete) return;
		stashDna(dna);
		goto(signedIn ? '/upload' : `/sign-up?redirect=${encodeURIComponent('/upload')}`);
	}
</script>

<!-- Without script this is still a plain form that leads to the upload page. -->
<form action="/upload" onsubmit={carryOn} class="bg-surface p-5 sm:p-6">
	<label for="paste-dna" class="mb-3 block text-small text-muted">Paste a DNA string from the Ruler Designer</label>
	<textarea
		id="paste-dna"
		bind:value={dna}
		rows="4"
		spellcheck="false"
		class="{field} resize-y py-3 font-code text-small"
		placeholder={'ruler_designer_…={\n  genes={\n    hair_color={ 30 13 72 250 }'}
	></textarea>

	{#if dna.trim()}
		<div class="mt-6">
			<Strand {dna} interactive class="h-24" />
		</div>
		<p class="mt-4 text-small {complete ? 'text-ink' : 'text-danger'}" aria-live="polite">
			{#if complete}
				All {genes} genes read. This face is ready to share.
			{:else if genes > 0}
				Only {genes} genes so far. Copy the whole string from the game.
			{:else}
				That doesn't look like CK3 DNA. It should start with ruler_designer.
			{/if}
		</p>
	{/if}

	<button type="submit" class="{button('accent')} mt-6 w-full sm:w-auto" disabled={!complete}>
		Share this face
	</button>
</form>
