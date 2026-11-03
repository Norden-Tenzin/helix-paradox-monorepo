<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '#lib/auth-client.ts';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import { safeRedirect } from '#lib/redirect.ts';
	import { button, field, fieldLabel } from '#lib/ui.ts';

	let identifier = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	// Set when the account exists but its email isn't confirmed yet; offers to send the link again.
	let unverified = $state(false);
	let resent = $state(false);
	let cooldown = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	const redirectTo = $derived(safeRedirect(page.url));

	// Signing in to an unconfirmed account makes the server send a fresh link
	// (emailVerification.sendOnSignIn), so "send again" just signs in again. That works whether
	// they typed a username or an email.
	function signIn() {
		const id = identifier.trim();
		return id.includes('@')
			? authClient.signIn.email({ email: id, password })
			: authClient.signIn.username({ username: id, password });
	}

	// A short wait between sends, so repeated clicks don't send a pile of emails.
	function startCooldown() {
		cooldown = 30;
		clearInterval(timer);
		timer = setInterval(() => {
			if (--cooldown <= 0) clearInterval(timer);
		}, 1000);
	}

	$effect(() => () => clearInterval(timer));

	async function resend() {
		error = '';
		resent = false;
		loading = true;
		const result = await signIn();
		loading = false;
		// Confirmed in the meantime: they're signed in now.
		if (!result.error) return goto(redirectTo, { refreshAll: true });
		if (result.error.code !== 'EMAIL_NOT_VERIFIED') {
			unverified = false;
			error = result.error.message ?? 'Couldn’t send another email. Try again in a minute.';
			return;
		}
		resent = true;
		startCooldown();
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		unverified = false;
		resent = false;
		loading = true;
		// No callbackURL: with one, Better Auth's client reloads the whole page to it after signing
		// in, racing the goto below. (The "confirm your email first" link then lands on the home page.)
		const result = await signIn();
		loading = false;
		if (result.error) {
			if (result.error.code === 'EMAIL_NOT_VERIFIED') {
				unverified = true;
				startCooldown();
			} else error = result.error.message ?? 'Sign in failed. Check your details and try again.';
			return;
		}
		await goto(redirectTo, { refreshAll: true });
	}
</script>

<svelte:head>
	<title>Sign in · Helix Paradox</title>
</svelte:head>

<AuthShell title="Welcome back" intro="Sign in to share characters and look after the ones you’ve shared.">
	<form onsubmit={onSubmit} class="space-y-6">
		<div>
			<label for="identifier" class={fieldLabel}>Username or email</label>
			<input id="identifier" bind:value={identifier} required autocomplete="username" class="{field} h-12" />
		</div>
		<div>
			<label for="password" class={fieldLabel}>Password</label>
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
		{#if unverified}
			<div class="space-y-3" role="status">
				<p class="text-body">
					Confirm your email first. {resent ? 'We’ve sent another link.' : 'We’ve sent you a new link.'} Open it
					to finish signing in. The newest link is the one that works, and it might be in your spam folder.
				</p>
				<button type="button" class={button('quiet')} onclick={resend} disabled={loading || cooldown > 0}>
					{cooldown > 0 ? `Send the link again (${cooldown}s)` : 'Send the link again'}
				</button>
			</div>
		{/if}
		<button type="submit" disabled={loading} class="{button('accent')} w-full">
			{loading ? 'Signing in…' : 'Sign in'}
		</button>
		<p class="text-body">
			New here?
			<a href="/sign-up?redirect={encodeURIComponent(redirectTo)}" class="link">Create an account</a>
		</p>
	</form>
</AuthShell>
