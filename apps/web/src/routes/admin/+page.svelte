<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { apiErrorMessage, type ReviewAction } from '#lib/api.ts';
	import { REPORT_REASON_LABELS } from '#lib/reports.ts';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let busy = $state<string | null>(null);
	let error = $state<{ id: string; message: string } | null>(null);

	const when = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

	async function review(id: string, name: string, action: ReviewAction) {
		if (action === 'delete' && !confirm(`Delete ${name} for good, pictures and all?`)) return;
		busy = id;
		error = null;
		try {
			const response = await fetch(`/api/admin/characters/${id}/review`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action })
			});
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			await invalidateAll();
		} catch (err) {
			error = { id, message: err instanceof Error ? err.message : 'That didn’t work. Try again.' };
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head>
	<title>Reports · Admin · Helix Paradox</title>
</svelte:head>

{#if data.reported.length === 0}
	<p class="text-lead text-muted">No open reports.</p>
{:else}
	<p class="mb-8 text-body text-muted">
		{data.reported.length}
		{data.reported.length === 1 ? 'character has' : 'characters have'} open reports, most-reported first.
		<strong class="font-medium text-ink">Dismiss</strong> if the reports are wrong (it’s shown again),
		<strong class="font-medium text-ink">keep hidden</strong> if they’re right (its owner can still see and fix it),
		or delete it.
	</p>
	<ul class="space-y-6">
		{#each data.reported as { character, reports } (character.id)}
			<li class="grid gap-5 bg-surface p-5 sm:grid-cols-[6rem_1fr]">
				<a href="/chara/{character.id}" class="block aspect-[2/3] w-24 overflow-hidden bg-raised">
					<img src={character.display_image} alt="" class="h-full w-full object-cover" />
				</a>
				<div class="min-w-0">
					<p class="flex flex-wrap items-baseline gap-x-3">
						<a href="/chara/{character.id}" class="link text-lead font-semibold">{character.name}</a>
						<span class="text-small text-muted">
							by <a href="/user/{character.author_id}" class="link">{character.author_name}</a>
						</span>
						<span class="text-small {character.hidden ? 'text-danger' : 'text-muted'}">
							{character.hidden ? 'Hidden' : 'Still visible'}
						</span>
					</p>
					<ul class="mt-3 space-y-2 text-small">
						{#each reports as report, i (i)}
							<li>
								<span class="text-ink">{REPORT_REASON_LABELS[report.reason]}</span>
								<span class="text-muted">· {report.reporter_name}, {when(report.created_at)}</span>
								{#if report.note}<p class="mt-0.5 text-muted">“{report.note}”</p>{/if}
							</li>
						{/each}
					</ul>
					<div class="mt-5 flex flex-wrap gap-3">
						<button type="button" class={button('quiet', 'sm')} disabled={busy === character.id} onclick={() => review(character.id, character.name, 'dismiss')}>
							Dismiss reports
						</button>
						<button type="button" class={button('solid', 'sm')} disabled={busy === character.id} onclick={() => review(character.id, character.name, 'hide')}>
							Keep hidden
						</button>
						<button type="button" class={button('danger', 'sm')} disabled={busy === character.id} onclick={() => review(character.id, character.name, 'delete')}>
							Delete
						</button>
					</div>
					{#if error?.id === character.id}<p class="mt-3 text-small text-danger" role="alert">{error.message}</p>{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}
