<script lang="ts">
  import { Clipboard, Check } from 'lucide-svelte';
  import { onDestroy } from 'svelte';

  export let value: string;
  export let label = 'Copy';
  export let compact = false;

  let copied = false;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  async function copy(): Promise<void> {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    copied = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
    }, 1800);
  }

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });
</script>

<button
  type="button"
  class="{compact ? 'hf-icon-button' : 'hf-button-secondary'}"
  aria-label={label}
  title={label}
  disabled={!value}
  on:click={copy}
>
  {#if copied}
    <Check size={compact ? 15 : 16} aria-hidden="true" />
    {#if !compact}<span>Copied</span>{/if}
  {:else}
    <Clipboard size={compact ? 15 : 16} aria-hidden="true" />
    {#if !compact}<span>{label}</span>{/if}
  {/if}
</button>
