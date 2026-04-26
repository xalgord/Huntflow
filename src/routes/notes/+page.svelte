<script lang="ts">
  import NoteCard from '$lib/components/notes/NoteCard.svelte';
  import { noteStore, targetStore } from '$lib/stores';
  import { templateDB } from '$lib/db/templates';
  import type { NoteTemplate, Target } from '$lib/types';
  import { FileText, Plus, Search } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let templates: NoteTemplate[] = [];
  let query = '';
  let targetFilter = 'all';
  let templateFilter = 'all';
  let tagFilter = 'all';

  onMount(async () => {
    await Promise.all([noteStore.load(), targetStore.load()]);
    templates = await templateDB.getAll();
  });

  $: targetById = new Map($targetStore.map((target) => [target.id, target]));
  $: templateById = new Map(templates.map((template) => [template.id, template]));
  $: allTags = Array.from(new Set($noteStore.flatMap((note) => note.tags))).sort();
  $: filteredNotes = $noteStore.filter((note) => {
    if (targetFilter !== 'all' && note.targetId !== targetFilter) return false;
    if (templateFilter !== 'all' && (note.templateId ?? '') !== templateFilter) return false;
    if (tagFilter !== 'all' && !note.tags.includes(tagFilter)) return false;

    const search = query.trim().toLowerCase();
    if (!search) return true;

    const target = targetById.get(note.targetId);
    const template = note.templateId ? templateById.get(note.templateId) : undefined;
    return [note.title, note.content, target?.name, template?.name, note.tags.join(' ')]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(search));
  });

  $: createHref = `/notes/new${targetFilter !== 'all' ? `?target=${targetFilter}` : ''}`;

  function targetName(target: Target): string {
    return target.status === 'archived' ? `${target.name} (archived)` : target.name;
  }
</script>

<svelte:head>
  <title>Notes | HuntFlow</title>
  <meta name="description" content="Search and manage markdown notes for targets and sessions." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-6xl">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Quick Notes</p>
        <h1 class="hf-title">Notes</h1>
        <p class="hf-description">
          Capture markdown evidence, payloads, impact, and remediation details by target.
        </p>
      </div>
      <a
        href={createHref}
        class="hf-button-primary"
      >
        <Plus size={20} aria-hidden="true" />
        New Note
      </a>
    </header>

    <section class="hf-card p-4">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <div class="mt-2 flex items-center gap-2 rounded-md border border-slate-600 bg-slate-850 px-3 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/50">
            <Search size={18} class="text-slate-500" aria-hidden="true" />
            <input
              bind:value={query}
              class="min-h-[44px] w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              placeholder="Search notes, content, tags"
            />
          </div>
        </label>

        <label class="block">
          <span class="hf-label">Target</span>
          <select bind:value={targetFilter} class="hf-select mt-2">
            <option value="all">All targets</option>
            {#each $targetStore as target}
              <option value={target.id}>{targetName(target)}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="hf-label">Template</span>
          <select bind:value={templateFilter} class="hf-select mt-2">
            <option value="all">All templates</option>
            <option value="">Blank</option>
            {#each templates as template}
              <option value={template.id}>{template.name}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="hf-label">Tag</span>
          <select bind:value={tagFilter} class="hf-select mt-2">
            <option value="all">All tags</option>
            {#each allTags as tagName}
              <option value={tagName}>#{tagName}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    {#if filteredNotes.length > 0}
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Note list">
        {#each filteredNotes as note (note.id)}
          <NoteCard note={note} target={targetById.get(note.targetId)} template={note.templateId ? templateById.get(note.templateId) : undefined} />
        {/each}
      </section>
    {:else}
      <section class="hf-card p-8 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-slate-600">
          <FileText size={48} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-slate-300">
          {#if $noteStore.length === 0}
            No notes yet
          {:else}
            No notes match the filters
          {/if}
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          {#if $noteStore.length === 0}
            Write your first note to preserve findings while the details are fresh.
          {:else}
            Adjust search, target, template, or tag filters.
          {/if}
        </p>
        <a
          href={createHref}
          class="mt-5 hf-button-primary"
        >
          <Plus size={20} aria-hidden="true" />
          Write your first note
        </a>
      </section>
    {/if}
  </div>
</main>
