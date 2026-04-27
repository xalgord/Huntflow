<script lang="ts">
  import { decodeJwt, isTransformError } from '$lib/utils/transforms';
  import { AlertTriangle, Check, Clock, Copy, ShieldAlert } from 'lucide-svelte';

  let token = '';
  let copyTarget: 'header' | 'payload' | 'signature' | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  $: parsed = token.trim() ? decodeJwt(token) : null;
  $: isError = typeof parsed === 'string' && isTransformError(parsed);

  function format(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  async function copy(kind: 'header' | 'payload' | 'signature', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      copyTarget = kind;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copyTarget = null), 1200);
    } catch {
      /* swallow */
    }
  }

  function formatDate(ms: number | undefined): string {
    if (!ms) return '—';
    const d = new Date(ms);
    return `${d.toLocaleString()} (${formatRelative(ms)})`;
  }

  function formatRelative(ms: number): string {
    const diff = ms - Date.now();
    const abs = Math.abs(diff);
    const minutes = Math.round(abs / 60000);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const sign = diff < 0 ? 'ago' : 'from now';
    if (minutes < 60) return `${minutes}m ${sign}`;
    if (hours < 48) return `${hours}h ${sign}`;
    return `${days}d ${sign}`;
  }
</script>

<div class="space-y-4">
  <label class="block">
    <span class="hf-label">JWT</span>
    <textarea
      bind:value={token}
      class="hf-input mt-2 min-h-[112px] font-mono text-xs leading-relaxed"
      placeholder="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature"
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
    ></textarea>
  </label>

  <p class="rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
    <ShieldAlert size={14} class="mr-1 inline" aria-hidden="true" />
    Decode-only. Never paste production tokens — copy them out of intercepted requests in your test environment.
  </p>

  {#if parsed && !isError && typeof parsed !== 'string'}
    <div class="grid gap-3 md:grid-cols-3">
      <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
        <div class="mb-2 flex items-center justify-between">
          <span class="hf-label text-xs">Header</span>
          <button
            type="button"
            class="hf-icon-button"
            aria-label="Copy header JSON"
            on:click={() => copy('header', format(parsed.header))}
          >
            {#if copyTarget === 'header'}
              <Check size={14} aria-hidden="true" />
            {:else}
              <Copy size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
        <pre class="max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed text-foreground">{format(parsed.header)}</pre>
      </div>

      <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
        <div class="mb-2 flex items-center justify-between">
          <span class="hf-label text-xs">Payload</span>
          <button
            type="button"
            class="hf-icon-button"
            aria-label="Copy payload JSON"
            on:click={() => copy('payload', format(parsed.payload))}
          >
            {#if copyTarget === 'payload'}
              <Check size={14} aria-hidden="true" />
            {:else}
              <Copy size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
        <pre class="max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed text-foreground">{format(parsed.payload)}</pre>
      </div>

      <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
        <div class="mb-2 flex items-center justify-between">
          <span class="hf-label text-xs">Signature</span>
          <button
            type="button"
            class="hf-icon-button"
            aria-label="Copy raw signature"
            on:click={() => copy('signature', parsed.signature)}
          >
            {#if copyTarget === 'signature'}
              <Check size={14} aria-hidden="true" />
            {:else}
              <Copy size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
        <pre class="max-h-[200px] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">{parsed.signature}</pre>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-[12px] border border-border/70 bg-muted/20 px-3 py-2 text-xs">
        <p class="text-muted-foreground">Algorithm</p>
        <p class="mt-1 font-mono text-sm text-foreground">{parsed.algorithm ?? 'unknown'}</p>
      </div>
      <div class="rounded-[12px] border border-border/70 bg-muted/20 px-3 py-2 text-xs">
        <p class="text-muted-foreground">Issued</p>
        <p class="mt-1 flex items-center gap-1 font-mono text-sm text-foreground">
          <Clock size={12} aria-hidden="true" />{formatDate(parsed.issuedAt)}
        </p>
      </div>
      <div
        class="rounded-[12px] border px-3 py-2 text-xs {parsed.isExpired
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-border/70 bg-muted/20'}"
      >
        <p class="text-muted-foreground">Expires</p>
        <p
          class="mt-1 flex items-center gap-1 font-mono text-sm {parsed.isExpired
            ? 'text-red-300'
            : 'text-foreground'}"
        >
          {#if parsed.isExpired}
            <AlertTriangle size={12} aria-hidden="true" />
          {:else}
            <Clock size={12} aria-hidden="true" />
          {/if}
          {formatDate(parsed.expiresAt)}
        </p>
      </div>
    </div>
  {:else if isError && typeof parsed === 'string'}
    <p class="rounded-[12px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {parsed.replace(/^Error:\s*/, '')}
    </p>
  {:else}
    <p class="rounded-[12px] border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
      Paste a token above to decode header, payload, and metadata.
    </p>
  {/if}
</div>
