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

	const redirectTo = $derived(safeRedirect(page.url));

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		const id = identifier.trim();
		const result = id.includes('@')
			? await authClient.signIn.email({ email: id, password })
			: await authClient.signIn.username({ username: id, password });
		loading = false;
		if (result.error) {
			error = result.error.message ?? 'Sign in failed. Check your details and try again.';
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
		<button type="submit" disabled={loading} class="{button('accent')} w-full">
			{loading ? 'Signing in…' : 'Sign in'}
		</button>
		<p class="text-body">
			New here?
			<a href="/sign-up?redirect={encodeURIComponent(redirectTo)}" class="link">Create an account</a>
		</p>
	</form>
</AuthShell>
