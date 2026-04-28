<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import {
    evidenceAssetStore,
    noteStore,
    putEvidenceBlob,
    sessionStore,
    targetStore
  } from '$lib/stores';
  import { quickCaptureStore } from '$lib/stores/quickCaptureStore';
  import type { EvidenceAsset, EvidenceAssetKind, Note, PayoutSeverity, Target } from '$lib/types';
  import { evidenceKindFromFile, normalizeEvidenceTags } from '$lib/utils/evidence';
  import { hostOfRequest, toCurl } from '$lib/utils/http';
  import { generateId } from '$lib/utils/id';
  import {
    capturedKindLabel,
    classifyClipboard,
    type CapturedClassification,
    type CapturedKind
  } from '$lib/utils/quickCapture';
  import {
    Check,
    Clipboard,
    Copy,
    FileText as FileTextIcon,
    Image as ImageIcon,
    Network,
    BookOpen,
    ShieldAlert,
    Sparkles,
    UploadCloud,
    X
  } from 'lucide-svelte';
  import { onDestroy, tick } from 'svelte';

  type Tab = 'paste' | 'image';

  const RECENT_TARGET_KEY = 'huntflow:quick-capture:last-target';

  let tab: Tab = 'paste';
  let textarea: HTMLTextAreaElement | undefined;
  let dragActive = false;
  let pastedFile: File | null = null;
  let pastedFilePreviewUrl = '';
  let saving = false;
  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  // Form state
  let inputText = '';
  let title = '';
  let targetId = '';
  let sessionId = '';
  let noteId = '';
  let tagsInput = '';
  let severity: PayoutSeverity | '' = '';
  let saveAs: 'evidence' | 'note' | 'both' = 'evidence';

  $: open = $quickCaptureStore.open;
  $: classification = inputText.trim() ? classifyClipboard(inputText) : null;
  $: targets = $targetStore.filter((target) => target.status !== 'archived');
  $: targetById = new Map($targetStore.map((target) => [target.id, target]));
  $: targetSessions = sessionId || targetId
    ? $sessionStore.filter((session) => session.targetId === targetId)
    : [];
  $: targetNotes = targetId
    ? $noteStore.filter((note) => note.targetId === targetId)
    : [];
  $: canSave = (() => {
    if (saving) return false;
    if (tab === 'image') return Boolean(pastedFile);
    if (saveAs === 'note') return inputText.trim().length > 0 && targetId !== '';
    return inputText.trim().length > 0 && targetId !== '';
  })();

  // ─── Lifecycle: open / close ────────────────────────────────────────
  $: if (open) hydrate();
  $: if (!open) reset();

  async function hydrate(): Promise<void> {
    if (!browser) return;
    await Promise.all([targetStore.load(), sessionStore.load(), noteStore.load(), evidenceAssetStore.load()]);

    const ctx = $quickCaptureStore;
    inputText = ctx.initialText ?? '';
    title = '';
    sessionId = ctx.sessionId ?? '';
    noteId = ctx.noteId ?? '';
    tagsInput = '';
    severity = '';
    saveAs = 'evidence';
    pastedFile = null;
    revokePreview();

    let nextTargetId = ctx.targetId ?? '';
    if (!nextTargetId) {
      try {
        nextTargetId = localStorage.getItem(RECENT_TARGET_KEY) ?? '';
      } catch {
        nextTargetId = '';
      }
    }
    if (!nextTargetId || !targets.some((target) => target.id === nextTargetId)) {
      nextTargetId = targets[0]?.id ?? '';
    }
    targetId = nextTargetId;
    tab = 'paste';

    await tick();
    textarea?.focus();
  }

  function reset(): void {
    if (copyTimer) clearTimeout(copyTimer);
    revokePreview();
  }

  function revokePreview(): void {
    if (pastedFilePreviewUrl) {
      URL.revokeObjectURL(pastedFilePreviewUrl);
      pastedFilePreviewUrl = '';
    }
  }

  onDestroy(() => {
    revokePreview();
    if (copyTimer) clearTimeout(copyTimer);
  });

  // ─── Paste handling ─────────────────────────────────────────────────
  function handlePaste(event: ClipboardEvent): void {
    if (!event.clipboardData) return;
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        event.preventDefault();
        adoptImageFile(file);
      }
    }
  }

  function adoptImageFile(file: File): void {
    revokePreview();
    pastedFile = file;
    pastedFilePreviewUrl = URL.createObjectURL(file);
    tab = 'image';
    saveAs = 'evidence';
    if (!title) {
      const stamp = new Date().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      title = file.name && file.name !== 'image.png' ? file.name : `Screenshot · ${stamp}`;
    }
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    dragActive = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) adoptImageFile(file);
  }

  function handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) adoptImageFile(file);
    input.value = '';
  }

  // ─── Save flow ──────────────────────────────────────────────────────
  function rememberTarget(): void {
    if (!browser || !targetId) return;
    try {
      localStorage.setItem(RECENT_TARGET_KEY, targetId);
    } catch {
      /* ignore */
    }
  }

  async function persistImageEvidence(file: File): Promise<EvidenceAsset> {
    const id = generateId();
    const now = Date.now();
    const kind: EvidenceAssetKind = evidenceKindFromFile(file);
    const tags = normalizeEvidenceTags(tagsInput);
    const asset: EvidenceAsset = {
      id,
      title: title.trim() || file.name || 'Screenshot',
      kind,
      source: 'clipboard',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      fileName: file.name || `${id}.png`,
      targetId: targetId || undefined,
      sessionId: sessionId || undefined,
      noteId: noteId || undefined,
      tags,
      syncState: 'local',
      capturedAt: now,
      createdAt: now,
      updatedAt: now
    };
    await putEvidenceBlob({
      assetId: id,
      blob: file,
      size: file.size,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      createdAt: now,
      updatedAt: now
    });
    await evidenceAssetStore.put(asset);
    await evidenceAssetStore.persistNow();
    return asset;
  }

  async function persistTextEvidence(c: CapturedClassification): Promise<EvidenceAsset> {
    const id = generateId();
    const now = Date.now();
    const tags = normalizeEvidenceTags(tagsInput);
    const kind = evidenceKindForCapture(c.kind);
    const summary = c.summary || capturedKindLabel(c.kind);
    const computedTitle = title.trim() || summary;

    const asset: EvidenceAsset = {
      id,
      title: computedTitle,
      kind,
      source: 'clipboard',
      mimeType: kind === 'url' ? 'text/uri-list' : 'text/plain',
      size: c.text.length,
      targetId: targetId || undefined,
      sessionId: sessionId || undefined,
      noteId: noteId || undefined,
      tags,
      url: kind === 'url' ? c.url?.href : undefined,
      textContent: kind === 'url' ? undefined : c.text,
      httpExchange:
        kind === 'http-exchange' && c.exchange
          ? {
              method: c.exchange.request.method,
              url: c.exchange.request.url,
              host: hostOfRequest(c.exchange.request),
              httpVersion: c.exchange.request.httpVersion,
              statusCode: c.exchange.response?.statusCode,
              statusText: c.exchange.response?.statusText,
              requestRaw: c.text.slice(0, c.exchange.responseOffset > 0 ? c.exchange.responseOffset : c.text.length),
              responseRaw:
                c.exchange.responseOffset > 0 ? c.text.slice(c.exchange.responseOffset) : undefined
            }
          : undefined,
      syncState: 'local',
      capturedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await evidenceAssetStore.put(asset);
    await evidenceAssetStore.persistNow();
    return asset;
  }

  function evidenceKindForCapture(kind: CapturedKind): EvidenceAssetKind {
    if (kind === 'http-exchange') return 'http-exchange';
    if (kind === 'http-request' || kind === 'curl') return 'request';
    if (kind === 'url') return 'url';
    return 'text';
  }

  async function persistNote(c: CapturedClassification, attachedAssetId?: string): Promise<Note> {
    const id = generateId();
    const now = Date.now();
    const tags = normalizeEvidenceTags(tagsInput);
    const fence = pickFenceForKind(c.kind);
    const heading = title.trim() || `${capturedKindLabel(c.kind)} · ${c.summary}`;
    const lines: string[] = [`## ${heading}`, '', `> ${capturedKindLabel(c.kind)} captured at ${new Date(now).toLocaleString()}`, ''];
    if (c.kind === 'jwt' && c.jwt) {
      lines.push(`Algorithm: \`${c.jwt.algorithm ?? 'unknown'}\` · Expired: \`${c.jwt.isExpired}\``, '');
    }
    if (c.kind === 'base64' && c.base64Decoded) {
      lines.push('### Decoded', '```', c.base64Decoded, '```', '');
    }
    if (c.kind === 'curl' && c.request) {
      lines.push('### As cURL', '```bash', toCurl(c.request), '```', '');
    }
    lines.push('### Captured payload', `\`\`\`${fence}`, c.text, '```');
    if (attachedAssetId) {
      lines.push('', `[[evidence:${attachedAssetId}]]`);
    }

    const note: Note = {
      id,
      title: heading.slice(0, 200),
      content: lines.join('\n'),
      targetId,
      sessionId: sessionId || undefined,
      tags,
      severity: severity || undefined,
      createdAt: now,
      updatedAt: now
    };
    await noteStore.put(note);
    await noteStore.persistNow();
    return note;
  }

  function pickFenceForKind(kind: CapturedKind): string {
    if (kind === 'http-exchange' || kind === 'http-request') return 'http';
    if (kind === 'curl') return 'bash';
    if (kind === 'url') return '';
    return '';
  }

  async function save(): Promise<void> {
    if (!canSave) return;
    saving = true;
    try {
      rememberTarget();

      if (tab === 'image' && pastedFile) {
        const asset = await persistImageEvidence(pastedFile);
        if (saveAs === 'note' || saveAs === 'both') {
          const fakeClassification: CapturedClassification = {
            kind: 'note',
            summary: asset.title,
            text: `![${asset.title}](evidence:${asset.id})`
          };
          const note = await persistNote(fakeClassification, asset.id);
          await goto(`/notes/${note.id}`);
        } else {
          await goto(`/assets?target=${targetId}&id=${asset.id}`);
        }
        quickCaptureStore.close();
        return;
      }

      if (!classification) return;

      let assetId: string | undefined;
      if (saveAs === 'evidence' || saveAs === 'both') {
        const asset = await persistTextEvidence(classification);
        assetId = asset.id;
      }
      if (saveAs === 'note' || saveAs === 'both') {
        const note = await persistNote(classification, assetId);
        await goto(`/notes/${note.id}`);
      } else if (assetId) {
        await goto(`/assets?target=${targetId}&id=${assetId}`);
      }

      quickCaptureStore.close();
    } finally {
      saving = false;
    }
  }

  async function copyText(): Promise<void> {
    if (!inputText) return;
    try {
      await navigator.clipboard.writeText(inputText);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {
      /* ignore */
    }
  }

  function close(): void {
    quickCaptureStore.close();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
  }

  function targetName(target: Target): string {
    return target.status === 'archived' ? `${target.name} (archived)` : target.name;
  }

  const severityChips: { value: PayoutSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Info' }
  ];

  const kindIconMap: Record<CapturedKind, typeof Network> = {
    'http-exchange': Network,
    'http-request': Network,
    curl: Network,
    jwt: ShieldAlert,
    url: Sparkles,
    base64: FileTextIcon,
    note: BookOpen
  };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-[80] flex items-start justify-center bg-background/80 px-4 pb-4 pt-10 backdrop-blur-md sm:pt-16"
    role="presentation"
    on:click|self={close}
  >
    <div
      class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-dark-xl backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
    >
      <!-- Header -->
      <div class="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <Clipboard size={16} aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-foreground">Quick Capture</p>
          <p class="text-xs text-muted-foreground">
            Paste anything — request, response, JWT, URL, screenshot — and HuntFlow files it correctly.
          </p>
        </div>
        <kbd class="hidden rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘⇧K
        </kbd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
          on:click={close}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-border/70 bg-muted/20 px-3 pt-2">
        <button
          type="button"
          class="border-b-2 px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] transition {tab === 'paste'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'}"
          on:click={() => (tab = 'paste')}
        >
          Paste / type
        </button>
        <button
          type="button"
          class="border-b-2 px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] transition {tab === 'image'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'}"
          on:click={() => (tab = 'image')}
        >
          Screenshot / file
        </button>
      </div>

      <div class="grid max-h-[calc(100vh-12rem)] gap-4 overflow-y-auto p-4">
        {#if tab === 'paste'}
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="hf-label text-xs">What did you copy?</span>
              {#if classification}
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary"
                  >
                    <svelte:component this={kindIconMap[classification.kind]} size={12} aria-hidden="true" />
                    {capturedKindLabel(classification.kind)}
                  </span>
                  <button
                    type="button"
                    class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Copy raw text back"
                    on:click={copyText}
                  >
                    {#if copied}
                      <Check size={14} aria-hidden="true" />
                    {:else}
                      <Copy size={14} aria-hidden="true" />
                    {/if}
                  </button>
                </div>
              {/if}
            </div>

            <textarea
              bind:this={textarea}
              bind:value={inputText}
              on:paste={handlePaste}
              spellcheck="false"
              autocapitalize="off"
              autocorrect="off"
              class="op-mono min-h-[180px] w-full resize-y rounded-lg border border-input bg-background/60 p-3 text-[12.5px] leading-5 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={'GET /api/v2/users/123 HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer eyJ...\n\nHTTP/1.1 200 OK\nContent-Type: application/json\n\n{"role":"admin"}'}
            ></textarea>

            {#if classification}
              <div class="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                <p class="op-mono text-foreground">{classification.summary}</p>
                {#if classification.kind === 'jwt' && classification.jwt}
                  <p class="op-mono mt-2 text-muted-foreground">
                    <span class="text-primary">payload</span>: {classification.jwt.payloadPreview}
                  </p>
                {:else if classification.kind === 'base64' && classification.base64Decoded}
                  <p class="op-mono mt-2 text-muted-foreground">
                    <span class="text-primary">decoded</span>:
                    {classification.base64Decoded.length > 200
                      ? `${classification.base64Decoded.slice(0, 200)}…`
                      : classification.base64Decoded}
                  </p>
                {:else if classification.kind === 'curl' && classification.request}
                  <p class="op-mono mt-2 text-muted-foreground">
                    Will save as <span class="text-primary">request</span> evidence
                  </p>
                {:else if (classification.kind === 'http-exchange' || classification.kind === 'http-request') && classification.request}
                  <p class="op-mono mt-2 text-muted-foreground">
                    Headers: <span class="text-primary">{classification.request.headers.length}</span>
                    {#if classification.kind === 'http-exchange' && classification.exchange?.response}
                      · Response body:
                      <span class="text-primary">{classification.exchange.response.body?.length ?? 0} chars</span>
                    {/if}
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {:else}
          <!--
            Drop zone for files dragged from the OS / Burp / etc.
            `role="region"` + `aria-label` satisfy svelte-a11y's requirement
            that an interactive element with drag handlers must announce
            itself to assistive tech, without making it focusable as a
            button (we don't want screen-reader users to "click" a div).
          -->
          <div
            role="region"
            aria-label="Drop a file to capture"
            class="rounded-xl border-2 border-dashed border-border/60 bg-background/40 p-6 text-center transition {dragActive
              ? 'border-primary/60 bg-primary/5'
              : ''}"
            on:dragover|preventDefault={() => (dragActive = true)}
            on:dragleave={() => (dragActive = false)}
            on:drop={handleDrop}
          >
            {#if pastedFilePreviewUrl}
              <img
                src={pastedFilePreviewUrl}
                alt="Pasted screenshot preview"
                class="mx-auto max-h-72 w-auto rounded-lg border border-border/70 object-contain"
              />
              <button
                type="button"
                class="mt-3 inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                on:click={() => {
                  revokePreview();
                  pastedFile = null;
                }}
              >
                <X size={14} aria-hidden="true" />
                Replace
              </button>
            {:else}
              <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
                <ImageIcon size={20} aria-hidden="true" />
              </span>
              <p class="mt-3 text-sm font-semibold text-foreground">Drop a screenshot here</p>
              <p class="mt-1 text-xs text-muted-foreground">or paste from clipboard with ⌘V</p>
              <label
                class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <UploadCloud size={14} aria-hidden="true" />
                Choose file
                <input type="file" accept="image/*,application/pdf" class="hidden" on:change={handleFileInput} />
              </label>
            {/if}
          </div>
        {/if}

        <!-- Context fields -->
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="hf-label text-xs">Target</span>
            <select bind:value={targetId} class="hf-select mt-1.5">
              <option value="">No target</option>
              {#each targets as target}
                <option value={target.id}>{targetName(target)}</option>
              {/each}
            </select>
          </label>
          <label class="block">
            <span class="hf-label text-xs">Title (optional)</span>
            <input
              bind:value={title}
              class="hf-input mt-1.5"
              maxlength="200"
              placeholder={classification?.summary ?? 'Auto from content'}
            />
          </label>
          <label class="block">
            <span class="hf-label text-xs">Session</span>
            <select bind:value={sessionId} class="hf-select mt-1.5" disabled={!targetId}>
              <option value="">No session</option>
              {#each targetSessions as session}
                <option value={session.id}>
                  {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
                    new Date(session.startedAt)
                  )}
                </option>
              {/each}
            </select>
          </label>
          <label class="block">
            <span class="hf-label text-xs">Link to note</span>
            <select bind:value={noteId} class="hf-select mt-1.5" disabled={!targetId}>
              <option value="">— none —</option>
              {#each targetNotes as note}
                <option value={note.id}>{note.title || 'Untitled'}</option>
              {/each}
            </select>
          </label>
        </div>

        <label class="block">
          <span class="hf-label text-xs">Tags (comma-separated)</span>
          <input bind:value={tagsInput} class="hf-input mt-1.5" placeholder="auth, prod, idor" maxlength="120" />
        </label>

        <div>
          <span class="hf-label text-xs">Severity hint (optional)</span>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              class="rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition {severity ===
              ''
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
              on:click={() => (severity = '')}
            >
              none
            </button>
            {#each severityChips as chip}
              <button
                type="button"
                class="rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition {severity ===
                chip.value
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
                on:click={() => (severity = chip.value)}
              >
                {chip.label}
              </button>
            {/each}
          </div>
        </div>

        <fieldset class="rounded-lg border border-border/60 bg-muted/20 p-3">
          <legend class="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Save as
          </legend>
          <div class="mt-1 flex flex-wrap gap-1.5">
            {#each [{ id: 'evidence', label: 'Evidence' }, { id: 'note', label: 'Note' }, { id: 'both', label: 'Evidence + note' }] as choice}
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs font-semibold transition {saveAs === choice.id
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
                on:click={() => (saveAs = choice.id)}
              >
                {choice.label}
              </button>
            {/each}
          </div>
          <p class="mt-2 text-[11px] text-muted-foreground">
            {#if saveAs === 'evidence'}
              Files the captured artifact in the Evidence vault.
            {:else if saveAs === 'note'}
              Creates a new probe-log note with the artifact embedded as a fenced code block.
            {:else}
              Files evidence and creates a note that references it. Best for findings.
            {/if}
          </p>
        </fieldset>
      </div>

      <!-- Footer -->
      <div class="flex flex-col gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-[11px] text-muted-foreground">
          <kbd class="rounded border border-border/60 bg-background/70 px-1.5 py-0.5">⌘</kbd>
          <kbd class="rounded border border-border/60 bg-background/70 px-1.5 py-0.5">↵</kbd>
          to save ·
          <kbd class="rounded border border-border/60 bg-background/70 px-1.5 py-0.5">Esc</kbd>
          to close
        </p>
        <div class="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" class="hf-button-secondary" on:click={close}>Cancel</button>
          <button type="button" class="hf-button-primary" disabled={!canSave} on:click={save}>
            {saving ? 'Saving…' : 'Save capture'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
