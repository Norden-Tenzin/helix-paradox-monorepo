<script lang="ts">
	import CharacterGrid from '#lib/components/CharacterGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="flex min-h-screen flex-col bg-background">
	<CharacterGrid initial={data.characters} />
</div>
