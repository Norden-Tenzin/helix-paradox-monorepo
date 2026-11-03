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

	/** Posts an admin action for the character card `id`, then reloads the list. */
	async function post(id: string, path: string, body: object) {
		busy = id;
		error = null;
		try {
			const response = await fetch(path, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			await invalidateAll();
		} catch (err) {
			error = { id, message: err instanceof Error ? err.message : 'That didn’t work. Try again.' };
		} finally {
			busy = null;
		}
	}

	function review(id: string, name: string, action: ReviewAction) {
		if (action === 'delete' && !confirm(`Delete ${name} for good, pictures and all?`)) return;
		return post(id, `/api/admin/characters/${id}/review`, { action });
	}

	// Banning signs the author out everywhere and stops them signing in. "remove" also deletes
	// every character they've shared, pictures and all; otherwise they're all hidden.
	function ban(id: string, author: { id: string; name: string }, remove: boolean) {
		const what = remove
			? `Ban ${author.name} and delete every character they’ve shared, pictures and all? This can’t be undone.`
			: `Ban ${author.name}? They’re signed out, can’t sign in again, and all their characters are hidden.`;
		if (!confirm(what)) return;
		return post(id, `/api/admin/users/${author.id}/ban`, { remove });
	}

	function unban(id: string, author: { id: string; name: string }) {
		if (!confirm(`Let ${author.name} sign in again? Their characters stay hidden until you show them.`)) return;
		return post(id, `/api/admin/users/${author.id}/unban`, {});
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
					<img src={character.display_image} alt="" class="h-full w-full object-cover object-[50%_20%]" />
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
						{#if character.author_banned}<span class="text-small text-danger">Author banned</span>{/if}
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
					<div class="mt-3 flex flex-wrap gap-3">
						{#if character.author_banned}
							<button type="button" class={button('quiet', 'sm')} disabled={busy === character.id} onclick={() => unban(character.id, { id: character.author_id, name: character.author_name })}>
								Unban {character.author_name}
							</button>
						{:else}
							<button type="button" class={button('quiet', 'sm')} disabled={busy === character.id} onclick={() => ban(character.id, { id: character.author_id, name: character.author_name }, false)}>
								Ban author
							</button>
							<button type="button" class={button('danger', 'sm')} disabled={busy === character.id} onclick={() => ban(character.id, { id: character.author_id, name: character.author_name }, true)}>
								Ban and delete all their characters
							</button>
						{/if}
					</div>
					{#if error?.id === character.id}<p class="mt-3 text-small text-danger" role="alert">{error.message}</p>{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}
