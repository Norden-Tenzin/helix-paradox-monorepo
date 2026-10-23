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

	const redirectTo = $derived(safeRedirect(page.url));

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		const result = await authClient.signUp.email({
			email: email.trim(),
			password,
			name: username.trim(),
			username: username.trim()
		});
		loading = false;
		if (result.error) {
			error = result.error.message ?? 'Sign up failed. Try again.';
			return;
		}
		await goto(redirectTo, { refreshAll: true });
	}
</script>

<svelte:head>
	<title>Create an account · Helix Paradox</title>
</svelte:head>

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
