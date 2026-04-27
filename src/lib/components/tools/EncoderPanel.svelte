<script lang="ts">
  import {
    base64Decode,
    base64Encode,
    base64UrlDecode,
    base64UrlEncode,
    hexDecode,
    hexEncode,
    htmlDecode,
    htmlEncode,
    isTransformError,
    unicodeEscape,
    unicodeUnescape,
    urlDecode,
    urlEncode,
    urlEncodeAll
  } from '$lib/utils/transforms';
  import { ArrowLeftRight, Check, Copy } from 'lucide-svelte';

  type Op = {
    id: string;
    label: string;
    description: string;
    encode: (input: string) => string;
    decode: (input: string) => string;
  };

  const operations: Op[] = [
    {
      id: 'url',
      label: 'URL',
      description: 'Standard percent-encoding for query strings and path segments.',
      encode: urlEncode,
      decode: urlDecode
    },
    {
      id: 'url-all',
      label: 'URL (all chars)',
      description: 'Force-encodes every character — useful for filter bypasses.',
      encode: urlEncodeAll,
      decode: urlDecode
    },
    {
      id: 'base64',
      label: 'Base64',
      description: 'Standard base64 with padding.',
      encode: base64Encode,
      decode: base64Decode
    },
    {
      id: 'base64url',
      label: 'Base64 URL',
      description: 'URL-safe base64 used in JWTs and OAuth tokens.',
      encode: base64UrlEncode,
      decode: base64UrlDecode
    },
    {
      id: 'hex',
      label: 'Hex',
      description: 'UTF-8 bytes as space-separated hex pairs.',
      encode: hexEncode,
      decode: hexDecode
    },
    {
      id: 'html',
      label: 'HTML entities',
      description: 'Encode/decode &amp; &lt; &gt; &quot; etc. for context-aware injection tests.',
      encode: htmlEncode,
      decode: htmlDecode
    },
    {
      id: 'unicode',
      label: 'Unicode escape',
      description: 'Escape non-ASCII as \\uXXXX — handy for JSON-context payloads.',
      encode: unicodeEscape,
      decode: unicodeUnescape
    }
  ];

  let selectedId: string = operations[0].id;
  let input = '';
  let copyState: 'encoded' | 'decoded' | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  $: selected = operations.find((op) => op.id === selectedId) ?? operations[0];
  $: encoded = input ? selected.encode(input) : '';
  $: decoded = input ? selected.decode(input) : '';

  async function copyValue(value: string, kind: 'encoded' | 'decoded') {
    if (!value || isTransformError(value)) return;
    try {
      await navigator.clipboard.writeText(value);
      copyState = kind;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copyState = null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  function swap(side: 'encoded' | 'decoded') {
    const value = side === 'encoded' ? encoded : decoded;
    if (!value || isTransformError(value)) return;
    input = value;
  }
</script>

<div class="space-y-4">
  <div class="flex flex-wrap gap-2">
    {#each operations as op}
      <button
        type="button"
        class="hf-chip {selectedId === op.id ? 'hf-chip-active' : ''}"
        on:click={() => (selectedId = op.id)}
      >
        {op.label}
      </button>
    {/each}
  </div>

  <p class="text-sm text-muted-foreground">{selected.description}</p>

  <label class="block">
    <span class="hf-label">Input</span>
    <textarea
      bind:value={input}
      class="hf-input mt-2 min-h-[112px] font-mono text-sm leading-relaxed"
      placeholder={'Type or paste anything — both columns update live.'}
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
    ></textarea>
  </label>

  <div class="grid gap-3 md:grid-cols-2">
    <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
      <div class="mb-2 flex items-center justify-between">
        <span class="hf-label text-xs">Encoded</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="hf-icon-button"
            title="Move to input"
            aria-label="Move encoded value into the input field"
            on:click={() => swap('encoded')}
          >
            <ArrowLeftRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="hf-icon-button"
            title="Copy"
            aria-label="Copy encoded value"
            on:click={() => copyValue(encoded, 'encoded')}
          >
            {#if copyState === 'encoded'}
              <Check size={14} aria-hidden="true" />
            {:else}
              <Copy size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
      </div>
      <pre
        class="max-h-[260px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed {isTransformError(
          encoded
        )
          ? 'text-red-300'
          : 'text-foreground'}">{encoded || '—'}</pre>
    </div>

    <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
      <div class="mb-2 flex items-center justify-between">
        <span class="hf-label text-xs">Decoded</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="hf-icon-button"
            title="Move to input"
            aria-label="Move decoded value into the input field"
            on:click={() => swap('decoded')}
          >
            <ArrowLeftRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="hf-icon-button"
            title="Copy"
            aria-label="Copy decoded value"
            on:click={() => copyValue(decoded, 'decoded')}
          >
            {#if copyState === 'decoded'}
              <Check size={14} aria-hidden="true" />
            {:else}
              <Copy size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
      </div>
      <pre
        class="max-h-[260px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed {isTransformError(
          decoded
        )
          ? 'text-red-300'
          : 'text-foreground'}">{decoded || '—'}</pre>
    </div>
  </div>
</div>
