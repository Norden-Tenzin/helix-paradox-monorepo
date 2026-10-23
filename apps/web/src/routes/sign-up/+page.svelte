<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { LoaderCircle } from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import { safeRedirect } from '#lib/redirect.ts';
	import { button, input, label } from '#lib/ui.ts';

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
			error = result.error.message ?? 'Sign up failed';
			return;
		}
		await goto(redirectTo, { refreshAll: true });
	}
</script>

<svelte:head>
	<title>Sign up · CK3 Helix</title>
</svelte:head>

<div class="flex min-h-[calc(100dvh-3rem)] items-center justify-center bg-background px-4">
	<form onsubmit={onSubmit} class="w-full max-w-sm space-y-4 rounded-md border border-border bg-card p-6 shadow-sm">
		<h1 class="font-sans text-xl font-black uppercase">Create account</h1>
		<div class="space-y-2">
			<label for="username" class={label}>Username</label>
			<input
				id="username"
				bind:value={username}
				required
				minlength="3"
				maxlength="30"
				pattern="[A-Za-z0-9_.]+"
				title="Letters, numbers, underscores and dots"
				autocomplete="username"
				class="{input} h-9"
			/>
		</div>
		<div class="space-y-2">
			<label for="email" class={label}>Email</label>
			<input id="email" type="email" bind:value={email} required autocomplete="email" class="{input} h-9" />
		</div>
		<div class="space-y-2">
			<label for="password" class={label}>Password</label>
			<input
				id="password"
				type="password"
				bind:value={password}
				required
				minlength="8"
				autocomplete="new-password"
				class="{input} h-9"
			/>
		</div>
		{#if error}<p class="text-sm text-destructive">{error}</p>{/if}
		<button type="submit" disabled={loading} class="{button()} w-full font-mono font-bold">
			{#if loading}<LoaderCircle class="animate-spin" />{/if}
			Sign up
		</button>
		<p class="text-center text-sm text-muted-foreground">
			Already have an account?
			<a href="/sign-in?redirect={encodeURIComponent(redirectTo)}" class="text-primary hover:underline">Sign in</a>
		</p>
	</form>
</div>
