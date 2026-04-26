<script lang="ts">
  import { templateDB } from '$lib/db/templates';
  import type { NoteTemplate } from '$lib/types';
  import { createEventDispatcher, onMount } from 'svelte';

  export let selectedTemplateId = '';

  const dispatch = createEventDispatcher<{ select: NoteTemplate | null }>();
  let templates: NoteTemplate[] = [];

  onMount(async () => {
    templates = await templateDB.getAll();
  });

  function handleChange() {
    dispatch('select', templates.find((template) => template.id === selectedTemplateId) ?? null);
  }
</script>

<label class="block">
  <span class="hf-label">Template</span>
  <select
    bind:value={selectedTemplateId}
    class="hf-select mt-2"
    on:change={handleChange}
  >
    <option value="">Blank note</option>
    {#each templates as template}
      <option value={template.id}>{template.name}</option>
    {/each}
  </select>
</label>
