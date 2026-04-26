<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let tags: string[] = [];
  export let suggestions: string[] = [];

  const dispatch = createEventDispatcher<{ change: string[] }>();

  let value = '';

  $: normalizedSuggestions = suggestions
    .filter((tag) => !tags.includes(tag))
    .filter((tag) => !value || tag.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 6);

  function normalizeTag(tag: string): string {
    return tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 30);
  }

  function addTags(input: string): void {
    const next = input
      .split(',')
      .map(normalizeTag)
      .filter(Boolean);
    tags = Array.from(new Set([...tags, ...next])).slice(0, 10);
    value = '';
    dispatch('change', tags);
  }

  function removeTag(tag: string): void {
    tags = tags.filter((candidate) => candidate !== tag);
    dispatch('change', tags);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      addTags(value);
    }

    if (event.key === 'Backspace' && !value && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  }
</script>

<div class="space-y-2">
  <label class="hf-label" for="note-tags">Tags</label>
  <div class="rounded-md border border-slate-600 bg-slate-850 p-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/50">
    <div class="flex flex-wrap gap-2">
      {#each tags as tag}
        <button
          type="button"
          class="min-h-0 rounded-full border border-primary-500/30 bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-300"
          aria-label={`Remove ${tag}`}
          on:click={() => removeTag(tag)}
        >
          #{tag}
        </button>
      {/each}
      <input
        id="note-tags"
        bind:value
        class="min-h-[32px] flex-1 bg-transparent px-1 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        placeholder={tags.length >= 10 ? 'Tag limit reached' : 'Add tags, comma-separated'}
        disabled={tags.length >= 10}
        on:keydown={handleKeydown}
        on:blur={() => addTags(value)}
      />
    </div>
  </div>

  {#if normalizedSuggestions.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each normalizedSuggestions as suggestion}
        <button
          type="button"
          class="min-h-0 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400 transition hover:border-primary-500/40 hover:text-primary-300"
          on:click={() => addTags(suggestion)}
        >
          #{suggestion}
        </button>
      {/each}
    </div>
  {/if}
</div>
