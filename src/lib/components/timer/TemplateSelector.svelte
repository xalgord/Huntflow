<script lang="ts">
  import { templateDB } from '$lib/db/templates';
  import type { NoteTemplate } from '$lib/types';
  import { onMount } from 'svelte';

  export let selectedTemplateId = '';
  export let disabled = false;

  let templates: NoteTemplate[] = [];

  onMount(async () => {
    templates = await templateDB.getAll();
  });
</script>

<label class="block">
  <span class="hf-label">Template</span>
  <select
    bind:value={selectedTemplateId}
    {disabled}
    class="hf-select mt-2"
  >
    <option value="">No template</option>
    {#each templates as template}
      <option value={template.id}>{template.name}</option>
    {/each}
  </select>
</label>
