<script lang="ts">
	import { Mail } from '@lucide/svelte';
	import BrandIcon from './BrandIcon.svelte';
</script>

<div class="flex h-[50vh] flex-col items-start justify-between bg-black px-10 py-10 text-white">
	<a href="https://tenzinnorden.com">
		<img src="/favicon.ico" alt="" class="aspect-square w-20 object-cover hover:opacity-80" />
	</a>
	<div class="flex w-full flex-col font-mono text-[80px] leading-none font-extrabold text-white">
		JULLEY
		<p class="mb-2 text-xs font-normal">powered by tenzin norden</p>
		<div class="flex w-full flex-row justify-center space-x-5">
			<a href="mailto:nordentenzinwork@gmail.com" aria-label="Email">
				<Mail class="size-4 hover:text-white/80" />
			</a>
			<a href="https://github.com/Norden-Tenzin" aria-label="GitHub">
				<BrandIcon name="github" class="size-4 hover:text-white/80" />
			</a>
			<a href="https://www.linkedin.com/in/tenzin-norden" aria-label="LinkedIn">
				<BrandIcon name="linkedin" class="size-4 hover:text-white/80" />
			</a>
			<a href="https://www.instagram.com/nordten/" aria-label="Instagram">
				<BrandIcon name="instagram" class="size-4 hover:text-white/80" />
			</a>
		</div>
	</div>
</div>
