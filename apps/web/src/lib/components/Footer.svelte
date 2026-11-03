<script lang="ts">
  import BrandIcon from "./BrandIcon.svelte";
</script>

<!-- The close: inverse colours, the ways in, the credits, and the name again at full width. -->
<footer class="@container overflow-hidden bg-ink text-ground">
  <div class="wrap grid gap-x-8 gap-y-14 pt-24 pb-16 md:grid-cols-12 md:pt-32">
    <ul
      class="space-y-2 text-[clamp(1.625rem,1.2rem+1.4vw,2.25rem)] leading-tight font-semibold tracking-[-0.03em] md:col-span-5"
    >
      <li><a href="/characters" class="footer-big">Browse the library</a></li>
      <li><a href="/upload" class="footer-big">Share a character</a></li>
      <li><a href="/convert" class="footer-big">Convert DNA</a></li>
    </ul>

    <div
      class="grid gap-x-8 gap-y-10 text-[0.9375rem] sm:grid-cols-2 md:col-span-7"
    >
      <div class="space-y-2">
        <p class="font-semibold">Games</p>
        <p>Crusader Kings III</p>
        <p class="text-ground/70">More Paradox games once the library grows.</p>
      </div>
      <div class="space-y-2">
        <p class="font-semibold">Made by Tenzin Norden</p>
        <p>
          <a href="https://tenzinnorden.com" class="link">tenzinnorden.com</a>
        </p>
        <p>
          <a
            href="https://github.com/Norden-Tenzin"
            class="link inline-flex items-center gap-1.5"
          >
            <BrandIcon name="github" class="size-4" />GitHub
          </a>
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-3 text-small text-ground/75 md:col-span-12 md:flex-row md:justify-between md:gap-8">
      <p>
        A non-commercial fan project. Not affiliated with or endorsed by Paradox
        Interactive. Crusader Kings is a trademark of Paradox Interactive AB.
      </p>
      <p class="flex shrink-0 gap-6">
        <a href="/terms" class="link">Terms and content rules</a>
        <a href="/privacy" class="link">Privacy</a>
      </p>
    </div>
  </div>

  <!-- The name returns, its feet cut by the page's bottom edge. -->
  <p
    class="monument monument-arrive -mb-[0.12em] px-[calc(var(--margin)-0.04em)] select-none"
    aria-hidden="true"
  >
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
