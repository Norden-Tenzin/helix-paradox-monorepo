<script lang="ts">
	import type { Snippet } from 'svelte';

	// A picture's credit, set in its bottom corner on a dark backing so it reads on pale linen.
	// The parent must be positioned. Sources and licences are in static/images/credits.json.
	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<p class="absolute right-0 bottom-0 bg-ground/75 px-2 py-1 text-[0.6875rem] leading-snug text-ink/85">
	<a {href} class="link">{@render children()}</a>
</p>
