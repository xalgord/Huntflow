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

  // Probe-log templates have IDs prefixed with `probe-`. Group them
  // separately so live-hunting templates are clearly distinguished from
  // write-up scaffolds in the dropdown — that way a hunter mid-session
  // doesn't have to scroll past 8 report skeletons to find the IDOR
  // sweep checklist.
  $: probeTemplates = templates.filter((template) => template.id.startsWith('probe-'));
  $: reportTemplates = templates.filter((template) => !template.id.startsWith('probe-'));
</script>

<label class="block">
  <span class="hf-label">Template</span>
  <select
    bind:value={selectedTemplateId}
    class="hf-select mt-2"
    on:change={handleChange}
  >
    <option value="">Blank note</option>
    {#if probeTemplates.length > 0}
      <optgroup label="Probe logs (live hunting)">
        {#each probeTemplates as template}
          <option value={template.id}>{template.name.replace(/^Probe\s*[—-]\s*/i, '')}</option>
        {/each}
      </optgroup>
    {/if}
    {#if reportTemplates.length > 0}
      <optgroup label="Reports (write-up)">
        {#each reportTemplates as template}
          <option value={template.id}>{template.name}</option>
        {/each}
      </optgroup>
    {/if}
  </select>
</label>
