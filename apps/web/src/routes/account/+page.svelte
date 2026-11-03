<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '#lib/auth-client.ts';
	import { CONTACT_EMAIL } from '#lib/legal.ts';
	import { button, field, fieldLabel } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Deleting needs the password typed again, and a second step, so it's never one slip.
	let confirming = $state(false);
	let password = $state('');
	let error = $state('');
	let deleting = $state(false);

	async function deleteAccount(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		deleting = true;
		const result = await authClient.deleteUser({ password });
		deleting = false;
		if (result.error) {
			error =
				result.error.code === 'INVALID_PASSWORD'
					? 'That password isn’t right.'
					: (result.error.message ?? 'Couldn’t delete your account. Try again.');
			return;
		}
		await goto('/', { invalidateAll: true });
		await invalidateAll();
	}
</script>

<Seo title="Your account · Helix Paradox" noindex />

<div class="wrap max-w-[62ch] pt-16 pb-24 sm:pt-24">
	<h1 class="text-head">Your account</h1>
	<dl class="mt-10 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-body">
		<dt class="text-muted">Username</dt>
		<dd>{data.me.name}</dd>
		<dt class="text-muted">Email</dt>
		<dd class="break-all">{data.me.email}</dd>
	</dl>
	<p class="mt-6 text-small text-muted">
		Need either changed? Email <a href="mailto:{CONTACT_EMAIL}" class="link">{CONTACT_EMAIL}</a>.
		What we keep about you is on the <a href="/privacy" class="link">privacy page</a>.
	</p>

	<section class="mt-16 border-t border-raised pt-10" aria-labelledby="delete-heading">
		<h2 id="delete-heading" class="text-lead font-semibold">Delete your account</h2>
		<p class="mt-3 text-body">
			This deletes your account and everything in it straight away: every character you’ve shared and its
			pictures, your favourites, collections and reports. It can’t be undone.
		</p>
		{#if !confirming}
			<button type="button" class="{button('danger')} mt-6" onclick={() => (confirming = true)}>
				Delete my account
			</button>
		{:else}
			<form onsubmit={deleteAccount} class="mt-6 space-y-5">
				<div>
					<label for="password" class={fieldLabel}>Type your password to confirm</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="current-password"
						class="{field} h-12"
					/>
				</div>
				{#if error}<p class="text-small text-danger" role="alert">{error}</p>{/if}
				<div class="flex flex-wrap gap-3">
					<button type="submit" disabled={deleting || !password} class={button('danger')}>
						{deleting ? 'Deleting…' : 'Delete everything for good'}
					</button>
					<button
						type="button"
						class={button('quiet')}
						onclick={() => {
							confirming = false;
							password = '';
							error = '';
						}}
					>
						Keep my account
					</button>
				</div>
			</form>
		{/if}
	</section>
</div>
