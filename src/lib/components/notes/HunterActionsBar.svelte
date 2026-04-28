<script lang="ts">
  import CvssCalculator from '$lib/components/cvss/CvssCalculator.svelte';
  import HttpRequestEditor from '$lib/components/http/HttpRequestEditor.svelte';
  import EncoderPanel from '$lib/components/tools/EncoderPanel.svelte';
  import JwtPanel from '$lib/components/tools/JwtPanel.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { evidenceAssetStore } from '$lib/stores';
  import type { CvssBaseSeverity, EvidenceAsset, PayoutSeverity } from '$lib/types';
  import { severityColorClass } from '$lib/utils/cvss';
  import { Code2, FileLock2, Image as ImageIcon, Network, Paperclip, ShieldCheck } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  /**
   * The "Hunter Actions" strip lives between the markdown toolbar and
   * the content textarea. It exposes the same toolkit a hunter would
   * normally context-switch to — HTTP exchange editor, JWT/Base64
   * decoders, CVSS calculator, evidence picker — but inline so the
   * note never loses focus. Each tool dispatches an `insert` event
   * carrying markdown to splice at the cursor, plus optional severity
   * updates that the parent NoteEditor folds back into the note.
   */

  export let targetId = '';
  export let noteId = '';
  export let severity: PayoutSeverity | undefined = undefined;
  export let cvssVector: string | undefined = undefined;
  export let cvssScore: number | undefined = undefined;
  /** Callback for the parent screenshot-paste shortcut button. */
  export let onPasteScreenshot: (() => void) | undefined = undefined;

  const dispatch = createEventDispatcher<{
    insert: { markdown: string };
    severity: { severity?: PayoutSeverity; cvssVector?: string; cvssScore?: number };
  }>();

  type ActiveModal = 'http' | 'jwt' | 'base64' | 'cvss' | 'evidence' | null;
  let activeModal: ActiveModal = null;

  const severityChips: { value: PayoutSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Info' }
  ];

  $: linkedEvidence = (() => {
    if (!targetId && !noteId) return [] as EvidenceAsset[];
    return $evidenceAssetStore
      .filter((asset) => asset.noteId === noteId || asset.targetId === targetId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 30);
  })();

  function close(): void {
    activeModal = null;
  }

  function setSeverity(value: PayoutSeverity | undefined): void {
    severity = value;
    dispatch('severity', { severity, cvssVector, cvssScore });
  }

  function severityFromBase(base: CvssBaseSeverity): PayoutSeverity | undefined {
    if (base === 'critical') return 'critical';
    if (base === 'high') return 'high';
    if (base === 'medium') return 'medium';
    if (base === 'low') return 'low';
    if (base === 'none') return 'informational';
    return undefined;
  }

  function handleCvssChange(event: CustomEvent<{ vector: string; score: number; severity: CvssBaseSeverity }>): void {
    cvssVector = event.detail.vector;
    cvssScore = event.detail.score;
    severity = severityFromBase(event.detail.severity) ?? severity;
    dispatch('severity', { severity, cvssVector, cvssScore });
  }

  function handleHttpInsert(event: CustomEvent<{ markdown: string }>): void {
    dispatch('insert', { markdown: event.detail.markdown });
    close();
  }

  function insertJwtMarkdown(token: string): void {
    if (!token.trim()) return;
    const markdown = `**JWT** \n\n\`\`\`jwt\n${token.trim()}\n\`\`\``;
    dispatch('insert', { markdown });
    close();
  }

  function insertBase64Markdown(input: string, decoded: string): void {
    if (!input.trim()) return;
    const lines = ['**Base64**', '', '```base64', input.trim(), '```'];
    if (decoded) lines.push('', '*Decoded:*', '```', decoded, '```');
    dispatch('insert', { markdown: lines.join('\n') });
    close();
  }

  function insertEvidenceRef(asset: EvidenceAsset): void {
    const isImage = asset.kind === 'image' || asset.mimeType.startsWith('image/');
    const markdown = isImage
      ? `![${asset.title}](evidence:${asset.id})`
      : `[[evidence:${asset.id}]]`;
    dispatch('insert', { markdown });
    close();
  }

  // Inline state for inside-modal tools.
  let jwtToken = '';
  let base64Input = '';
  let base64Decoded = '';
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900/40 px-3 py-2">
  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hunter</span>

  <button
    type="button"
    class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    on:click={() => (activeModal = 'http')}
  >
    <Network size={14} aria-hidden="true" />
    HTTP exchange
  </button>

  <button
    type="button"
    class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    on:click={() => (activeModal = 'jwt')}
  >
    <FileLock2 size={14} aria-hidden="true" />
    JWT
  </button>

  <button
    type="button"
    class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    on:click={() => (activeModal = 'base64')}
  >
    <Code2 size={14} aria-hidden="true" />
    Encode / decode
  </button>

  <button
    type="button"
    class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    on:click={() => (activeModal = 'evidence')}
  >
    <Paperclip size={14} aria-hidden="true" />
    Reference evidence
  </button>

  {#if onPasteScreenshot}
    <button
      type="button"
      class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      on:click={onPasteScreenshot}
      title="Tip: just press Cmd/Ctrl+V inside the note while a screenshot is on your clipboard"
    >
      <ImageIcon size={14} aria-hidden="true" />
      Screenshot
    </button>
  {/if}

  <span class="ml-auto flex flex-wrap items-center gap-1.5">
    <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Severity</span>
    <button
      type="button"
      class="rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition {severity ===
      undefined
        ? 'border-primary/60 bg-primary/15 text-primary'
        : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
      on:click={() => setSeverity(undefined)}
    >
      —
    </button>
    {#each severityChips as chip}
      <button
        type="button"
        class="rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition {severity ===
        chip.value
          ? 'border-primary/60 bg-primary/15 text-primary'
          : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
        on:click={() => setSeverity(chip.value)}
      >
        {chip.label}
      </button>
    {/each}
    <button
      type="button"
      class="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      on:click={() => (activeModal = 'cvss')}
    >
      <ShieldCheck size={12} aria-hidden="true" />
      {cvssScore != null ? `${cvssScore.toFixed(1)} CVSS` : 'CVSS'}
    </button>
  </span>
</div>

<Modal open={activeModal === 'http'} title="Insert HTTP exchange" on:close={close}>
  <HttpRequestEditor allowInsert on:insert={handleHttpInsert} />
</Modal>

<Modal open={activeModal === 'jwt'} title="JWT decoder" on:close={close}>
  <JwtPanel />
  <label class="mt-4 block">
    <span class="hf-label text-xs">Insert this token into the note</span>
    <textarea
      bind:value={jwtToken}
      placeholder="Paste the JWT you want to embed in the note"
      class="hf-input mt-2 min-h-[80px] font-mono text-xs"
      spellcheck="false"
    ></textarea>
  </label>
  <div class="mt-3 flex justify-end gap-2">
    <button type="button" class="hf-button-secondary" on:click={close}>Cancel</button>
    <button
      type="button"
      class="hf-button-primary"
      disabled={!jwtToken.trim()}
      on:click={() => insertJwtMarkdown(jwtToken)}
    >
      Insert
    </button>
  </div>
</Modal>

<Modal open={activeModal === 'base64'} title="Encode / decode" on:close={close}>
  <EncoderPanel />
  <div class="mt-4 grid gap-3 sm:grid-cols-2">
    <label class="block">
      <span class="hf-label text-xs">Original</span>
      <textarea bind:value={base64Input} class="hf-input mt-2 font-mono text-xs" rows="3" spellcheck="false"></textarea>
    </label>
    <label class="block">
      <span class="hf-label text-xs">Decoded (optional)</span>
      <textarea bind:value={base64Decoded} class="hf-input mt-2 font-mono text-xs" rows="3" spellcheck="false"></textarea>
    </label>
  </div>
  <div class="mt-3 flex justify-end gap-2">
    <button type="button" class="hf-button-secondary" on:click={close}>Cancel</button>
    <button
      type="button"
      class="hf-button-primary"
      disabled={!base64Input.trim()}
      on:click={() => insertBase64Markdown(base64Input, base64Decoded)}
    >
      Insert
    </button>
  </div>
</Modal>

<Modal open={activeModal === 'cvss'} title="Severity & CVSS" on:close={close}>
  <CvssCalculator vector={cvssVector ?? ''} on:change={handleCvssChange} />
  <p class="mt-3 text-xs text-muted-foreground">
    Severity auto-syncs from the calculator and travels with the note when you Promote to Submission.
  </p>
  <div class="mt-3 flex justify-end">
    <button type="button" class="hf-button-primary" on:click={close}>Done</button>
  </div>
</Modal>

<Modal open={activeModal === 'evidence'} title="Reference evidence" on:close={close}>
  {#if linkedEvidence.length === 0}
    <div class="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      No evidence yet for this target.
      <br />
      Capture some via Quick Capture (⌘⇧K) or the Evidence workspace.
    </div>
  {:else}
    <p class="text-xs text-muted-foreground">
      Click an asset to embed it as an inline reference. Image evidence renders as an inline preview;
      everything else renders as a clickable tile in the preview pane.
    </p>
    <ul class="mt-3 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
      {#each linkedEvidence as asset (asset.id)}
        <li>
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-muted/40"
            on:click={() => insertEvidenceRef(asset)}
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground">
              {#if asset.kind === 'image'}
                <ImageIcon size={14} aria-hidden="true" />
              {:else if asset.kind === 'http-exchange' || asset.kind === 'request' || asset.kind === 'response'}
                <Network size={14} aria-hidden="true" />
              {:else}
                <Paperclip size={14} aria-hidden="true" />
              {/if}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-foreground">{asset.title}</span>
              <span class="block truncate text-[11px] text-muted-foreground">
                {asset.kind}{asset.tags.length > 0 ? ` · ${asset.tags.slice(0, 3).join(', ')}` : ''}
              </span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</Modal>

{#if severity && cvssVector}
  <div class="border-b border-slate-700 bg-slate-900/40 px-3 py-1.5 text-[11px]">
    <span class="op-mono inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-muted-foreground">
      <span class="font-semibold uppercase tracking-[0.08em] {severityColorClass(
        severity === 'informational' ? 'none' : (severity as CvssBaseSeverity)
      )} rounded px-1.5 py-0.5"
        >{severity}</span
      >
      {cvssVector}
    </span>
  </div>
{/if}
