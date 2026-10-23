<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<div
	class="flex h-4.5 flex-row items-center rounded-full border-2 border-blue-400 bg-sky-200 px-2 text-sm text-blue-500"
>
	{text}
</div>
