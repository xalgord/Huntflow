<script lang="ts">
  import { recordPayloadUse } from '$lib/stores';
  import { payloadCategoryLabel } from '$lib/seeds/payloads';
  import type { Payload } from '$lib/types';
  import { Check, Copy, Pencil, Star, Trash2 } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let payload: Payload;
  export let editable = true;

  const dispatch = createEventDispatcher<{
    favorite: { id: string; favorite: boolean };
    edit: { payload: Payload };
    delete: { id: string };
  }>();

  let copied = false;
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload.payload);
      copied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => (copied = false), 1500);
      void recordPayloadUse(payload.id);
    } catch (error) {
      console.error('Copy failed', error);
    }
  }

  function toggleFav() {
    dispatch('favorite', { id: payload.id, favorite: !payload.isFavorite });
  }
</script>

<article class="hf-card flex flex-col gap-3 p-4">
  <header class="flex items-start justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          {payloadCategoryLabel(payload.category)}
        </span>
        {#if !payload.isBuiltIn}
          <span class="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Custom
          </span>
        {/if}
        {#if payload.useCount > 0}
          <span class="text-[11px] text-muted-foreground">Used {payload.useCount}x</span>
        {/if}
      </div>
      <h3 class="mt-1 truncate text-sm font-semibold text-foreground">{payload.name}</h3>
    </div>
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-primary {payload.isFavorite ? 'border-primary/40 text-primary' : ''}"
      aria-label={payload.isFavorite ? 'Remove favorite' : 'Mark as favorite'}
      aria-pressed={payload.isFavorite}
      on:click={toggleFav}
    >
      <Star size={16} fill={payload.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  </header>

  <pre class="whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-slate-950/60 p-3 font-mono text-[12.5px] text-slate-200">{payload.payload}</pre>

  {#if payload.description}
    <p class="text-sm leading-relaxed text-muted-foreground">{payload.description}</p>
  {/if}

  {#if payload.tags.length > 0}
    <div class="flex flex-wrap gap-1.5">
      {#each payload.tags as tag}
        <span class="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">#{tag}</span>
      {/each}
    </div>
  {/if}

  <footer class="flex items-center gap-2">
    <button
      type="button"
      class="hf-button-primary inline-flex flex-1 items-center justify-center gap-2"
      on:click={copy}
    >
      {#if copied}
        <Check size={16} aria-hidden="true" />
        Copied
      {:else}
        <Copy size={16} aria-hidden="true" />
        Copy payload
      {/if}
    </button>
    {#if editable && !payload.isBuiltIn}
      <button
        type="button"
        class="inline-flex h-10 min-h-[40px] w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        aria-label="Edit payload"
        on:click={() => dispatch('edit', { payload })}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="inline-flex h-10 min-h-[40px] w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
        aria-label="Delete payload"
        on:click={() => dispatch('delete', { id: payload.id })}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    {/if}
  </footer>
</article>
