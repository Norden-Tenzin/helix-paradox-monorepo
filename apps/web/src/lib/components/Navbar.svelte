<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronDown } from '@lucide/svelte';
	import { DropdownMenu } from 'bits-ui';
	import { authClient } from '#lib/auth-client.ts';
	import type { Me } from '#lib/api.ts';
	import { menuContent, menuItem } from '#lib/ui.ts';

	let { user }: { user: Me | null } = $props();

	// On the home page the bar sits over the tapestry, on a scrim so it reads against the stitching.
	const overPicture = $derived(page.url.pathname === '/');
	const shareHref = $derived(user ? '/upload' : `/sign-up?redirect=${encodeURIComponent('/upload')}`);
	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);
	const current = (path: string) => (page.url.pathname.startsWith(path) ? 'page' : undefined);

	async function signOut() {
		await authClient.signOut();
		await refreshAll();
		goto('/');
	}
</script>

<a
	href="#main"
	class="fixed top-2 left-2 z-50 -translate-y-24 bg-accent px-4 py-2 text-small text-accent-ink focus:translate-y-0"
>
	Skip to content
</a>

<header
	class={overPicture
		? 'scrim absolute inset-x-0 top-0 z-20 text-ink'
		: 'sticky top-0 z-20 bg-ground text-ink'}
>
	<nav class="wrap flex h-16 items-center gap-4 text-[0.9375rem] sm:gap-6" aria-label="Main">
		<a href="/" class="mr-auto text-lead font-semibold tracking-[-0.03em] max-sm:text-body">Helix Paradox</a>

		<a href="/characters" class="nav-link" aria-current={current('/characters')}>Library</a>
		<a href={shareHref} class="nav-link" aria-current={current('/upload')}>
			Share<span class="hidden sm:inline">&nbsp;a character</span>
		</a>

		{#if user}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="nav-link inline-flex items-center gap-1" aria-label="Account menu">
					{user.name}
					<ChevronDown class="size-4" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content align="end" sideOffset={8} class={menuContent}>
						<DropdownMenu.Item class={menuItem} onSelect={() => goto(`/user/${user.id}`)}>
							Your characters
						</DropdownMenu.Item>
						<DropdownMenu.Item class={menuItem} onSelect={() => goto('/upload')}>
							Share a character
						</DropdownMenu.Item>
						{#if user.admin}
							<DropdownMenu.Item class={menuItem} onSelect={() => goto('/admin')}>Admin</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Item class={menuItem} onSelect={signOut}>Sign out</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		{:else}
			<a href={signInHref} class="nav-link" aria-current={current('/sign-in')}>Sign in</a>
		{/if}
	</nav>
</header>

<style>
	.scrim {
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--bg) 88%, transparent),
			color-mix(in oklab, var(--bg) 55%, transparent) 60%,
			transparent
		);
		padding-bottom: 2.5rem;
		text-shadow: 0 1px 12px color-mix(in oklab, var(--bg) 70%, transparent);
	}
	:global(.nav-link) {
		position: relative;
		padding-block: 0.5rem;
		font-weight: 500;
	}
	:global(.nav-link)::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		bottom: 0.2rem;
		height: 2px;
		background: currentColor;
		scale: 0 1;
		transform-origin: left;
		transition: scale 250ms var(--ease-out);
	}
	:global(.nav-link:hover)::after,
	:global(.nav-link[aria-current='page'])::after {
		scale: 1 1;
	}
</style>
