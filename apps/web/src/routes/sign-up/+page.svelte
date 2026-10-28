<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '#lib/auth-client.ts';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import { safeRedirect } from '#lib/redirect.ts';
	import { button, field, fieldLabel } from '#lib/ui.ts';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	// After signing up, the account waits for its email to be confirmed.
	let sentTo = $state('');
	let resent = $state(false);

	const redirectTo = $derived(safeRedirect(page.url));
	// The email's link signs them in and carries on to where they were going.
	const callbackURL = $derived(`/verify?redirect=${encodeURIComponent(redirectTo)}`);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		const result = await authClient.signUp.email({
			email: email.trim(),
			password,
			name: username.trim(),
			username: username.trim(),
			callbackURL
		});
		loading = false;
		if (result.error) {
			error = result.error.message ?? 'Sign up failed. Try again.';
			return;
		}
		// Only reached if verification were ever switched off: a session already exists.
		if (result.data?.token) return goto(redirectTo, { refreshAll: true });
		sentTo = email.trim();
	}

	async function resend() {
		error = '';
		const result = await authClient.sendVerificationEmail({ email: sentTo, callbackURL });
		if (result.error) error = result.error.message ?? 'Couldn’t send another email. Try again in a minute.';
		else resent = true;
	}
</script>

<svelte:head>
	<title>Create an account · Helix Paradox</title>
</svelte:head>

{#if sentTo}
	<AuthShell title="Check your inbox" intro="We’ve sent a link to {sentTo}. Open it to finish creating your account.">
		<div class="space-y-6">
			<p class="text-body text-muted">The link works for 24 hours. Can’t find it? Check your spam folder.</p>
			{#if error}<p class="text-small text-danger" role="alert">{error}</p>{/if}
			{#if resent}
				<p class="text-body" role="status">Sent again. The newest link is the one that works.</p>
			{:else}
				<button type="button" class={button('quiet')} onclick={resend}>Send the email again</button>
			{/if}
		</div>
	</AuthShell>
{:else}
	<AuthShell
		title="Create an account"
		intro="Your username appears on every character you share. Browsing and copying DNA needs no account."
	>
		<form onsubmit={onSubmit} class="space-y-6">
			<div>
				<label for="username" class={fieldLabel}>Username</label>
				<input
					id="username"
					bind:value={username}
					required
					minlength="3"
					maxlength="30"
					pattern="[A-Za-z0-9_.]+"
					title="Letters, numbers, underscores and dots"
					autocomplete="username"
					class="{field} h-12"
				/>
			</div>
			<div>
				<label for="email" class={fieldLabel}>Email</label>
				<input id="email" type="email" bind:value={email} required autocomplete="email" class="{field} h-12" />
			</div>
			<div>
				<label for="password" class={fieldLabel}>Password, 8 characters or more</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					minlength="8"
					autocomplete="new-password"
					class="{field} h-12"
				/>
			</div>
			{#if error}<p class="text-small text-danger" role="alert">{error}</p>{/if}
			<button type="submit" disabled={loading} class="{button('accent')} w-full">
				{loading ? 'Creating your account…' : 'Create account'}
			</button>
			<p class="text-body">
				Already have one?
				<a href="/sign-in?redirect={encodeURIComponent(redirectTo)}" class="link">Sign in</a>
			</p>
		</form>
	</AuthShell>
{/if}
