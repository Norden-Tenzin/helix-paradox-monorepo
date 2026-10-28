<script lang="ts">
	import AuthShell from '#lib/components/AuthShell.svelte';
	import { button } from '#lib/ui.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const expired = $derived(data.error === 'TOKEN_EXPIRED' || data.error === 'token_expired');
	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(data.redirectTo)}`);
</script>

<svelte:head>
	<title>Confirm your email · Helix Paradox</title>
</svelte:head>

<AuthShell
	title={expired ? 'That link has expired' : 'That link didn’t work'}
	intro={expired
		? 'Confirmation links last 24 hours. Sign in and we’ll send you a new one.'
		: 'It may have been used already. Sign in: if your email still needs confirming, we’ll send a new link.'}
>
	<a href={signInHref} class="{button('accent')} w-full">Sign in</a>
</AuthShell>
