<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import {
    FINDING_TEMPLATE_CATEGORIES,
    FINDING_TEMPLATES,
    searchFindingTemplates,
    type FindingTemplate
  } from '$lib/data/findingTemplates';
  import { Search } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let initialQuery = '';

  const dispatch = createEventDispatcher<{ pick: FindingTemplate; close: void }>();

  let query = '';
  let category: string = 'All';
  let wasOpen = false;

  // Start every opening from the finding's current type, not stale input.
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) {
      query = initialQuery;
      category = 'All';
    }
  }
  $: results = (query.trim() ? searchFindingTemplates(query) : FINDING_TEMPLATES).filter(
    (template) => category === 'All' || template.category === category
  );
</script>

<Modal
  {open}
  title="Finding Templates"
  description="Start from a vetted write-up. Classification, CVSS and every section are filled in; your own text is never overwritten."
  on:close={() => dispatch('close')}
>
  <label class="relative block">
    <span class="sr-only">Search templates</span>
    <Search size={14} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
    <!-- svelte-ignore a11y-autofocus -->
    <input bind:value={query} autofocus class="hf-input pl-8" placeholder="IDOR, SSRF, CWE-79, password reset…" />
  </label>

  <div class="mt-3 flex gap-1.5 overflow-x-auto pb-1">
    {#each ['All', ...FINDING_TEMPLATE_CATEGORIES] as item}
      <button
        type="button"
        class="hf-chip shrink-0 {category === item ? 'hf-chip-active' : ''}"
        aria-pressed={category === item}
        on:click={() => (category = item)}>{item}</button
      >
    {/each}
  </div>

  <ul class="hf-list mt-2 max-h-[50vh] overflow-y-auto rounded-[10px]" style="background: var(--hf-fill)">
    {#each results as template (template.id)}
      <li>
        <button type="button" class="hf-list-row w-full text-left" on:click={() => dispatch('pick', template)}>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[0.8125rem] font-medium text-zinc-100">{template.name}</span>
            <span class="block truncate text-xs text-zinc-500">
              {template.cweId ?? 'No CWE'} · {template.category}{template.vrt ? ` · ${template.vrt.split(' > ').slice(-1)[0]}` : ''}
            </span>
          </span>
          <SeverityBadge severity={template.severity} />
        </button>
      </li>
    {:else}
      <li class="px-4 py-6 text-center text-[0.8125rem] text-zinc-500">No templates match “{query}”.</li>
    {/each}
  </ul>
</Modal>
