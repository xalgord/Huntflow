<script lang="ts">
  import { randomToken, randomUuid } from '$lib/utils/transforms';
  import { Check, Copy, RefreshCw } from 'lucide-svelte';

  type Encoding = 'hex' | 'base64' | 'base64url';

  let uuid = randomUuid();
  let tokenLen = 32;
  let tokenEncoding: Encoding = 'hex';
  let token = randomToken(tokenLen, tokenEncoding);

  let copied: 'uuid' | 'token' | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  function regenerateUuid() {
    uuid = randomUuid();
  }
  function regenerateToken() {
    const safeLen = Math.max(1, Math.min(256, Math.round(tokenLen)));
    tokenLen = safeLen;
    token = randomToken(safeLen, tokenEncoding);
  }

  // Reactive: regenerate token whenever the user changes length or encoding.
  $: tokenLen, tokenEncoding, regenerateToken();

  async function copy(kind: 'uuid' | 'token') {
    const value = kind === 'uuid' ? uuid : token;
    try {
      await navigator.clipboard.writeText(value);
      copied = kind;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = null), 1200);
    } catch {
      /* swallow */
    }
  }
</script>

<div class="space-y-4">
  <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
    <div class="mb-2 flex items-center justify-between">
      <span class="hf-label text-xs">UUID v4</span>
      <div class="flex items-center gap-1">
        <button type="button" class="hf-icon-button" aria-label="Regenerate UUID" on:click={regenerateUuid}>
          <RefreshCw size={14} aria-hidden="true" />
        </button>
        <button type="button" class="hf-icon-button" aria-label="Copy UUID" on:click={() => copy('uuid')}>
          {#if copied === 'uuid'}
            <Check size={14} aria-hidden="true" />
          {:else}
            <Copy size={14} aria-hidden="true" />
          {/if}
        </button>
      </div>
    </div>
    <code class="block break-all font-mono text-sm text-foreground">{uuid}</code>
  </div>

  <div class="rounded-[14px] border border-border/70 bg-background/60 p-3 shadow-inner-line">
    <div class="flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1">
        <span class="hf-label text-xs">Length (bytes)</span>
        <input
          type="number"
          bind:value={tokenLen}
          min="1"
          max="256"
          class="hf-input w-28 font-mono text-sm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="hf-label text-xs">Encoding</span>
        <select bind:value={tokenEncoding} class="hf-select w-36 text-sm">
          <option value="hex">hex</option>
          <option value="base64">base64</option>
          <option value="base64url">base64url</option>
        </select>
      </label>
      <button type="button" class="hf-button-secondary" on:click={regenerateToken}>
        <RefreshCw size={14} aria-hidden="true" />
        Regenerate
      </button>
      <button type="button" class="hf-icon-button" aria-label="Copy token" on:click={() => copy('token')}>
        {#if copied === 'token'}
          <Check size={14} aria-hidden="true" />
        {:else}
          <Copy size={14} aria-hidden="true" />
        {/if}
      </button>
    </div>
    <code class="mt-3 block break-all font-mono text-xs text-foreground">{token}</code>
  </div>

  <p class="rounded-[12px] border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
    Backed by <code class="font-mono">crypto.getRandomValues</code> — cryptographically random, generated locally. Nothing leaves the page.
  </p>
</div>
