<script lang="ts">
	import { page } from '$app/state';
	import { Dialog } from 'bits-ui';
	import { REPORT_REASONS, type ReportReason } from 'api/types';
	import { apiErrorMessage } from '#lib/api.ts';
	import { REPORT_REASON_LABELS } from '#lib/reports.ts';
	import { button, dialogContent, field, fieldLabel, overlay } from '#lib/ui.ts';

	// Reports go to whoever reviews them; enough of them hide the character until then. Signed
	// out, this is a link to sign in that comes back here.
	let { id, name, reported, signedIn }: { id: string; name: string; reported: boolean; signedIn: boolean } = $props();

	let open = $state(false);
	let reason = $state<ReportReason | null>(null);
	let note = $state('');
	let sending = $state(false);
	let error = $state('');
	let sent = $derived(reported);

	async function send(e: SubmitEvent) {
		e.preventDefault();
		if (!reason) return (error = 'Choose what’s wrong.');
		if (reason === 'other' && !note.trim()) return (error = 'Say what’s wrong.');
		sending = true;
		error = '';
		try {
			const response = await fetch(`/api/characters/${id}/report`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ reason, note: note.trim() })
			});
			if (!response.ok) throw new Error(await apiErrorMessage(response));
			sent = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'That didn’t send. Try again.';
		} finally {
			sending = false;
		}
	}

	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(page.url.pathname)}`);
</script>

{#if !signedIn}
	<a href={signInHref} class="link text-small text-muted">Report a problem</a>
{:else}
	<Dialog.Root bind:open>
		<Dialog.Trigger class="link text-small text-muted">{sent ? 'Reported' : 'Report a problem'}</Dialog.Trigger>
		<Dialog.Portal>
			<Dialog.Overlay class={overlay} />
			<Dialog.Content class={dialogContent}>
				{#if sent}
					<div class="space-y-3">
						<Dialog.Title class="text-lead font-semibold tracking-[-0.02em]">Thanks, we’ll take a look</Dialog.Title>
						<Dialog.Description class="text-body">
							You’ve reported {name}. If you send another, it replaces this one.
						</Dialog.Description>
					</div>
					<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
						<button type="button" class={button('quiet')} onclick={() => (sent = false)}>Change my report</button>
						<Dialog.Close class={button('solid')}>Done</Dialog.Close>
					</div>
				{:else}
					<form class="space-y-6" onsubmit={send} oninput={() => (error = '')}>
						<div class="space-y-2">
							<Dialog.Title class="text-lead font-semibold tracking-[-0.02em]">What’s wrong with {name}?</Dialog.Title>
							<Dialog.Description class="text-small text-muted">
								If several people report the same character, it’s hidden until it’s been reviewed.
							</Dialog.Description>
						</div>
						<fieldset class="space-y-1">
							<legend class="sr-only">Reason</legend>
							{#each REPORT_REASONS as value (value)}
								<label class="flex cursor-pointer items-center gap-3 px-1 py-2 text-body">
									<input type="radio" name="reason" {value} bind:group={reason} class="size-4 accent-[var(--accent)]" />
									{REPORT_REASON_LABELS[value]}
								</label>
							{/each}
						</fieldset>
						<div>
							<label for="report-note" class={fieldLabel}>{reason === 'other' ? 'What’s wrong?' : 'Anything to add? (optional)'}</label>
							<textarea id="report-note" bind:value={note} maxlength="500" class="{field} min-h-20 py-3"></textarea>
						</div>
						{#if error}<p class="text-small text-danger" role="alert">{error}</p>{/if}
						<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<Dialog.Close class={button('quiet')}>Cancel</Dialog.Close>
							<button type="submit" class={button('accent')} disabled={sending}>{sending ? 'Sending…' : 'Send report'}</button>
						</div>
					</form>
				{/if}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
