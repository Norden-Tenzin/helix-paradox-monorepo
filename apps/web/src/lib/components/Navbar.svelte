<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Upload } from '@lucide/svelte';
	import { DropdownMenu } from 'bits-ui';
	import { authClient } from '#lib/auth-client.ts';
	import type { Me } from '#lib/api.ts';
	import { button, menuContent, menuItem } from '#lib/ui.ts';

	let { user }: { user: Me | null } = $props();

	const signUpHref = $derived(`/sign-up?redirect=${encodeURIComponent('/upload')}`);
	const signInHref = $derived(`/sign-in?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);

	async function signOut() {
		await authClient.signOut();
		await refreshAll();
		goto('/');
	}
</script>

<header class="sticky top-0 z-20 w-full bg-background/80 backdrop-blur">
	<div class="flex h-12 items-center justify-between px-5">
		<a href="/" class="px-0 font-sans text-lg font-black">CK3-HELIX</a>

		<div class="flex items-center gap-2">
			<span class="font-mono text-sm text-muted-foreground">WIP</span>

			{#if user}
				<a href="/upload" class="{button('default', 'sm')} font-mono font-bold">
					<Upload />
					Add Character
				</a>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{button('default', 'icon')} h-8 w-8 font-sans text-xl font-bold uppercase"
						aria-label="Account menu"
					>
						{user.name.at(0)}
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content align="end" sideOffset={4} class={menuContent}>
							<div class="px-2 py-1.5 text-sm font-semibold">My Account</div>
							<DropdownMenu.Separator class="-mx-1 my-1 h-px bg-secondary" />
							<DropdownMenu.Item class={menuItem} onSelect={() => goto('/upload')}>Add New</DropdownMenu.Item>
							<DropdownMenu.Item class={menuItem} onSelect={() => goto(`/user/${user.id}`)}>Profile</DropdownMenu.Item>
							<DropdownMenu.Item
								class="{menuItem} data-highlighted:bg-red-500! data-highlighted:text-white!"
								onSelect={signOut}
							>
								Sign out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{:else}
				<a href={signUpHref} class="{button('default', 'sm')} font-mono font-bold">
					<Upload />
					Add Character
				</a>
				<a href={signInHref} class={button('secondary', 'sm')}>Sign in</a>
				<a href="/sign-up" class={button('default', 'sm')}>Sign up</a>
			{/if}
		</div>
	</div>
</header>
