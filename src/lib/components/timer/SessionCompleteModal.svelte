<script lang="ts">
  import type { SessionTag } from '$lib/types';
  import { CheckCircle2, X } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let targetName = '';

  const dispatch = createEventDispatcher<{
    save: { quickNote?: string; tags: SessionTag[] };
    dismiss: void;
  }>();

  const availableTags: SessionTag[] = ['critical', 'high', 'medium', 'low', 'needs-report', 'duplicate'];
  let quickNote = '';
  let tags: SessionTag[] = [];

  function toggleTag(tag: SessionTag) {
    tags = tags.includes(tag) ? tags.filter((candidate) => candidate !== tag) : [...tags, tag].slice(0, 5);
  }

  function save() {
    dispatch('save', {
      quickNote: quickNote.trim() || undefined,
      tags
    });
    quickNote = '';
    tags = [];
  }

  function dismiss() {
    dispatch('dismiss');
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/80 p-4 backdrop-blur-sm sm:items-center">
    <section
      class="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-800 p-6 text-zinc-100 shadow-xl animate-scale-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-complete-title"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/20 text-primary-400">
            <CheckCircle2 size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="session-complete-title" class="text-lg font-semibold text-zinc-100">
              Session complete
            </h2>
            {#if targetName}
              <p class="mt-1 text-sm text-zinc-400">{targetName}</p>
            {/if}
          </div>
        </div>

        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
          aria-label="Close modal"
          on:click={dismiss}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <label class="mt-5 block">
        <span class="hf-label">Quick note</span>
        <textarea
          bind:value={quickNote}
          class="mt-2 min-h-[100px] w-full resize-y rounded-md border border-zinc-600 bg-zinc-850 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
          placeholder="What did you find?"
        />
      </label>

      <div class="mt-4">
        <p class="hf-label">Tags</p>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each availableTags as tag}
            <button
              type="button"
              class="rounded-full border px-2 py-1 text-xs font-medium transition {tags.includes(tag)
                ? 'border-primary-500/30 bg-primary-500/20 text-primary-400'
                : 'border-zinc-600 bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}"
              on:click={() => toggleTag(tag)}
            >
              #{tag}
            </button>
          {/each}
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="min-h-[44px] rounded-md border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-600"
          on:click={dismiss}
        >
          Cancel
        </button>
        <button
          type="button"
          class="min-h-[44px] rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
          on:click={save}
        >
          Save Session
        </button>
      </div>
    </section>
  </div>
{/if}
