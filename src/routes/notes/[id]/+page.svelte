<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import NoteEditor from '$lib/components/notes/NoteEditor.svelte';
  import { evidenceAssetStore, noteStore, sessionStore, targetStore } from '$lib/stores';
  import type { Note } from '$lib/types';
  import { ArrowLeft, Network, Trash2 } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  let loaded = false;
  let draftSavedAt: number | null = null;
  let workingNote: Note | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDraftSignature = '';

  $: noteId = $page.params.id;
  $: isNew = noteId === 'new';
  $: existingNote = isNew ? undefined : $noteStore.find((note) => note.id === noteId);
  $: tagSuggestions = Array.from(new Set($noteStore.flatMap((note) => note.tags))).sort();
  $: title = workingNote?.title?.trim() || (isNew ? 'New Note' : 'Note');
  $: noteAssets = workingNote
    ? $evidenceAssetStore.filter((asset) => asset.noteId === workingNote?.id).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  function draftKey(id: string): string {
    return `huntflow-note-draft:${id}`;
  }

  function createBlankNote(): Note {
    const now = Date.now();
    const requestedTarget = $page.url.searchParams.get('target');
    const requestedSession = $page.url.searchParams.get('session');
    return {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      targetId: requestedTarget ?? $targetStore.find((target) => target.status !== 'archived')?.id ?? '',
      sessionId: requestedSession ?? undefined,
      tags: [],
      createdAt: now,
      updatedAt: now
    };
  }

  function loadDraft(note: Note): Note {
    if (!browser) return note;
    const raw = localStorage.getItem(draftKey(note.id));
    if (!raw) return note;

    try {
      const parsed = JSON.parse(raw) as { note?: Note; savedAt?: number };
      if (!parsed.note) return note;
      draftSavedAt = parsed.savedAt ?? null;
      return { ...note, ...parsed.note, id: note.id, createdAt: note.createdAt };
    } catch {
      return note;
    }
  }

  function scheduleDraftSave(note: Note): void {
    if (!browser) return;
    const signature = JSON.stringify(note);
    if (signature === lastDraftSignature) return;
    lastDraftSignature = signature;

    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const savedAt = Date.now();
      try {
        localStorage.setItem(draftKey(note.id), JSON.stringify({ note, savedAt }));
        draftSavedAt = savedAt;
      } catch (error) {
        // Most commonly QuotaExceededError when the note (or other tabs)
        // overflow the ~5MB origin budget. We swallow it so the editor
        // stays usable; the explicit `Save` button still writes to
        // IndexedDB which has gigabytes of headroom.
        console.warn('note draft autosave skipped:', error);
      }
    }, 3000);
  }

  async function saveNote(event: CustomEvent<Note>): Promise<void> {
    const now = Date.now();
    const next = {
      ...event.detail,
      updatedAt: now,
      createdAt: event.detail.createdAt || now
    };
    await noteStore.put(next);
    await noteStore.persistNow();
    if (browser) localStorage.removeItem(draftKey(next.id));
    draftSavedAt = null;
    workingNote = next;
    if (isNew) await goto(`/notes/${next.id}`);
  }

  async function deleteNote(): Promise<void> {
    if (!workingNote) return;
    if (!confirm('Delete this note?')) return;
    await noteStore.delete(workingNote.id);
    await noteStore.persistNow();
    if (browser) localStorage.removeItem(draftKey(workingNote.id));
    await goto('/notes');
  }

  function handleDraftChange(event: CustomEvent<Note>): void {
    scheduleDraftSave(event.detail);
  }

  onMount(async () => {
    await Promise.all([noteStore.load(), targetStore.load(), sessionStore.load(), evidenceAssetStore.load()]);
    const baseNote = isNew ? createBlankNote() : existingNote;
    if (baseNote) {
      workingNote = loadDraft({ ...baseNote, tags: [...baseNote.tags] });
      lastDraftSignature = JSON.stringify(workingNote);
    }
    loaded = true;
  });

  onDestroy(() => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
  });
</script>

<svelte:head>
  <title>{title} | HuntFlow</title>
  <meta name="description" content="Write markdown notes linked to a target and optional hunting session." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-6xl">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <a
        href="/notes"
        class="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-md px-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Back to notes
      </a>

      {#if workingNote && !isNew}
        <button
          type="button"
          class="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
          on:click={deleteNote}
        >
          <Trash2 size={18} aria-hidden="true" />
          Delete
        </button>
      {/if}
    </div>

    {#if workingNote}
      <NoteEditor
        bind:note={workingNote}
        targets={$targetStore}
        sessions={$sessionStore}
        {tagSuggestions}
        {draftSavedAt}
        on:change={handleDraftChange}
        on:save={saveNote}
      />

      {#if !isNew}
        <section class="hf-card p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-zinc-100">Attached Evidence</h2>
              <p class="mt-1 text-sm text-zinc-400">Proof files, URLs, and request traces linked to this note.</p>
            </div>
            <a href={`/assets?target=${workingNote.targetId}&note=${workingNote.id}`} class="hf-button-secondary">
              <Network size={18} aria-hidden="true" />
              Attach evidence
            </a>
          </div>

          {#if noteAssets.length > 0}
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              {#each noteAssets.slice(0, 4) as asset (asset.id)}
                <a href={`/assets?target=${workingNote.targetId}&note=${workingNote.id}`} class="rounded-[14px] border border-border/70 bg-background/40 p-3 transition hover:border-primary/40 hover:bg-muted/40">
                  <p class="truncate text-sm font-semibold text-foreground">{asset.title}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{asset.kind} · {asset.syncState}</p>
                </a>
              {/each}
            </div>
          {:else}
            <div class="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 p-6 text-center">
              <p class="text-sm font-medium text-zinc-300">No evidence attached</p>
              <p class="mt-1 text-sm text-zinc-500">Attach proof from the Evidence workspace.</p>
            </div>
          {/if}
        </section>
      {/if}
    {:else if loaded}
      <section class="hf-card p-8 text-center">
        <h1 class="text-lg font-semibold text-zinc-300">Note not found</h1>
        <p class="mt-2 text-sm text-zinc-500">The note may have been deleted elsewhere.</p>
        <a
          href="/notes"
          class="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
        >
          Back to notes
        </a>
      </section>
    {/if}
  </div>
</main>
