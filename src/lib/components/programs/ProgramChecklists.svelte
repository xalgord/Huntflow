<script lang="ts">
  import ChecklistInstanceView from '$lib/components/checklists/ChecklistInstanceView.svelte';
  import { CHECKLIST_KIND_LABELS } from '$lib/seeds/checklists';
  import { checklistInstanceStore, checklistTemplateStore } from '$lib/stores';
  import type { ChecklistInstance, ChecklistTemplate } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import { ListChecks, Plus } from 'lucide-svelte';
  import { onMount } from 'svelte';

  export let programId: string;

  let selectedTemplateId = '';
  let showAdd = false;

  onMount(() => {
    void Promise.all([checklistTemplateStore.load(), checklistInstanceStore.load()]);
  });

  $: instances = $checklistInstanceStore
    .filter((instance) => instance.targetId === programId)
    .sort((a, b) => a.templateName.localeCompare(b.templateName));
  $: templateById = new Map<string, ChecklistTemplate>($checklistTemplateStore.map((template) => [template.id, template]));
  $: usedTemplateIds = new Set(instances.map((instance) => instance.templateId));
  $: availableTemplates = $checklistTemplateStore.filter((template) => !usedTemplateIds.has(template.id));
  $: if (!availableTemplates.some((template) => template.id === selectedTemplateId)) selectedTemplateId = availableTemplates[0]?.id ?? '';

  $: stats = summarise(instances, templateById);
  function summarise(list: ChecklistInstance[], templates: Map<string, ChecklistTemplate>) {
    let total = 0;
    let done = 0;
    let found = 0;
    for (const instance of list) {
      const template = templates.get(instance.templateId);
      if (!template) continue;
      for (const section of template.sections) {
        for (const item of section.items) {
          total += 1;
          const status = instance.itemStates[item.id]?.status;
          if (status === 'done' || status === 'na' || status === 'found') done += 1;
          if (status === 'found') found += 1;
        }
      }
    }
    return { total, done, found, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  async function start(): Promise<void> {
    const template = templateById.get(selectedTemplateId);
    if (!template) return;
    const now = Date.now();
    await checklistInstanceStore.put({
      id: generateId(),
      targetId: programId,
      templateId: template.id,
      templateName: template.name,
      templateKind: template.kind,
      itemStates: {},
      startedAt: now,
      createdAt: now,
      updatedAt: now
    });
    await checklistInstanceStore.persistNow();
    showAdd = false;
  }

  async function update(event: CustomEvent<{ instance: ChecklistInstance }>): Promise<void> {
    await checklistInstanceStore.put(event.detail.instance);
    await checklistInstanceStore.persistNow();
  }

  async function remove(event: CustomEvent<{ id: string }>): Promise<void> {
    if (!confirm('Delete this checklist? Its progress will be lost.')) return;
    await checklistInstanceStore.delete(event.detail.id);
    await checklistInstanceStore.persistNow();
  }
</script>

<section class="space-y-4" aria-label="Checklists">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p class="max-w-xl text-[0.8125rem] text-zinc-500">
      OWASP-based playbooks for web, API and mobile. Mark each check as you go so nothing critical slips past.
    </p>
    {#if availableTemplates.length > 0 && instances.length > 0}
      <button type="button" class="hf-button-secondary shrink-0" on:click={() => (showAdd = !showAdd)}>
        <Plus size={16} aria-hidden="true" />
        Add Checklist
      </button>
    {/if}
  </div>

  {#if instances.length > 0}
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each [{ label: 'Checklists', value: String(instances.length) }, { label: 'Checks', value: String(stats.total) }, { label: 'Coverage', value: `${stats.percent}%` }, { label: 'Issues found', value: String(stats.found) }] as tile}
        <div class="hf-card px-4 py-3">
          <dt class="text-xs text-zinc-500">{tile.label}</dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{tile.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  {#if showAdd || (instances.length === 0 && availableTemplates.length > 0)}
    <div class="hf-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      {#if instances.length === 0}
        <ListChecks size={28} strokeWidth={1.6} class="hidden shrink-0 self-center text-zinc-500 sm:block" aria-hidden="true" />
      {/if}
      <label class="block min-w-0 flex-1">
        <span class="hf-label">{instances.length === 0 ? 'Start tracking coverage with a playbook' : 'Playbook'}</span>
        <select bind:value={selectedTemplateId} class="hf-select mt-1.5">
          {#each availableTemplates as template}
            <option value={template.id}>{template.name} · {CHECKLIST_KIND_LABELS[template.kind]}</option>
          {/each}
        </select>
      </label>
      <button type="button" class="hf-button-primary" on:click={start}>Start Checklist</button>
    </div>
  {/if}

  {#each instances as instance (instance.id)}
    <ChecklistInstanceView {instance} template={templateById.get(instance.templateId)} on:update={update} on:delete={remove} />
  {/each}
</section>
