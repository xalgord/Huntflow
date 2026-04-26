<script lang="ts">
  import type { Note, NoteTemplate, Session, Target } from '$lib/types';
  import { createEventDispatcher, tick } from 'svelte';
  import MarkdownPreview from './MarkdownPreview.svelte';
  import NoteToolbar, { type ToolbarAction } from './NoteToolbar.svelte';
  import TagInput from './TagInput.svelte';
  import TemplateSelector from './TemplateSelector.svelte';

  export let note: Note;
  export let targets: Target[] = [];
  export let sessions: Session[] = [];
  export let tagSuggestions: string[] = [];
  export let draftSavedAt: number | null = null;

  const dispatch = createEventDispatcher<{ save: Note; change: Note }>();

  let textarea: HTMLTextAreaElement;
  let mode: 'write' | 'preview' = 'write';

  $: targetSessions = sessions.filter((session) => session.targetId === note.targetId);
  $: charCount = note.content.length;
  $: canSave = note.title.trim().length > 0 && note.targetId.trim().length > 0;

  function emitChange(): void {
    dispatch('change', { ...note, tags: [...note.tags] });
  }

  function selectTemplate(event: CustomEvent<NoteTemplate | null>): void {
    const template = event.detail;
    note = {
      ...note,
      templateId: template?.id,
      title: note.title.trim() ? note.title : (template?.name ?? ''),
      content: template ? template.content : note.content
    };
    emitChange();
  }

  function wrapSelection(prefix: string, suffix = prefix, placeholder = ''): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = note.content.slice(start, end) || placeholder;
    const replacement = `${prefix}${selected}${suffix}`;
    note = {
      ...note,
      content: `${note.content.slice(0, start)}${replacement}${note.content.slice(end)}`
    };
    emitChange();

    void tick().then(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function prefixLines(prefixer: (index: number) => string): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = note.content.slice(start, end) || 'List item';
    const replacement = selected
      .split('\n')
      .map((line, index) => `${prefixer(index)}${line.replace(/^([-*]|\d+\.)\s+/, '')}`)
      .join('\n');
    note = {
      ...note,
      content: `${note.content.slice(0, start)}${replacement}${note.content.slice(end)}`
    };
    emitChange();
  }

  function handleToolbar(event: CustomEvent<ToolbarAction>): void {
    textarea?.focus();

    if (event.detail === 'bold') wrapSelection('**', '**', 'bold text');
    if (event.detail === 'italic') wrapSelection('*', '*', 'italic text');
    if (event.detail === 'inline-code') wrapSelection('`', '`', 'payload');
    if (event.detail === 'code-block') wrapSelection('```\n', '\n```', 'request or response');
    if (event.detail === 'link') wrapSelection('[', '](https://example.com)', 'link text');
    if (event.detail === 'bullet-list') prefixLines(() => '- ');
    if (event.detail === 'numbered-list') prefixLines((index) => `${index + 1}. `);
  }

  function save(): void {
    if (!canSave) return;
    dispatch('save', {
      ...note,
      title: note.title.trim(),
      content: note.content.slice(0, 50000),
      sessionId: note.sessionId || undefined,
      tags: note.tags.slice(0, 10)
    });
  }

  function setMode(nextMode: string): void {
    mode = nextMode === 'preview' ? 'preview' : 'write';
  }
</script>

<section class="rounded-lg border border-slate-700 bg-slate-800 shadow-dark-sm">
  <div class="grid gap-4 border-b border-slate-700 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
    <label class="block">
      <span class="hf-label">Title</span>
      <input
        bind:value={note.title}
        class="hf-input mt-2"
        maxlength="200"
        placeholder="Note title"
        on:input={emitChange}
      />
    </label>

    <TemplateSelector selectedTemplateId={note.templateId ?? ''} on:select={selectTemplate} />

    <label class="block">
      <span class="hf-label">Target</span>
      <select
        bind:value={note.targetId}
        class="hf-select mt-2"
        on:change={() => {
          note = { ...note, sessionId: undefined };
          emitChange();
        }}
      >
        <option value="">Select target</option>
        {#each targets as target}
          <option value={target.id}>{target.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="flex border-b border-slate-700 bg-slate-850 px-4 pt-3">
    {#each ['write', 'preview'] as tab}
      <button
        type="button"
        class="min-h-[44px] border-b-2 px-4 text-sm font-medium capitalize transition {mode === tab
          ? 'border-primary-500 text-primary-300'
          : 'border-transparent text-slate-400 hover:text-slate-100'}"
        on:click={() => setMode(tab)}
      >
        {tab}
      </button>
    {/each}
  </div>

  {#if mode === 'write'}
    <NoteToolbar on:action={handleToolbar} />
    <textarea
      bind:this={textarea}
      bind:value={note.content}
      class="min-h-[28rem] w-full resize-y rounded-b-lg border-0 bg-slate-850 p-4 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      maxlength="50000"
      placeholder="Write markdown notes, requests, payloads, and remediation details..."
      on:input={emitChange}
    />
  {:else}
    <MarkdownPreview content={note.content} />
  {/if}

  <div class="grid gap-4 border-t border-slate-700 p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
    <TagInput bind:tags={note.tags} suggestions={tagSuggestions} on:change={emitChange} />

    <label class="block">
      <span class="hf-label">Session</span>
      <select
        bind:value={note.sessionId}
        class="hf-select mt-2"
        on:change={emitChange}
      >
        <option value="">No session</option>
        {#each targetSessions as session}
          <option value={session.id}>
            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(session.startedAt))}
          </option>
        {/each}
      </select>
    </label>

    <div class="flex flex-col items-start gap-2 lg:items-end">
      <p class="text-xs text-slate-500">
        {charCount.toLocaleString()} / 50,000
        {#if draftSavedAt}
          | Draft {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(draftSavedAt))}
        {/if}
      </p>
      <button
        type="button"
        class="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 lg:w-auto"
        disabled={!canSave}
        on:click={save}
      >
        Save
      </button>
    </div>
  </div>
</section>
