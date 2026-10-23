<script lang="ts">
	let { class: className = 'h-6 w-6' }: { class?: string } = $props();
</script>

<div
	class="animate-spin rounded-full border-2 border-muted-foreground border-t-transparent {className}"
	role="status"
	aria-label="Loading"
></div>
