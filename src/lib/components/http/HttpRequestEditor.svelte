<script lang="ts">
  import {
    parseCurl,
    parseRawHttpRequest,
    summarizeHttpRequest,
    toCurl,
    toRawHttp,
    type HttpRequest
  } from '$lib/utils/http';
  import { ArrowLeftRight, Check, Copy, Download } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let initialContent = '';
  export let initialFormat: 'raw' | 'curl' = 'raw';

  export let allowInsert = false;

  const dispatch = createEventDispatcher<{
    change: { request: HttpRequest | null; raw: string; format: 'raw' | 'curl' };
    insert: { markdown: string; raw: string; format: 'raw' | 'curl' };
  }>();

  function handleInsert() {
    if (!content.trim()) return;
    const fence = format === 'curl' ? 'bash' : 'http';
    const heading = parsed
      ? `**${summarizeHttpRequest(parsed)}**`
      : `**HTTP Request (${format})**`;
    const markdown = `${heading}\n\n\`\`\`${fence}\n${content.trim()}\n\`\`\``;
    dispatch('insert', { markdown, raw: content, format });
  }

  let content = initialContent;
  let format: 'raw' | 'curl' = initialFormat;
  let copied = false;
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  $: parsed = (() => {
    if (!content.trim()) return null;
    if (format === 'curl') return parseCurl(content);
    return parseRawHttpRequest(content);
  })();
  $: dispatch('change', { request: parsed, raw: content, format });

  function convertFormat() {
    if (!parsed) {
      format = format === 'raw' ? 'curl' : 'raw';
      return;
    }
    const next: 'raw' | 'curl' = format === 'raw' ? 'curl' : 'raw';
    content = next === 'curl' ? toCurl(parsed) : toRawHttp(parsed);
    format = next;
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => (copied = false), 1500);
    } catch (error) {
      console.error('Copy failed', error);
    }
  }

  function downloadContent() {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const summary = parsed ? summarizeHttpRequest(parsed).replace(/[^a-zA-Z0-9]+/g, '_') : 'request';
    link.download = format === 'curl' ? `${summary}.sh` : `${summary}.http`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const placeholders = {
    raw: `POST /api/users/123 HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer eyJ...\nContent-Type: application/json\n\n{"role":"admin"}`,
    curl: `curl -X POST 'https://api.example.com/api/users/123' \\\n  -H 'Authorization: Bearer eyJ...' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"role":"admin"}'`
  };
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center gap-2">
    <div class="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={format === 'raw'}
        class="rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition {format === 'raw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        on:click={() => (format = 'raw')}
      >
        Raw HTTP
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={format === 'curl'}
        class="rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition {format === 'curl' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        on:click={() => (format = 'curl')}
      >
        cURL
      </button>
    </div>
    <button
      type="button"
      class="hf-button-secondary"
      disabled={!parsed}
      on:click={convertFormat}
    >
      <ArrowLeftRight size={14} aria-hidden="true" />
      Convert
    </button>
    <button type="button" class="hf-button-secondary" disabled={!content} on:click={copyContent}>
      {#if copied}
        <Check size={14} class="text-primary" aria-hidden="true" />
        Copied
      {:else}
        <Copy size={14} aria-hidden="true" />
        Copy
      {/if}
    </button>
    <button type="button" class="hf-button-secondary" disabled={!content} on:click={downloadContent}>
      <Download size={14} aria-hidden="true" />
      Download
    </button>

    {#if allowInsert}
      <button type="button" class="hf-button-primary" disabled={!content.trim()} on:click={handleInsert}>
        Insert into report
      </button>
    {/if}

    {#if parsed}
      <span class="op-mono ml-auto text-[11px] text-muted-foreground">
        {summarizeHttpRequest(parsed)}
      </span>
    {/if}
  </div>

  <textarea
    bind:value={content}
    rows="10"
    spellcheck="false"
    class="hf-input op-mono whitespace-pre text-[12.5px] leading-5"
    placeholder={placeholders[format]}
  ></textarea>

  {#if content && !parsed}
    <p class="text-xs text-amber-400">
      Could not parse {format === 'raw' ? 'raw HTTP' : 'cURL'}. Conversion and download still work
      with the raw text.
    </p>
  {/if}
</div>
