<script lang="ts">
  import { goto } from '$app/navigation';
  import type { EvidenceAsset, EvidenceAssetKind, Note, NoteTemplate, PayoutSeverity, Session, Target } from '$lib/types';
  import { createEventDispatcher, tick } from 'svelte';
  import { evidenceAssetStore, putEvidenceBlob } from '$lib/stores';
  import { generateId } from '$lib/utils/id';
  import { severityColorClass } from '$lib/utils/cvss';
  import type { CvssBaseSeverity } from '$lib/types';
  import HunterActionsBar from './HunterActionsBar.svelte';
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
  let pasteHint: string | null = null;
  let pasteHintTimer: ReturnType<typeof setTimeout> | null = null;

  $: targetSessions = sessions.filter((session) => session.targetId === note.targetId);
  $: charCount = note.content.length;
  $: canSave = note.title.trim().length > 0 && note.targetId.trim().length > 0;
  // `severityColorClass` is typed for the CVSS severity vocabulary (none /
  // low / medium / high / critical) while a Note carries a PayoutSeverity
  // (which adds `informational`). Map across cleanly so we don't get a
  // type error and so "informational" gets the same neutral slate
  // styling as "none".
  $: severityClass = note.severity ? severityColorClass(toCvssSeverity(note.severity)) : '';

  function toCvssSeverity(value: PayoutSeverity): CvssBaseSeverity {
    return value === 'informational' ? 'none' : (value as CvssBaseSeverity);
  }

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

  /**
   * Splice markdown at the textarea cursor (from HunterActionsBar tools).
   * If the cursor isn't at the start of a line, prefix a blank line so
   * inserted blocks (HTTP exchange, code, evidence reference) don't
   * accidentally fold into surrounding paragraph text.
   */
  function insertAtCursor(markdown: string): void {
    if (mode !== 'write') {
      mode = 'write';
    }
    const target = textarea;
    if (!target) {
      note = { ...note, content: `${note.content}\n\n${markdown}\n` };
      emitChange();
      return;
    }
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const before = note.content.slice(0, start);
    const after = note.content.slice(end);
    const needsLeadingBreak = before.length > 0 && !before.endsWith('\n\n');
    const needsTrailingBreak = !after.startsWith('\n');
    const block = `${needsLeadingBreak ? (before.endsWith('\n') ? '\n' : '\n\n') : ''}${markdown}${needsTrailingBreak ? '\n' : ''}`;
    note = { ...note, content: `${before}${block}${after}` };
    emitChange();

    void tick().then(() => {
      target.focus();
      const cursor = before.length + block.length;
      target.setSelectionRange(cursor, cursor);
    });
  }

  function handleHunterInsert(event: CustomEvent<{ markdown: string }>): void {
    insertAtCursor(event.detail.markdown);
  }

  function handleHunterSeverity(
    event: CustomEvent<{ severity?: PayoutSeverity; cvssVector?: string; cvssScore?: number }>
  ): void {
    note = {
      ...note,
      severity: event.detail.severity,
      cvssVector: event.detail.cvssVector,
      cvssScore: event.detail.cvssScore
    };
    emitChange();
  }

  /**
   * Paste handler that intercepts clipboard images. Real bug hunters
   * screenshot constantly (Print Screen → into the report). Without
   * this, a paste of a screenshot would dump base64 garbage into the
   * markdown. We instead persist the image as an evidence asset linked
   * to this note + target, and splice an `[[evidence:id]]` reference
   * that MarkdownPreview renders as a thumbnail tile.
   */
  async function handleTextareaPaste(event: ClipboardEvent): Promise<void> {
    const items = event.clipboardData?.items;
    if (!items || items.length === 0) return;
    const imageItem = Array.from(items).find((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    showPasteHint('Saving screenshot to evidence…');
    try {
      const ref = await persistImageAsEvidence(file);
      insertAtCursor(`[[evidence:${ref}]]`);
      showPasteHint('Screenshot saved');
    } catch (error) {
      console.error('[v0] paste-image failed', error);
      showPasteHint('Could not save screenshot');
    }
  }

  async function persistImageAsEvidence(file: File): Promise<string> {
    const id = generateId('evidence');
    const kind: EvidenceAssetKind = file.type === 'application/pdf' ? 'pdf' : 'image';
    const fileName = file.name?.trim() || `screenshot-${id}.png`;
    const title = fileName.replace(/\.[^.]+$/, '');
    const now = Date.now();
    const asset: EvidenceAsset = {
      id,
      title,
      kind,
      source: 'clipboard',
      mimeType: file.type || 'image/png',
      size: file.size,
      fileName,
      tags: ['screenshot', 'paste'],
      targetId: note.targetId || undefined,
      sessionId: note.sessionId,
      noteId: note.id,
      syncState: 'pending-upload',
      capturedAt: now,
      createdAt: now,
      updatedAt: now
    };
    await putEvidenceBlob({
      assetId: id,
      blob: file,
      mimeType: file.type || 'image/png',
      fileName,
      size: file.size,
      createdAt: now,
      updatedAt: now
    });
    await evidenceAssetStore.put(asset);
    return id;
  }

  function showPasteHint(message: string): void {
    pasteHint = message;
    if (pasteHintTimer) clearTimeout(pasteHintTimer);
    pasteHintTimer = setTimeout(() => {
      pasteHint = null;
    }, 2400);
  }

  function clearSeverity(): void {
    note = { ...note, severity: undefined, cvssVector: undefined, cvssScore: undefined };
    emitChange();
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

  function promoteToSubmission(): void {
    if (!canSave) return;
    save();
    void tick().then(() => {
      goto(`/submissions?fromNote=${note.id}`);
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
      <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          bind:value={note.title}
          class="hf-input flex-1"
          maxlength="200"
          placeholder="Note title"
          on:input={emitChange}
        />
        {#if note.severity}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 self-start rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:border-slate-500 sm:self-auto {severityClass}"
            on:click={clearSeverity}
            title="Click to clear severity"
          >
            <span class="capitalize">{note.severity}</span>
            {#if typeof note.cvssScore === 'number'}
              <span class="font-mono text-[11px] opacity-80">· {note.cvssScore.toFixed(1)}</span>
            {/if}
          </button>
        {/if}
      </div>
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
    <HunterActionsBar
      targetId={note.targetId}
      noteId={note.id}
      severity={note.severity}
      cvssVector={note.cvssVector}
      cvssScore={note.cvssScore}
      on:insert={handleHunterInsert}
      on:severity={handleHunterSeverity}
    />
    <div class="relative">
      <textarea
        bind:this={textarea}
        bind:value={note.content}
        class="min-h-[28rem] w-full resize-y rounded-b-lg border-0 bg-slate-850 p-4 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        maxlength="50000"
        placeholder="Write markdown notes, paste requests / payloads / screenshots — they'll be auto-filed."
        on:input={emitChange}
        on:paste={handleTextareaPaste}
      />
      {#if pasteHint}
        <div
          class="pointer-events-none absolute right-4 top-3 rounded-md border border-primary-500/40 bg-primary-500/15 px-3 py-1.5 text-xs font-medium text-primary-100 shadow-sm"
          aria-live="polite"
        >
          {pasteHint}
        </div>
      {/if}
    </div>
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
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto">
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-750 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSave}
          on:click={promoteToSubmission}
          title="Save and open the submission form pre-filled with this note"
        >
          Promote to submission
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          disabled={!canSave}
          on:click={save}
        >
          Save
        </button>
      </div>
    </div>
  </div>
</section>
