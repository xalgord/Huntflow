<script lang="ts">
  import type {
    ChecklistInstance,
    ChecklistInstanceItemState,
    ChecklistItemStatus,
    ChecklistTemplate
  } from '$lib/types';
  import { totalChecklistItems } from '$lib/seeds/checklists';
  import { Check, ChevronDown, Circle, FileText, MinusCircle, Trash2, Triangle } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let instance: ChecklistInstance;
  export let template: ChecklistTemplate | undefined;

  const dispatch = createEventDispatcher<{
    update: { instance: ChecklistInstance };
    delete: { id: string };
  }>();

  const statusOptions: { value: ChecklistItemStatus; label: string; color: string }[] = [
    { value: 'todo', label: 'Todo', color: 'text-muted-foreground' },
    { value: 'in-progress', label: 'In progress', color: 'text-amber-400' },
    { value: 'done', label: 'Done', color: 'text-emerald-400' },
    { value: 'na', label: 'N/A', color: 'text-muted-foreground' },
    { value: 'found', label: 'Found vuln!', color: 'text-destructive' }
  ];

  let expandedSection: string | null = null;

  function statusIcon(status: ChecklistItemStatus) {
    if (status === 'done') return Check;
    if (status === 'in-progress') return Triangle;
    if (status === 'na') return MinusCircle;
    if (status === 'found') return Triangle;
    return Circle;
  }

  function statusColor(status: ChecklistItemStatus): string {
    if (status === 'done') return 'text-emerald-400';
    if (status === 'in-progress') return 'text-amber-400';
    if (status === 'found') return 'text-destructive';
    return 'text-muted-foreground';
  }

  $: stateMap = new Map(Object.entries(instance.itemStates));
  $: progress = (() => {
    const total = template ? totalChecklistItems(template) : 0;
    if (total === 0) return { done: 0, total: 0, found: 0, percent: 0 };
    let done = 0;
    let found = 0;
    for (const [, state] of stateMap) {
      if (state.status === 'done' || state.status === 'na') done += 1;
      if (state.status === 'found') {
        done += 1;
        found += 1;
      }
    }
    return { done, total, found, percent: Math.round((done / total) * 100) };
  })();

  function toggleSection(id: string) {
    expandedSection = expandedSection === id ? null : id;
  }

  // Extracted from an inline `on:blur` handler — Svelte's template parser
  // rejects TS-only syntax like `as HTMLTextAreaElement` inside `{...}`
  // expressions, so the cast must live in a script-block helper.
  function handleNotesBlur(itemId: string, status: ChecklistItemStatus, event: Event) {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) return;
    updateItem(itemId, status, target.value);
  }

  function updateItem(itemId: string, status: ChecklistItemStatus, notes?: string) {
    const next: Record<string, ChecklistInstanceItemState> = { ...instance.itemStates };
    const existing = next[itemId];
    next[itemId] = {
      status,
      notes: notes ?? existing?.notes,
      updatedAt: Date.now()
    };

    const updatedInstance: ChecklistInstance = {
      ...instance,
      itemStates: next,
      updatedAt: Date.now()
    };

    if (template) {
      const total = totalChecklistItems(template);
      const completed = Object.values(next).filter(
        (s) => s.status === 'done' || s.status === 'na' || s.status === 'found'
      ).length;
      if (completed >= total && !instance.completedAt) {
        updatedInstance.completedAt = Date.now();
      }
      if (completed < total) {
        updatedInstance.completedAt = undefined;
      }
    }

    dispatch('update', { instance: updatedInstance });
  }
</script>

<article class="hf-card p-4">
  <header class="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <p class="hf-eyebrow">{instance.templateKind}</p>
      <h3 class="mt-1 text-lg font-semibold text-foreground">{instance.templateName}</h3>
      <p class="mt-1 text-xs text-muted-foreground">
        {progress.done}/{progress.total} items · {progress.percent}% complete
        {#if progress.found > 0}
          · <span class="font-semibold text-destructive">{progress.found} vulns found</span>
        {/if}
      </p>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          class="h-full bg-primary transition-[width]"
          style="width: {progress.percent}%"
        ></div>
      </div>
    </div>
    <button
      type="button"
      class="inline-flex h-9 min-h-[36px] w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete checklist instance"
      on:click={() => dispatch('delete', { id: instance.id })}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  </header>

  {#if template}
    <div class="mt-3 space-y-2">
      {#each template.sections as section}
        {@const sectionItems = section.items}
        {@const sectionDone = sectionItems.filter((i) => {
          const s = stateMap.get(i.id)?.status;
          return s === 'done' || s === 'na' || s === 'found';
        }).length}
        {@const isOpen = expandedSection === section.id}
        <div class="rounded-lg border border-border/60 bg-background/40">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-foreground"
            aria-expanded={isOpen}
            on:click={() => toggleSection(section.id)}
          >
            <span class="flex items-center gap-2">
              <ChevronDown
                size={16}
                class="transition-transform {isOpen ? '' : '-rotate-90'}"
                aria-hidden="true"
              />
              {section.title}
            </span>
            <span class="text-xs text-muted-foreground op-mono">
              {sectionDone}/{sectionItems.length}
            </span>
          </button>

          {#if isOpen}
            <ul class="divide-y divide-border/60 border-t border-border/60">
              {#each sectionItems as item}
                {@const state = stateMap.get(item.id)}
                {@const status = state?.status ?? 'todo'}
                <li class="px-3 py-3">
                  <div class="flex items-start gap-3">
                    <svelte:component
                      this={statusIcon(status)}
                      size={18}
                      class="mt-0.5 shrink-0 {statusColor(status)}"
                      aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-foreground">{item.title}</p>
                      {#if item.description}
                        <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                      {/if}
                      {#if item.references && item.references.length > 0}
                        <div class="mt-2 flex flex-wrap gap-2">
                          {#each item.references as ref}
                            <a
                              href={ref}
                              target="_blank"
                              rel="noreferrer"
                              class="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                            >
                              <FileText size={10} aria-hidden="true" />
                              {(() => {
                                try { return new URL(ref).hostname; } catch { return ref; }
                              })()}
                            </a>
                          {/each}
                        </div>
                      {/if}
                      <div class="mt-2 flex flex-wrap gap-1">
                        {#each statusOptions as option}
                          <button
                            type="button"
                            class="rounded-md border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] transition {status === option.value ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
                            aria-pressed={status === option.value}
                            on:click={() => updateItem(item.id, option.value)}
                          >
                            {option.label}
                          </button>
                        {/each}
                      </div>
                      {#if status === 'found' || status === 'in-progress'}
                        <textarea
                          rows="2"
                          class="hf-input mt-2 text-xs"
                          placeholder="Notes (e.g. payload, endpoint, evidence link)"
                          value={state?.notes ?? ''}
                          on:blur={(e) => handleNotesBlur(item.id, status, e)}
                        ></textarea>
                      {/if}
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-sm text-muted-foreground">
      The original checklist template is missing. The instance still has saved progress.
    </p>
  {/if}
</article>
