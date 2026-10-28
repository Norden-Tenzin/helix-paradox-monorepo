<script lang="ts">
  import DnaPaste from "#lib/components/DnaPaste.svelte";
  import ImageCredit from "#lib/components/ImageCredit.svelte";
  import Strand from "#lib/components/Strand.svelte";
  import { formatDnaPreview } from "#lib/dna.ts";
  import { reveal } from "#lib/reveal.ts";
  import { SAMPLE_DNA } from "#lib/sample-dna.ts";
  import { button } from "#lib/ui.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const latest = $derived(data.latest.page);
  const total = $derived(data.latest.total);
  // The hero strand is the newest character's DNA, so it changes as people share.
  const featured = $derived(latest[0]);
  const strandDna = $derived(featured?.dna ?? SAMPLE_DNA);
  const dnaPreview = $derived(formatDnaPreview(strandDna, 9));
  let copied = $state(false);
  async function copyFeatured() {
    try {
      await navigator.clipboard.writeText(strandDna);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // Clipboard blocked: the character's page shows the full string to copy by hand.
      if (featured) location.href = `/chara/${featured.id}`;
    }
  }

  const shareHref = $derived(
    data.user
      ? "/upload"
      : `/sign-up?redirect=${encodeURIComponent("/upload")}`,
  );
</script>

<svelte:head>
  <title>Helix Paradox · Character DNA for Crusader Kings III</title>
  <meta
    name="description"
    content="A library of Crusader Kings III characters, shared with their DNA. Copy a face, paste it into the Ruler Designer."
  />
</svelte:head>

<!-- HERO: what the site is for, said plainly, beside a real character you can copy right now.
     The tapestry takes whatever height is left, so the whole hero fits one screen. -->
<section id="top" class="@container flex flex-col sm:h-svh sm:min-h-[720px]">
  <div
    class="relative h-[30svh] overflow-hidden bg-surface sm:h-auto sm:min-h-[140px] sm:flex-1"
  >
    <img
      src="/images/bayeux-comet.jpg"
      alt="The Bayeux Tapestry: Harold is crowned while people point at a comet overhead, 1066."
      width="2400"
      height="1542"
      fetchpriority="high"
      class="drift absolute inset-0 h-full w-full object-cover object-[62%_38%]"
    />
    <ImageCredit
      href="https://commons.wikimedia.org/wiki/File:Bayeux_Tapestry_32-33_comet_Halley_Harold.jpg"
    >
      Bayeux Tapestry, 1070s. Photo by Myrabella, public domain.
    </ImageCredit>
  </div>

  <div class="wrap flex shrink-0 flex-col pt-8 pb-4 sm:pt-10 sm:pb-[28px]">
    <div class="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-12 lg:items-end">
      <div class="lg:col-span-7">
        <h1
          class="text-[clamp(2rem,1.5rem+3.2vw,4rem)] leading-[0.98] tracking-[-0.04em]"
        >
          Share and copy Crusader Kings III DNA.
        </h1>
        <p class="mt-5 max-w-[46ch] text-body text-muted">
          Find a face you like, copy its Ruler Designer DNA and paste it into
          your game. Or share your own.
        </p>
        <div class="mt-7 flex flex-wrap gap-3">
          <a href="/characters" class={button("accent")}>Browse the library</a>
          <a href={shareHref} class={button("quiet")}>Share a character</a>
        </div>
      </div>

      <!-- The thing you come here for: a face, its DNA mapped onto the face, and the button that
           takes it. The dye-coloured map sits on a gel's blue, so the whole card takes it. -->
      <!-- The portrait runs the card's full height beside the name and map; on phones it sits
           beside the name only, and the map takes the full width below. -->
      <div
        class="gel-ground grid lg:col-span-5 lg:col-start-8 {featured
          ? 'grid-cols-[6rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]'
          : 'grid-cols-1'}"
      >
        {#if featured}
          <a
            href="/chara/{featured.id}"
            class="frame block h-36 overflow-hidden bg-raised sm:row-span-2 sm:h-full"
          >
            <img
              src={featured.display_image}
              alt="{featured.name}, shared by {featured.author_name}"
              class="h-full w-full object-cover object-[50%_20%]"
            />
          </a>
        {/if}
        <div
          class="flex min-w-0 flex-col items-start gap-3 p-4 sm:flex-row sm:items-center"
        >
          <div class="min-w-0 max-w-full flex-1">
            {#if featured}
              <a
                href="/chara/{featured.id}"
                class="link block truncate font-semibold">{featured.name}</a
              >
              <p class="truncate text-small text-muted">
                Shared by {featured.author_name}
              </p>
            {:else}
              <p class="font-semibold">A sample character</p>
              <p class="text-small text-muted">Ruler Designer DNA</p>
            {/if}
          </div>
          <button
            type="button"
            class={button("solid", "sm")}
            onclick={copyFeatured}
          >
            {copied ? "Copied" : "Copy DNA"}
          </button>
        </div>
        <div class="col-span-full px-4 pb-3 sm:col-span-1 sm:pt-1">
          <Strand dna={strandDna} variant="map" interactive animate />
        </div>
      </div>
    </div>

    <p
      class="monument mt-12 select-none max-sm:whitespace-normal max-sm:[--monument-em:3.25] sm:mt-10"
      aria-hidden="true"
    >
      <span class="sm:hidden">Helix<br />Paradox</span>
      <span class="max-sm:hidden">Helix Paradox</span>
    </p>
  </div>
</section>

<main id="main">
  <!-- NEWEST FACES: small frames, wide space, scrolling sideways. -->
  <section
    class="flex min-h-[80svh] flex-col justify-center py-24 sm:min-h-svh"
    {@attach reveal}
  >
    {#if latest.length > 0}
      <div
        class="wrap relative z-10 mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
        data-reveal
      >
        <p class="text-lead font-medium">
          Newest faces <span class="text-muted">· {total} in the library</span>
        </p>
        <a href="/characters" class="link text-body">See the whole library</a>
      </div>
      <ul
        class="flex snap-x snap-mandatory gap-[5vw] overflow-x-auto px-[var(--margin)] pb-6 [scrollbar-width:none]"
        data-reveal
      >
        {#each latest as chara (chara.id)}
          <li class="w-[34vw] shrink-0 snap-start sm:w-[16vw] sm:min-w-[180px]">
            <a
              href="/chara/{chara.id}"
              class="frame block aspect-[2/3] overflow-hidden bg-surface"
            >
              <img
                src={chara.display_image}
                alt="{chara.name}, shared by {chara.author_name}"
                loading="lazy"
                class="h-full w-full object-cover"
              />
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="wrap" data-reveal>
        <p class="max-w-[24ch] text-head font-semibold tracking-[-0.03em]">
          The library is waiting for its first face.
        </p>
        <a href={shareHref} class="{button('accent')} mt-8"
          >Share the first character</a
        >
      </div>
    {/if}
  </section>

  <!-- HOW IT WORKS: one reading column, each step with its evidence. -->
  <section class="wrap pb-[clamp(120px,14vw,220px)]">
    <div class="mx-auto max-w-[600px]">
      <h2 class="text-[clamp(1.75rem,1.4rem+1vw,2rem)]" {@attach reveal}>
        <span class="block" data-reveal>Into your game in a minute</span>
      </h2>

      <div
        class="mt-12 space-y-[72px] text-[1.0625rem] leading-[1.6] max-sm:space-y-14"
      >
        <div {@attach reveal}>
          <p data-reveal>
            <strong class="font-semibold">Find a face.</strong> Every character here
            was made in the Ruler Designer and shared with its DNA, the string of
            gene pairs the game uses to draw a face. Filter by EPE, CFP or vanilla,
            so what you copy looks the same in your game.
          </p>
          <div data-ui data-reveal class="mt-5 bg-surface">
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <span class="text-small text-muted"
                >{featured ? featured.name : "Sample character"} · DNA</span
              >
              <button
                type="button"
                class={button("quiet", "sm")}
                onclick={copyFeatured}
              >
                {copied ? "Copied" : "Copy DNA"}
              </button>
            </div>
            <pre
              class="overflow-hidden px-4 pb-4 text-[0.8125rem] leading-relaxed text-muted">{dnaPreview}</pre>
          </div>
        </div>

        <div {@attach reveal}>
          <p data-reveal>
            <strong class="font-semibold">Copy it, then paste it.</strong> Press
            Copy DNA on a character's page. In the game, open the Ruler Designer
            or the barbershop and choose Paste DNA. The face arrives whole, down
            to the height of the brow.
          </p>
          <figure class="mt-5" data-reveal>
            <img
              src="/images/effigy-lady.jpg"
              alt="A carved stone tomb effigy of a lady lying with her hands folded, on a stone base."
              width="1600"
              height="1180"
              loading="lazy"
              class="aspect-video w-full object-cover object-[50%_35%]"
            />
            <figcaption class="mt-2 text-small text-muted">
              A face made to outlast its owner.
              <a
                href="https://www.metmuseum.org/art/collection/search/471462"
                class="link">Tomb Effigy of a Lady</a
              >, France, mid-13th century. The Met, CC0.
            </figcaption>
          </figure>
        </div>

        <div {@attach reveal}>
          <p data-reveal>
            <strong class="font-semibold">Share your own.</strong> In the game, press
            Copy DNA on your character and paste it here. Its strand draws as you
            paste, so you can see the string is whole before you upload a portrait.
          </p>
          <div class="mt-5" data-reveal>
            <DnaPaste signedIn={!!data.user} />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA: the whole band is the button. -->
  <!-- <a
    href={shareHref}
    class="cta group relative flex h-[46svh] flex-col bg-white text-accent-ink sm:h-[60svh]"
  >
    <span class="wrap flex items-start justify-between gap-6 pt-5">
      <span class="max-w-[30ch] text-[1.0625rem] font-medium">
        Upload a portrait and its DNA. Anyone can wear the face in their own
        campaign.
      </span>
      <svg
        viewBox="0 0 48 48"
        class="arrow size-8 shrink-0 sm:size-12"
        aria-hidden="true"
      >
        <path
          d="M12 36 36 12M16 12h20v20"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
        />
      </svg>
    </span>
    <span
      class="mt-auto px-[calc(var(--margin)-0.05em)] pb-[24px] text-[clamp(5rem,30vw,32rem)] leading-[0.78] font-extrabold tracking-[-0.06em]"
    >
      Share
    </span>
  </a> -->
</main>

<style>
  .frame img {
    transition: scale 250ms var(--ease-out);
  }
  .frame:hover img,
  .frame:focus-visible img {
    scale: 1.1;
  }
  .cta:hover,
  .cta:focus-visible {
    background: var(--color-accent);
    color: var(--bg);
  }
  .arrow {
    transition: translate 250ms var(--ease-out);
  }
  .cta:hover .arrow {
    translate: 4px -4px;
  }
</style>
