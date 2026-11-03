<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { page } from "$app/state";
  import { Check, Copy, ExternalLink } from "@lucide/svelte";
  import CharacterCard from "#lib/components/CharacterCard.svelte";
  import CollectionCard from "#lib/components/CollectionCard.svelte";
  import CollectionButton from "#lib/components/CollectionButton.svelte";
  import FavouriteButton from "#lib/components/FavouriteButton.svelte";
  import ReportButton from "#lib/components/ReportButton.svelte";
  import Strand from "#lib/components/Strand.svelte";
  import WorksButton from "#lib/components/WorksButton.svelte";
  import { parseDna } from "#lib/dna.ts";
  import { REPORT_REASON_LABELS } from "#lib/reports.ts";
  import { button } from "#lib/ui.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const character = $derived(data.character);
  const images = $derived([character.display_image, ...character.grid_images]);
  const geneCount = $derived(parseDna(character.dna).length);
  const isOwner = $derived(data.user?.id === character.author_id);
  const shareText = $derived(
    `${character.name}, a Crusader Kings III character${character.mods.length ? ` (${character.mods.map((m) => m.name).join(", ")})` : ""} by ${character.author_name}. Copy the DNA and paste it into the Ruler Designer.`,
  );
  const longDate = (ms: number) =>
    new Date(ms).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const posted = $derived(longDate(character.posted_at));
  // Shown once it's been changed after posting (a minute's grace for the upload itself).
  const edited = $derived(
    character.updated_at - character.posted_at > 60_000
      ? longDate(character.updated_at)
      : null,
  );

  // Count a view once the page is in a browser (not on the server, so link previews and
  // prefetches don't count). Views aren't shown anywhere yet.
  $effect(() => {
    fetch(`/api/characters/${character.id}/view`, { method: "POST" }).catch(
      () => {},
    );
  });

  let shown = $state(0);
  $effect.pre(() => {
    // Back to the first picture when navigating to another character.
    void character.id;
    shown = 0;
  });

  let copied = $state(false);
  let copyFailed = $state(false);
  async function copyDna() {
    try {
      await navigator.clipboard.writeText(character.dna);
      copied = true;
      copyFailed = false;
      setTimeout(() => (copied = false), 1600);
    } catch {
      copyFailed = true;
    }
  }
</script>

<!-- Share previews (chat apps, social sites) need absolute URLs, and show the portrait large. -->
<svelte:head>
  <title>{character.name} · Helix Paradox</title>
  <meta name="description" content={shareText} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{character.name} · Helix Paradox" />
  <meta property="og:description" content={shareText} />
  <meta property="og:url" content={page.url.origin + page.url.pathname} />
  <meta
    property="og:image"
    content={new URL(character.display_image, page.url.origin).href}
  />
  <meta property="og:image:alt" content="Portrait of {character.name}" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<article
  class="wrap grid grid-cols-1 gap-x-12 gap-y-10 pt-8 pb-24 lg:grid-cols-12 [&>*]:min-w-0"
>
  <!-- Portraits -->
  <div class="lg:col-span-7">
    <!-- Every picture sits in the same grid cell and only the chosen one shows, so the box is as
         tall as the tallest picture: switching between portrait and landscape doesn't move the
         thumbnails, and the others are already loaded when picked. -->
    <div class="grid bg-surface">
      {#each images as img, i (i)}
        <img
          src={img}
          alt="Portrait of {character.name}{i > 0
            ? `, picture ${i + 1} of ${images.length}`
            : ''}"
          class="col-start-1 row-start-1 mx-auto max-h-[78svh] w-full self-center object-contain {i ===
          shown
            ? ''
            : 'invisible'}"
        />
      {/each}
    </div>
    {#if images.length > 1}
      <div
        class="mt-3 grid grid-cols-4 gap-3"
        role="group"
        aria-label="Pictures"
      >
        {#each images as img, i (i)}
          <button
            type="button"
            class="overflow-hidden bg-surface transition-opacity aria-[current=true]:opacity-100 aria-[current=false]:opacity-50 hover:opacity-100"
            aria-current={i === shown}
            aria-label="Show picture {i + 1}"
            onclick={() => (shown = i)}
          >
            <!-- Cropped towards the top, where the face usually is. -->
            <img
              src={img}
              alt=""
              class="aspect-[2/3] w-full object-cover object-[50%_20%]"
            />
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Facts and the DNA -->
  <div class="lg:col-span-5 lg:pt-4">
    {#if character.hidden && !isOwner && data.user?.admin}
      <p
        class="mb-8 border-l-2 border-danger bg-surface px-5 py-4 text-small"
        role="status"
      >
        Hidden after reports. Only its owner and admins can see it. <a
          href="/admin"
          class="link">Review the reports</a
        >
      </p>
    {/if}
    {#if isOwner && (character.hidden || character.open_reports.length > 0)}
      <!-- Only the owner sees this: what people reported, never who. -->
      <div
        class="mb-8 border-l-2 border-danger bg-surface px-5 py-4"
        role="status"
      >
        <p class="font-semibold">
          {character.hidden
            ? "Hidden while reports are reviewed"
            : "People have reported a problem"}
        </p>
        <p class="mt-1 text-small text-muted">
          {character.hidden
            ? "Only you can see this character until someone reviews the reports."
            : "If more people report it, it’s hidden until someone reviews the reports."}
          Fixing the problem (say, editing the DNA) helps the review.
        </p>
        <ul class="mt-3 space-y-1 text-small">
          {#each character.open_reports as r (r.reason)}
            <li>{REPORT_REASON_LABELS[r.reason]}: {r.count}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <h1 class="text-head">{character.name}</h1>
    <dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-body">
      <dt class="text-muted">Shared by</dt>
      <dd>
        <a href="/user/{character.author_id}" class="link"
          >{character.author_name}</a
        >
      </dd>
      <dt class="text-muted">Posted</dt>
      <dd>{posted}</dd>
      {#if edited}
        <dt class="text-muted">Edited</dt>
        <dd>{edited}</dd>
      {/if}
      <dt class="text-muted">Mods</dt>
      <dd>
        {#each character.mods as mod, i (mod.id)}{#if i > 0},
          {/if}{#if mod.url}<a
              href={mod.url}
              class="link"
              target="_blank"
              rel="noopener noreferrer">{mod.name}</a
            >{:else}{mod.name}{/if}{#if mod.pending}
            <span class="text-muted">(not yet listed)</span>{/if}{/each}
      </dd>
      <dt class="text-muted">Sex</dt>
      <dd>{character.sex === "female" ? "Female" : "Male"}</dd>
      <!-- Height and build are stored and returned by the API but not shown: they didn't add much. -->
    </dl>

    {#if character.tags.length > 0}
      <ul class="mt-5 flex flex-wrap gap-2" aria-label="Tags">
        {#each character.tags as tag (tag.id)}
          <li>
            <a
              href="/characters?tags={tag.id}"
              class="inline-flex h-8 items-center bg-surface px-3 text-small text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              {tag.name}
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    {#if character.description}
      <p class="mt-6 max-w-[60ch] text-body whitespace-pre-line">
        {character.description}
      </p>
    {/if}

    {#if character.needs.length > 0}
      <!-- Before the Copy button: without the mod, the game drops these genes and the face comes out wrong. -->
      <div
        class="mt-8 border-l-2 border-accent bg-surface px-5 py-4"
        aria-labelledby="needs-heading"
      >
        <p id="needs-heading" class="font-semibold">
          Needs {character.needs.map((m) => m.name).join(" and ")} installed
        </p>
        <ul class="mt-2 space-y-2 text-small text-muted">
          {#each character.needs as mod (mod.id)}
            <li>
              {#if mod.genes > 0}
                Without {mod.name}, the game ignores {mod.genes} of this DNA’s genes.
              {:else}
                Made with {mod.name}.
              {/if}
              {#if mod.url}
                <a
                  href={mod.url}
                  class="link inline-flex items-center gap-1 text-ink"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Get {mod.name}<ExternalLink
                    class="size-3.5"
                    aria-hidden="true"
                  /></a
                >
              {:else if mod.pending}
                We don’t list this mod yet, so there’s no link.
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="mt-8 flex flex-wrap items-center gap-4">
      <button class={button("accent")} onclick={copyDna}>
        {#if copied}<Check /> Copied{:else}<Copy /> Copy DNA{/if}
      </button>
      <FavouriteButton
        id={character.id}
        count={character.favourite_count}
        favourited={character.favourited}
        signedIn={!!data.user}
      />
      <WorksButton
        id={character.id}
        count={character.confirm_count}
        confirmed={character.confirmed}
        signedIn={!!data.user}
        {isOwner}
      />
      <!-- Adding to a collection favourites it too; reload the character so the count shows it. -->
      <CollectionButton
        id={character.id}
        name={character.name}
        signedIn={!!data.user}
        onFavourited={() =>
          invalidate(
            (url) => url.pathname === `/api/characters/${character.id}`,
          )}
      />
      {#if isOwner}
        <a href="/upload/{character.id}" class="link text-body">Edit</a>
      {/if}
    </div>
    {#if !isOwner}
      <p class="mt-4">
        <ReportButton
          id={character.id}
          name={character.name}
          reported={character.reported}
          signedIn={!!data.user}
        />
      </p>
    {/if}
    <p class="mt-3 text-small text-muted" aria-live="polite">
      {#if copyFailed}
        Your browser blocked the clipboard. Select the DNA below and copy it by
        hand.
      {:else if copied}
        In the game, open the Ruler Designer and choose Paste DNA.
      {:else}
        Then, in the game, open the Ruler Designer and choose Paste DNA.
      {/if}
    </p>

    <div class="gel-ground mt-10 px-4 pt-4 pb-3">
      <Strand dna={character.dna} variant="map" interactive />
    </div>
  </div>

  <section class="lg:col-span-12" aria-labelledby="dna-heading">
    <h2 id="dna-heading" class="text-lead">
      The DNA <span class="text-muted">· {geneCount} genes</span>
    </h2>
    <!-- Focusable so keyboard users can scroll the long string. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <pre
      aria-label="DNA string"
      class="mt-4 max-h-96 overflow-auto bg-surface p-5 text-[0.8125rem] leading-relaxed text-ink/85"
      tabindex="0">{character.dna}</pre>
  </section>

  <!-- {#if data.similar.length > 0}
		Faces whose DNA is closest to this one (same game), from GET /api/characters/:id/similar.
		<section class="lg:col-span-12" aria-labelledby="similar-heading">
			<h2 id="similar-heading" class="text-lead">More like this</h2>
			<p class="mt-2 text-small text-muted">The closest faces in the library, going by their DNA.</p>
			<div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5">
				{#each data.similar as chara (chara.id)}
					<CharacterCard {chara} />
				{/each}
			</div>
		</section>
	{/if} -->

  {#if data.fromUploader.length > 0}
    <section class="lg:col-span-12" aria-labelledby="uploader-heading">
      <div
        class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
      >
        <h2 id="uploader-heading" class="text-lead">
          More from {character.author_name}
        </h2>
        <a href="/user/{character.author_id}" class="link text-body"
          >See all their characters</a
        >
      </div>
      <div
        class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5"
      >
        {#each data.fromUploader as chara (chara.id)}
          <CharacterCard {chara} />
        {/each}
      </div>
    </section>
  {/if}

  {#if data.collections.length > 0}
    <section class="lg:col-span-12" aria-labelledby="collections-heading">
      <h2 id="collections-heading" class="text-lead">
        <!-- The API lists at most 12. -->
        In {data.collections.length}{data.collections.length >= 12 ? "+" : ""}
        {data.collections.length === 1
          ? "public collection"
          : "public collections"}
      </h2>
      <p class="mt-2 text-small text-muted">
        Lists people made that include this character.
      </p>
      <div
        class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"
      >
        {#each data.collections as collection (collection.id)}
          <CollectionCard {collection} />
        {/each}
      </div>
    </section>
  {/if}
</article>

