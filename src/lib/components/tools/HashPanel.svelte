<script lang="ts">
  import { digest } from '$lib/utils/transforms';
  import { Check, Copy } from 'lucide-svelte';

  type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
  const algorithms: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

  let input = '';
  let results: Record<Algo, string> = { 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' };
  let copied: Algo | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  // Reactive recompute — Web Crypto is async so we await each algorithm.
  $: void recompute(input);
  async function recompute(value: string) {
    if (!value) {
      results = { 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' };
      return;
    }
    const next: Record<Algo, string> = { ...results };
    for (const algo of algorithms) {
      try {
        next[algo] = await digest(algo, value);
      } catch (e) {
        next[algo] = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    results = next;
  }

  async function copy(algo: Algo) {
    const value = results[algo];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      copied = algo;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = null), 1200);
    } catch {
      /* swallow */
    }
  }
</script>

<div class="space-y-4">
  <label class="block">
    <span class="hf-label">Input</span>
    <textarea
      bind:value={input}
      class="hf-input mt-2 min-h-[96px] font-mono text-sm leading-relaxed"
      placeholder="Type or paste data — every algorithm hashes live."
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
    ></textarea>
  </label>

  <div class="space-y-2">
    {#each algorithms as algo}
      <div
        class="flex flex-col gap-2 rounded-[14px] border border-border/70 bg-background/60 px-3 py-2 shadow-inner-line sm:flex-row sm:items-center"
      >
        <span class="w-20 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {algo}
        </span>
        <code class="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
          {results[algo] || '—'}
        </code>
        <button
          type="button"
          class="hf-icon-button shrink-0"
          aria-label="Copy {algo} hash"
          on:click={() => copy(algo)}
          disabled={!results[algo]}
        >
          {#if copied === algo}
            <Check size={14} aria-hidden="true" />
          {:else}
            <Copy size={14} aria-hidden="true" />
          {/if}
        </button>
      </div>
    {/each}
  </div>
</div>
