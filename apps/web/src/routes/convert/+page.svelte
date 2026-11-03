<script lang="ts">
  import Seo from "#lib/components/Seo.svelte";
  import { goto } from "$app/navigation";
  import { ArrowLeftRight, Check, Copy, Upload } from "@lucide/svelte";
  import { convertDna, detectFormat } from "api/dna-convert";
  import Strand from "#lib/components/Strand.svelte";
  import { stashDna } from "#lib/dna-stash.ts";
  import { button, field } from "#lib/ui.ts";

  let input = $state("");
  let pureBlooded = $state(false);
  /** A layout the reader switched to when the DNA fits two equally; "" means detect it. */
  let layout = $state("");
  // New DNA is detected afresh.
  $effect(() => {
    input;
    layout = "";
  });

  const format = $derived(detectFormat(input));
  const result = $derived(
    input.trim()
      ? convertDna(input, { pureBlooded, layout: layout || undefined })
      : null,
  );
  const output = $derived(result?.ok ? result.output : "");
  /** The Ruler Designer side of the pair, whichever way round it is, for the strand and sharing. */
  const rulerText = $derived(
    !result?.ok ? "" : result.from === "base64" ? result.output : input,
  );

  const FORMAT_NAMES = {
    base64: "Base64 code",
    ruler_designer: "Ruler Designer text",
  } as const;
  const outputName = $derived(
    result?.ok
      ? FORMAT_NAMES[result.from === "base64" ? "ruler_designer" : "base64"]
      : "Converted DNA",
  );

  let copied = $state(false);
  let copyFailed = $state(false);
  let outputBox: HTMLTextAreaElement | undefined = $state();

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      copied = true;
      copyFailed = false;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // The clipboard can be refused; select the text so Ctrl+C works.
      copyFailed = true;
      outputBox?.select();
    }
  }

  function swap() {
    if (output) input = output;
  }

  function share() {
    stashDna(rulerText);
    goto("/upload");
  }
</script>

<Seo
  title="CK3 DNA converter · Helix Paradox"
  description="Convert Crusader Kings 3 DNA between base64 codes and Ruler Designer text, both ways, in your browser."
/>

<div class="wrap pt-16 pb-24 sm:pt-24">
  <header class="max-w-[56ch]">
    <h1 class="text-head">DNA converter</h1>
    <p class="mt-4 text-body">
      Crusader Kings III writes DNA two ways: the long Ruler Designer text, and
      a short base64 code found in history files and debug mode. Paste either
      one and get the other.
    </p>
  </header>

  <div
    class="mt-14 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2 [&>*]:min-w-0"
  >
    <!-- What was pasted -->
    <section aria-labelledby="input-label">
      <div
        class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
      >
        <label id="input-label" for="dna-input" class="text-lead font-semibold"
          >Paste DNA</label
        >
        <p class="text-small text-muted" aria-live="polite">
          {format
            ? `Reading it as ${FORMAT_NAMES[format].toLowerCase()}`
            : "Either kind works"}
        </p>
      </div>
      <textarea
        id="dna-input"
        bind:value={input}
        spellcheck="false"
        autocomplete="off"
        class="{field} mt-4 min-h-72 py-3 font-code text-small {result &&
        !result.ok
          ? 'border-danger'
          : ''}"
        placeholder={"ruler_designer_…={\n  genes={\n    hair_color={ 30 13 72 250 }\n\nor a base64 code, like\nHg1I+ioelYHlIjf5…"}
      ></textarea>
      {#if result && !result.ok}
        <p class="mt-2 text-small text-danger" role="alert">{result.error}</p>
      {/if}
      <label class="mt-5 flex items-start gap-3 text-body">
        <input
          type="checkbox"
          bind:checked={pureBlooded}
          class="mt-1.5 size-4 accent-accent"
        />
        <span>
          Pure-blooded
          <span class="block text-small text-muted">
            Copies each gene’s main half onto its hidden half, so children take
            after this face instead of hidden traits.
          </span>
        </span>
      </label>
    </section>

    <!-- What comes out -->
    <section aria-labelledby="output-label">
      <div
        class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
      >
        <h2 id="output-label" class="text-lead font-semibold">{outputName}</h2>
        {#if result?.ok}
          <p class="text-small text-muted">
            {result.layout.name}{#if result.alternatives.length > 0}
              · <button class="link" onclick={() => (layout = result.alternatives[0].id)}>
                Not right? Read it as {result.alternatives[0].name}
              </button>
            {:else if !result.layout.detected}
              · <button class="link" onclick={() => (layout = "")}>Detect again</button>
            {/if}
          </p>
        {/if}
      </div>
      {#if output}
        <textarea
          bind:this={outputBox}
          readonly
          value={output}
          aria-labelledby="output-label"
          spellcheck="false"
          class="{field} mt-4 min-h-72 py-3 font-code text-small {result?.ok &&
          result.from === 'ruler_designer'
            ? 'break-all'
            : ''}"
        ></textarea>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <button class={button("accent")} onclick={copy}>
            {#if copied}<Check /> Copied{:else}<Copy /> Copy{/if}
          </button>
          <button class={button("quiet")} onclick={swap}>
            <ArrowLeftRight /> Convert this back
          </button>
          {#if rulerText}
            <button class={button("quiet")} onclick={share}>
              <Upload /> Share this character
            </button>
          {/if}
        </div>
        {#if copyFailed}
          <p class="mt-2 text-small text-muted">
            Your browser blocked copying. The text is selected, so press Ctrl+C
            or ⌘C.
          </p>
        {/if}
        {#if result?.ok && result.notes.length > 0}
          <ul
            class="mt-6 space-y-2 border-l-2 border-accent bg-surface px-4 py-3 text-small"
            role="status"
          >
            {#each result.notes as note (note)}<li>{note}</li>{/each}
          </ul>
        {/if}
        {#if rulerText}
          <div class="gel-ground mt-8 px-4 pt-4 pb-3">
            <Strand dna={rulerText} variant="map" interactive />
          </div>
        {/if}
      {:else}
        <div
          class="mt-4 flex min-h-72 items-center bg-surface px-6 text-body text-muted"
        >
          The converted DNA shows here as soon as you paste.
        </div>
      {/if}
    </section>
  </div>

  <!-- Where each kind comes from -->
  <section aria-labelledby="where-heading" class="mt-24 max-w-[62ch]">
    <h2 id="where-heading" class="text-lead">Where to find each kind</h2>
    <dl class="mt-6 space-y-6 text-body">
      <div>
        <dt class="font-semibold">Ruler Designer text</dt>
        <dd class="mt-1 text-muted">
          In the Ruler Designer, press Copy DNA. Paste DNA in the same place
          loads it back. This is the kind the library shares.
        </dd>
      </div>
      <div>
        <dt class="font-semibold">Base64 code</dt>
        <dd class="mt-1 text-muted">
          The <code class="font-code text-small text-ink">dna = "…"</code> lines
          in history files and mods, and what debug mode copies from a character.
          It has no beard or hairstyle, so set those in the Ruler Designer afterwards.
        </dd>
      </div>
      <div>
        <dt class="font-semibold">Mods</dt>
        <dd class="mt-1 text-muted">
          Mods that add genes change how base64 DNA is laid out, so a code only
          converts with the mod it came from. We read EPE (current and older
          versions), A Game of Thrones and Elder Kings 2, and tell which one from
          the DNA itself.
        </dd>
      </div>
    </dl>
    <p class="mt-10 text-small text-muted">
      Everything runs in your browser; nothing you paste is sent anywhere. The
      gene tables are built from the game’s and each mod’s own gene files. The
      method comes from
      <a
        href="https://github.com/kyusoo/CK3_Utility"
        class="link"
        target="_blank"
        rel="noopener noreferrer">Kyusoo Kim’s DNA Converter</a
      >
      (MIT License). If a patch adds a shape we don’t know yet, the converter
      says which gene to check.
    </p>
  </section>
</div>
