<script lang="ts">
	import BrandIcon from './BrandIcon.svelte';
</script>

<!-- The close: inverse colours, the ways in, the credits, and the name again at full width. -->
<footer class="overflow-hidden bg-ink text-ground">
	<div class="wrap grid gap-x-8 gap-y-14 pt-24 pb-16 md:grid-cols-12 md:pt-32">
		<ul class="space-y-2 text-[clamp(1.625rem,1.2rem+1.4vw,2.25rem)] leading-tight font-semibold tracking-[-0.03em] md:col-span-5">
			<li><a href="/characters" class="footer-big">Browse the library</a></li>
			<li><a href="/upload" class="footer-big">Share a character</a></li>
			<li><a href="#top" class="footer-big">Back to the top</a></li>
		</ul>

		<div class="grid gap-x-8 gap-y-10 text-[0.9375rem] sm:grid-cols-3 md:col-span-7">
			<div class="space-y-2">
				<p class="font-semibold">Games</p>
				<p>Crusader Kings III</p>
				<p class="text-ground/70">More Paradox games once the library grows.</p>
			</div>
			<div class="space-y-2">
				<p class="font-semibold">Made by Tenzin Norden</p>
				<p><a href="https://tenzinnorden.com" class="link">tenzinnorden.com</a></p>
				<p>
					<a href="https://github.com/Norden-Tenzin" class="link inline-flex items-center gap-1.5">
						<BrandIcon name="github" class="size-4" />GitHub
					</a>
				</p>
				<p><a href="mailto:nordentenzinwork@gmail.com" class="link">nordentenzinwork@gmail.com</a></p>
			</div>
			<div class="space-y-2">
				<p class="font-semibold">Pictures</p>
				<p>
					<a href="https://commons.wikimedia.org/wiki/File:Bayeux_Tapestry_32-33_comet_Halley_Harold.jpg" class="link">Bayeux Tapestry, Harold and the comet</a>
					and
					<a href="https://commons.wikimedia.org/wiki/File:Bayeux_Tapestry_scene23_Harold_oath_William.jpg" class="link">Harold's oath</a>,
					photographs by Myrabella, public domain.
					<a href="https://www.metmuseum.org/art/collection/search/471462" class="link">Tomb Effigy of a Lady</a>,
					France, mid-13th century, The Met, CC0.
				</p>
			</div>
		</div>

		<p class="text-small text-ground/75 md:col-span-12">
			A fan project. Not affiliated with or endorsed by Paradox Interactive. Crusader Kings is a trademark of
			Paradox Interactive AB.
		</p>
	</div>

	<!-- The name returns, its feet cut by the page's bottom edge. -->
	<p class="monument monument-arrive -mb-[0.12em] px-[calc(var(--margin)-0.04em)] select-none" aria-hidden="true">
		Helix Paradox
	</p>
</footer>

<style>
	.footer-big {
		display: inline-block;
		transition:
			color 200ms var(--ease-out),
			translate 250ms var(--ease-out);
	}
	.footer-big:hover {
		color: var(--accent-deep);
		translate: 0.25rem 0;
	}
</style>
