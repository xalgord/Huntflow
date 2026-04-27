<script lang="ts">
  import { PAYLOAD_CATEGORIES } from '$lib/seeds/payloads';
  import type { Payload, PayloadCategory } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import { createEventDispatcher } from 'svelte';

  export let payload: Payload | null = null;
  export let submitLabel = 'Save Payload';

  const dispatch = createEventDispatcher<{
    submit: { payload: Payload };
    cancel: void;
  }>();

  let name = payload?.name ?? '';
  let category: PayloadCategory = payload?.category ?? 'xss';
  let body = payload?.payload ?? '';
  let description = payload?.description ?? '';
  let tagsText = payload?.tags.join(', ') ?? '';
  let source = payload?.source ?? '';

  function handleSubmit() {
    const now = Date.now();
    const next: Payload = {
      id: payload?.id ?? generateId(),
      name: name.trim(),
      category,
      payload: body,
      description: description.trim() || undefined,
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      source: source.trim() || undefined,
      isBuiltIn: false,
      isFavorite: payload?.isFavorite ?? false,
      useCount: payload?.useCount ?? 0,
      lastUsedAt: payload?.lastUsedAt,
      createdAt: payload?.createdAt ?? now,
      updatedAt: now
    };
    dispatch('submit', { payload: next });
  }
</script>

<form
  class="space-y-4"
  on:submit|preventDefault={handleSubmit}
>
  <div class="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <label class="block">
      <span class="hf-label">Name</span>
      <input bind:value={name} required class="hf-input mt-2" placeholder="e.g. SVG onload XSS" />
    </label>
    <label class="block">
      <span class="hf-label">Category</span>
      <select bind:value={category} class="hf-select mt-2">
        {#each PAYLOAD_CATEGORIES as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="block">
    <span class="hf-label">Payload</span>
    <textarea
      bind:value={body}
      required
      rows="5"
      class="hf-input mt-2 font-mono text-[12.5px]"
      placeholder="<svg onload=alert(1)>"
    ></textarea>
  </label>

  <label class="block">
    <span class="hf-label">Description</span>
    <textarea
      bind:value={description}
      rows="2"
      class="hf-input mt-2"
      placeholder="When and why this payload is useful, WAF bypass notes, etc."
    ></textarea>
  </label>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="hf-label">Tags (comma-separated)</span>
      <input bind:value={tagsText} class="hf-input mt-2" placeholder="reflected, waf-bypass" />
    </label>
    <label class="block">
      <span class="hf-label">Source (optional)</span>
      <input bind:value={source} class="hf-input mt-2" placeholder="https://..." />
    </label>
  </div>

  <div class="flex items-center justify-end gap-2">
    <button type="button" class="hf-button-secondary" on:click={() => dispatch('cancel')}>
      Cancel
    </button>
    <button type="submit" class="hf-button-primary">{submitLabel}</button>
  </div>
</form>
