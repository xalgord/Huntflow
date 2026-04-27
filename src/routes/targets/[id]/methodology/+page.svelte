<script lang="ts">
  import { page } from '$app/stores';
  import ChecklistInstanceView from '$lib/components/checklists/ChecklistInstanceView.svelte';
  import { CHECKLIST_KIND_LABELS } from '$lib/seeds/checklists';
  import {
    checklistInstanceStore,
    checklistTemplateStore,
    targetStore
  } from '$lib/stores';
  import type { ChecklistInstance, ChecklistTemplate } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import { ArrowLeft, ListChecks, Plus } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let loaded = false;
  let showAdd = false;
  let selectedTemplateId = '';

  onMount(async () => {
    await Promise.all([
      targetStore.load(),
      checklistTemplateStore.load(),
      checklistInstanceStore.load()
    ]);
    loaded = true;
    if (!selectedTemplateId && $checklistTemplateStore.length > 0) {
      selectedTemplateId = $checklistTemplateStore[0].id;
    }
  });

  $: targetId = $page.params.id;
  $: target = $targetStore.find((t) => t.id === targetId);
  $: instances = $checklistInstanceStore
    .filter((i) => i.targetId === targetId)
    .sort((a, b) => a.templateName.localeCompare(b.templateName));
  $: templateById = new Map<string, ChecklistTemplate>(
    $checklistTemplateStore.map((t) => [t.id, t])
  );
  $: usedTemplateIds = new Set(instances.map((i) => i.templateId));
  $: availableTemplates = $checklistTemplateStore.filter((t) => !usedTemplateIds.has(t.id));

  $: aggregateStats = (() => {
    let total = 0;
    let done = 0;
    let found = 0;
    for (const instance of instances) {
      const template = templateById.get(instance.templateId);
      if (!template) continue;
      for (const section of template.sections) {
        for (const item of section.items) {
          total += 1;
          const state = instance.itemStates[item.id]?.status;
          if (state === 'done' || state === 'na') done += 1;
          if (state === 'found') {
            done += 1;
            found += 1;
          }
        }
      }
    }
    return {
      total,
      done,
      found,
      percent: total ? Math.round((done / total) * 100) : 0
    };
  })();

  async function startChecklist() {
    const template = templateById.get(selectedTemplateId);
    if (!template) return;
    const now = Date.now();
    const instance: ChecklistInstance = {
      id: generateId(),
      targetId,
      templateId: template.id,
      templateName: template.name,
      templateKind: template.kind,
      itemStates: {},
      startedAt: now,
      createdAt: now,
      updatedAt: now
    };
    await checklistInstanceStore.put(instance);
    await checklistInstanceStore.persistNow();
    showAdd = false;
    if (availableTemplates.length > 1) {
      const next = availableTemplates.find((t) => t.id !== template.id);
      selectedTemplateId = next?.id ?? '';
    }
  }

  async function updateInstance(event: CustomEvent<{ instance: ChecklistInstance }>) {
    await checklistInstanceStore.put(event.detail.instance);
  }

  async function deleteInstance(event: CustomEvent<{ id: string }>) {
    if (!confirm('Delete this checklist? Progress will be lost.')) return;
    await checklistInstanceStore.delete(event.detail.id);
  }
</script>

<svelte:head>
  <title>Methodology: {target?.name ?? 'Target'} | HuntFlow</title>
  <meta
    name="description"
    content="OWASP-aligned methodology checklists with per-target progress tracking."
  />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-5xl">
    <a
      href={`/targets/${targetId}`}
      class="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      Back to target
    </a>

    {#if target}
      <header class="hf-page-header">
        <div>
          <p class="hf-eyebrow">Methodology · {target.name}</p>
          <h1 class="hf-title">Coverage Checklists</h1>
          <p class="hf-description">
            OWASP-aligned playbooks for web, API, mobile, cloud, and recon. Track every check so
            criticals don&apos;t slip past.
          </p>
        </div>
        {#if availableTemplates.length > 0}
          <button
            type="button"
            class="hf-button-primary"
            on:click={() => (showAdd = !showAdd)}
          >
            <Plus size={18} aria-hidden="true" />
            Start Checklist
          </button>
        {/if}
      </header>

      {#if instances.length > 0}
        <section class="grid gap-3 sm:grid-cols-4">
          <div class="hf-stat-tile">
            <p class="hf-label">Active Checklists</p>
            <p class="mt-1 text-2xl font-semibold text-foreground op-mono">{instances.length}</p>
          </div>
          <div class="hf-stat-tile">
            <p class="hf-label">Items Total</p>
            <p class="mt-1 text-2xl font-semibold text-foreground op-mono">{aggregateStats.total}</p>
          </div>
          <div class="hf-stat-tile">
            <p class="hf-label">Coverage</p>
            <p class="mt-1 text-2xl font-semibold text-foreground op-mono">{aggregateStats.percent}%</p>
          </div>
          <div class="hf-stat-tile">
            <p class="hf-label">Vulns Found</p>
            <p class="mt-1 text-2xl font-semibold text-destructive op-mono">{aggregateStats.found}</p>
          </div>
        </section>
      {/if}

      {#if showAdd}
        <section class="hf-card p-4">
          <h2 class="text-lg font-semibold text-foreground">Add Methodology</h2>
          <p class="mb-3 mt-1 text-sm text-muted-foreground">
            Start tracking coverage against a built-in playbook.
          </p>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select bind:value={selectedTemplateId} class="hf-select">
              {#each availableTemplates as template}
                <option value={template.id}>
                  {template.name} ({CHECKLIST_KIND_LABELS[template.kind]})
                </option>
              {/each}
            </select>
            <button type="button" class="hf-button-primary" on:click={startChecklist}>
              <Plus size={18} aria-hidden="true" />
              Start
            </button>
          </div>
        </section>
      {/if}

      {#if instances.length > 0}
        <section class="space-y-4">
          {#each instances as instance (instance.id)}
            <ChecklistInstanceView
              {instance}
              template={templateById.get(instance.templateId)}
              on:update={updateInstance}
              on:delete={deleteInstance}
            />
          {/each}
        </section>
      {:else}
        <section class="hf-card p-8 text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
            <ListChecks size={24} aria-hidden="true" />
          </div>
          <h2 class="mt-4 text-lg font-semibold text-foreground">No methodology in progress</h2>
          <p class="mt-2 text-sm text-muted-foreground">
            Start a checklist to track which OWASP categories have been covered for this target.
          </p>
          {#if availableTemplates.length > 0 && !showAdd}
            <button
              type="button"
              class="mt-5 hf-button-primary"
              on:click={() => (showAdd = true)}
            >
              <Plus size={18} aria-hidden="true" />
              Start First Checklist
            </button>
          {/if}
        </section>
      {/if}
    {:else if loaded}
      <section class="hf-card p-8 text-center">
        <h1 class="text-lg font-semibold text-foreground">Target not found</h1>
        <a href="/targets" class="mt-4 inline-flex hf-button-primary">Back to targets</a>
      </section>
    {/if}
  </div>
</main>
