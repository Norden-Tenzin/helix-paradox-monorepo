<script lang="ts">
  import { ArrowRight } from "@lucide/svelte";

  // utm_source lets RootKeeper's analytics count visitors sent from here.
  const HREF = "https://rootkeeper.org/?utm_source=helixparadox&utm_medium=banner";
</script>

<!-- RootKeeper, the maker's family-tree app: a full-width band above the footer on every page
     (+layout.svelte), with no way to dismiss it, labelled as the maker's own project.

     Modelled on the closing call-to-action of rootkeeper.org: a coral field with a lavender glow
     in one corner and a leaf-green one in the other, a Fraunces headline, Montserrat text. One
     change: RootKeeper sets that section's text in white, which is 2.5:1 on this coral; here it's
     RootKeeper's own dark brown (5.8:1), and white is kept for the button. -->
<aside class="rk" aria-label="RootKeeper, another project by the maker of Helix Paradox">
  <div aria-hidden="true" class="glow glow-lavender"></div>
  <div aria-hidden="true" class="glow glow-leaf"></div>

  <div class="wrap relative grid gap-x-10 gap-y-10 py-20 md:grid-cols-12 md:items-end md:py-28">
    <div class="flex flex-col items-start gap-7 md:col-span-8">
      <p class="chip">From the maker of Helix Paradox</p>
      <p class="headline">
        Rediscover your
        <span class="relative inline-block">
          roots
          <!-- The hand-drawn squiggle from RootKeeper's hero. -->
          <svg class="squiggle" viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 10 C 30 2, 50 2, 70 9 S 120 16, 140 8 S 185 2, 198 8" />
          </svg>
        </span>
      </p>
      <p class="body max-w-[42ch]">
        RootKeeper is my family-tree app. Build your tree together, keep every photo and story in
        one place, and pass it on to the next generation.
      </p>
    </div>

    <div class="flex flex-col items-start gap-3 md:col-span-4 md:items-end">
      <!-- A different site: it opens in a new tab, so Helix Paradox stays where they left it. -->
      <a href={HREF} class="cta" target="_blank" rel="noopener">
        Start for free
        <span class="sr-only">(RootKeeper, opens in a new tab)</span>
        <span class="cta-arrow"><ArrowRight class="size-4" strokeWidth={2.25} /></span>
      </a>
      <p class="note">Free to start · no card needed</p>
    </div>
  </div>
</aside>

<style>
  @font-face {
    font-family: "Fraunces";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("/fonts/fraunces-latin.woff2") format("woff2");
  }
  @font-face {
    font-family: "Montserrat";
    font-style: normal;
    font-weight: 500 600;
    font-display: swap;
    src: url("/fonts/montserrat-latin.woff2") format("woff2");
  }

  /* RootKeeper's palette (rootkeeper.org's stylesheet). */
  .rk {
    --rk-coral: #ff7f51;
    --rk-coral-soft: #ffc4b0;
    --rk-ink: #372615;
    --rk-paper: #fdfbf7;
    --rk-leaf: #8cd173;
    --rk-lavender: #b5b5e3;
    position: relative;
    overflow: hidden;
    isolation: isolate;
    background: var(--rk-coral);
    color: var(--rk-ink);
    color-scheme: light;
    font-family: "Montserrat", ui-sans-serif, system-ui, sans-serif;
  }

  .glow {
    position: absolute;
    z-index: -1;
    border-radius: 999px;
    opacity: 0.6;
    pointer-events: none;
  }
  /* Sized to the screen, so on a phone they stay in their corners and the coral shows between. */
  .glow-lavender {
    top: min(-10rem, -30vw);
    left: min(-10rem, -30vw);
    width: clamp(20rem, 60vw, 36rem);
    height: clamp(20rem, 60vw, 36rem);
    background: radial-gradient(closest-side, var(--rk-lavender), transparent);
  }
  .glow-leaf {
    right: min(-8rem, -25vw);
    bottom: min(-12rem, -30vw);
    width: clamp(18rem, 55vw, 32rem);
    height: clamp(18rem, 55vw, 32rem);
    background: radial-gradient(closest-side, var(--rk-leaf), transparent);
  }

  .chip {
    border-radius: 999px;
    background: rgb(255 255 255 / 0.3);
    padding: 0.3rem 0.8rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  @media (max-width: 30rem) {
    .chip {
      letter-spacing: 0.12em;
    }
  }

  .headline {
    font-family: "Fraunces", Georgia, serif;
    font-weight: 700;
    font-size: clamp(2.75rem, 1.6rem + 4.6vw, 5.25rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  .squiggle {
    position: absolute;
    left: 0;
    bottom: -0.1em;
    width: 100%;
    height: 0.18em;
    overflow: visible;
  }
  .squiggle path {
    fill: none;
    stroke: var(--rk-paper);
    stroke-width: 5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .body {
    font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
    line-height: 1.6;
    text-wrap: pretty;
  }

  /* RootKeeper's light pill: paper fill, ink label, a soft-coral circle round the arrow. */
  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.9rem;
    border-radius: 999px;
    background: var(--rk-paper);
    color: var(--rk-ink);
    padding: 0.5rem 0.5rem 0.5rem 1.6rem;
    font-size: 1.0625rem;
    font-weight: 600;
    box-shadow: 0 12px 28px -12px rgb(55 38 21 / 0.45);
    transition:
      translate 300ms var(--ease-out),
      box-shadow 300ms var(--ease-out);
  }
  .cta:hover {
    translate: 0 -2px;
    box-shadow: 0 16px 32px -12px rgb(55 38 21 / 0.55);
  }
  .cta:focus-visible {
    outline: 2px solid var(--rk-ink);
    outline-offset: 3px;
  }

  .cta-arrow {
    display: inline-grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    background: var(--rk-coral-soft);
    color: var(--rk-ink);
    transition:
      translate 300ms var(--ease-out),
      background-color 300ms var(--ease-out);
  }
  .cta:hover .cta-arrow {
    translate: 3px 0;
    background: var(--rk-coral);
  }

  .note {
    font-size: 0.8125rem;
    font-weight: 500;
    opacity: 0.85;
  }
</style>
