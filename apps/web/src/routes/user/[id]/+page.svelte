<script lang="ts">
	import { apiErrorMessage } from '#lib/api.ts';
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isMyProfile = $derived(data.user?.id === data.profile.id);
	let count = $derived(data.profile.character_count);

	async function handleDelete(id: string) {
		const response = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
		if (!response.ok) throw new Error(await apiErrorMessage(response));
		count -= 1;
	}
</script>

<svelte:head>
	<title>{data.profile.name} · CK3 Helix</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<div class="flex flex-col border-b border-primary bg-card px-4 py-4 shadow-sm">
		<div class="mx-auto flex w-full max-w-5xl items-center gap-4">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/30 font-sans text-4xl font-bold text-primary uppercase"
			>
				{data.profile.name.charAt(0)}
			</div>
			<div class="flex flex-col">
				<h1 class="text-2xl font-bold">{data.profile.name}</h1>
				<p class="text-sm text-muted-foreground">{count} characters</p>
			</div>
		</div>
	</div>
	<CharacterGrid
		initial={data.characters}
		authorId={data.profile.id}
		isOwner={isMyProfile}
		onDelete={handleDelete}
	/>
</div>
