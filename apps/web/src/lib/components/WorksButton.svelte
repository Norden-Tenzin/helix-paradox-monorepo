<script lang="ts">
	import { page } from '$app/state';
	import { CircleCheck } from '@lucide/svelte';
	import { apiErrorMessage, type ConfirmState } from '#lib/api.ts';
	import { button } from '#lib/ui.ts';

	// "Works in my game ✓": someone pasted the DNA and it came out right. Saved the same way as
	// favourites (shown at once, whatever is showing when a request ends is saved next). The
	// author can't vouch for their own character, so they only see the count. Signed out, it's a
	// link to sign in.
	let {
		id,
		count,
		confirmed,
		signedIn,
		isOwner
	}: { id: string; count: number; confirmed: boolean; signedIn: boolean; isOwner: boolean } = $props();

	let saved = $derived<ConfirmState>({ confirmed, confirm_count: count });
	let current = $derived<ConfirmState>({ confirmed, confirm_count: count });
	let sending = false;
	let error = $state('');

	function toggle() {
		const next = !current.confirmed;
		current = { confirmed: next, confirm_count: Math.max(0, current.confirm_count + (next ? 1 : -1)) };
		error = '';
		if (!sending) sync();
	}

	async function sync() {
		sending = true;
		try {
			while (current.confirmed !== saved.confirmed) {
				const want = current.confirmed;
				const response = await fetch(`/api/characters/${id}/works`, { method: want ? 'PUT' : 'DELETE' });
				if (!response.ok) throw new Error(await apiErrorMessage(response));
				saved = await response.json();
				current =
					current.confirmed === saved.confirmed
						? saved
						: { confirmed: current.confirmed, confirm_count: Math.max(0, saved.confirm_count + (current.confirmed ? 1 : -1)) };
			}
		} catch (err) {
			current = saved;
			error = err instanceof Error ? err.message : 'That didn’t save. Try again.';
		} finally {
			sending = false;
		}
	}

	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);
	const people = $derived(`${current.confirm_count} ${current.confirm_count === 1 ? 'person says' : 'people say'} it works`);
</script>

{#snippet label()}
	<CircleCheck class={current.confirmed ? 'text-accent' : ''} />
	{current.confirmed ? 'Works for me' : 'Works in my game'}
	<span class="tabular-nums text-muted">{current.confirm_count}</span>
{/snippet}

{#if isOwner}
	<p class="inline-flex items-center gap-2 text-body text-muted">
		<CircleCheck class="size-5" aria-hidden="true" />
		{current.confirm_count > 0 ? people : 'No one has said it works for them yet'}
	</p>
{:else if signedIn}
	<button
		type="button"
		class={button('quiet')}
		aria-pressed={current.confirmed}
		title="Pasted it into the Ruler Designer and it came out right? Say so."
		onclick={toggle}
	>
		{@render label()}
	</button>
	{#if error}<p class="mt-2 text-small text-danger" role="alert">{error}</p>{/if}
{:else}
	<a href={signInHref} class={button('quiet')} title="Sign in to say it works in your game">{@render label()}</a>
{/if}
