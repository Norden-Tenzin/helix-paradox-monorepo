<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { LoaderCircle } from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import { safeRedirect } from '#lib/redirect.ts';
	import { button, input, label } from '#lib/ui.ts';

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
			error = result.error.message ?? 'Sign in failed';
			return;
		}
		await goto(redirectTo, { refreshAll: true });
	}
</script>

<svelte:head>
	<title>Sign in · CK3 Helix</title>
</svelte:head>

<div class="flex min-h-[calc(100dvh-3rem)] items-center justify-center bg-background px-4">
	<form onsubmit={onSubmit} class="w-full max-w-sm space-y-4 rounded-md border border-border bg-card p-6 shadow-sm">
		<h1 class="font-sans text-xl font-black uppercase">Sign in</h1>
		<div class="space-y-2">
			<label for="identifier" class={label}>Username or email</label>
			<input id="identifier" bind:value={identifier} required autocomplete="username" class="{input} h-9" />
		</div>
		<div class="space-y-2">
			<label for="password" class={label}>Password</label>
			<input
				id="password"
				type="password"
				bind:value={password}
				required
				autocomplete="current-password"
				class="{input} h-9"
			/>
		</div>
		{#if error}<p class="text-sm text-destructive">{error}</p>{/if}
		<button type="submit" disabled={loading} class="{button()} w-full font-mono font-bold">
			{#if loading}<LoaderCircle class="animate-spin" />{/if}
			Sign in
		</button>
		<p class="text-center text-sm text-muted-foreground">
			No account?
			<a href="/sign-up?redirect={encodeURIComponent(redirectTo)}" class="text-primary hover:underline">Sign up</a>
		</p>
	</form>
</div>
