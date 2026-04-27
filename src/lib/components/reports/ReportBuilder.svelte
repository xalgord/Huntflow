<script lang="ts">
  import type { Note } from '$lib/types';
  import {
    buildReportDraftFromNote,
    copyReportMarkdown,
    createEmptyReportFields,
    downloadMarkdownReport,
    getMissingRequiredSections,
    getReportTemplate,
    printReportAsPdf,
    renderReportMarkdown,
    suggestSeverityFromTags,
    type ReportDraft,
    type ReportFields,
    type ReportPlatform,
    type ReportSeverity,
    type ReportTemplate
  } from '$lib/utils/reports';
  import { AlertCircle, Clipboard, Download, Printer, RefreshCw } from 'lucide-svelte';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import CvssCalculator from '$lib/components/cvss/CvssCalculator.svelte';
  import HttpRequestEditor from '$lib/components/http/HttpRequestEditor.svelte';
  import { severityFromCvssScore } from '$lib/utils/cvss';
  import ReportPreview from './ReportPreview.svelte';

  let cvssOpen = false;
  let httpOpen = false;

  export let note: Note | null = null;
  export let notes: Note[] = [];
  export let platform: ReportPlatform = 'hackerone';
  export let customTemplate: ReportTemplate | null = null;

  const dispatch = createEventDispatcher<{
    change: ReportDraft;
    export: { format: 'markdown' | 'pdf' | 'clipboard'; markdown: string };
  }>();

  const platformOptions: { value: ReportPlatform; label: string }[] = [
    { value: 'hackerone', label: 'HackerOne' },
    { value: 'bugcrowd', label: 'Bugcrowd' },
    { value: 'intigriti', label: 'Intigriti' },
    { value: 'custom', label: 'Custom' }
  ];

  const severityOptions: { value: ReportSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Informational' }
  ];

  let selectedNoteId = '';
  let fields: ReportFields = createEmptyReportFields();
  let sourceNotes: Note[] = [];
  let activeNote: Note | null = null;
  let activeTemplate: ReportTemplate = getReportTemplate(platform);
  let severitySuggestion: ReportSeverity | null = null;
  let markdown = '';
  let missingRequiredSections: string[] = [];
  let lastSeededNoteId = '';
  let copied = false;
  let pdfBlocked = false;
  let copiedReset: ReturnType<typeof setTimeout> | null = null;

  $: sourceNotes = mergeNotes(note, notes);
  $: if (!selectedNoteId && sourceNotes.length > 0) selectedNoteId = sourceNotes[0].id;
  $: activeNote = sourceNotes.find((sourceNote) => sourceNote.id === selectedNoteId) ?? sourceNotes[0] ?? null;
  $: activeTemplate = templateFor(platform);
  $: severitySuggestion = activeNote ? suggestSeverityFromTags(activeNote.tags) : null;
  $: markdown = renderReportMarkdown(activeTemplate, fields);
  $: missingRequiredSections = getMissingRequiredSections(activeTemplate, fields);
  $: if (activeNote && activeNote.id !== lastSeededNoteId) seedFromNote(activeNote, activeTemplate);
  $: if (!activeNote && lastSeededNoteId !== 'manual') {
    fields = createEmptyReportFields();
    lastSeededNoteId = 'manual';
  }

  function mergeNotes(primary: Note | null, list: Note[]): Note[] {
    const byId = new Map<string, Note>();
    if (primary) byId.set(primary.id, primary);
    for (const item of list) byId.set(item.id, item);
    return Array.from(byId.values());
  }

  function templateFor(nextPlatform: ReportPlatform): ReportTemplate {
    if (nextPlatform === 'custom' && customTemplate) return customTemplate;
    return getReportTemplate(nextPlatform);
  }

  function seedFromNote(sourceNote: Note, template: ReportTemplate): void {
    const draft = buildDraftFromSource(sourceNote, template);
    fields = { ...draft.fields };
    selectedNoteId = sourceNote.id;
    lastSeededNoteId = sourceNote.id;
    copied = false;
    pdfBlocked = false;
    dispatch('change', draft);
  }

  function buildDraftFromSource(sourceNote: Note, template: ReportTemplate): ReportDraft {
    return buildReportDraftFromNote(sourceNote, template);
  }

  function currentDraft(template: ReportTemplate = activeTemplate): ReportDraft {
    const currentMarkdown = renderReportMarkdown(template, fields);

    return {
      platform: template.platform,
      templateId: template.id,
      noteId: activeNote?.id,
      fields: { ...fields },
      markdown: currentMarkdown,
      missingRequiredSections: getMissingRequiredSections(template, fields),
      updatedAt: Date.now()
    };
  }

  function emitChange(template: ReportTemplate = activeTemplate): void {
    copied = false;
    pdfBlocked = false;
    dispatch('change', currentDraft(template));
  }

  function handleFieldInput(): void {
    fields = { ...fields };
    emitChange();
  }

  function handlePlatformChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement;
    platform = target.value as ReportPlatform;
    emitChange(templateFor(platform));
  }

  function handleNoteChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement;
    selectedNoteId = target.value;
    const nextNote = sourceNotes.find((sourceNote) => sourceNote.id === selectedNoteId);
    if (nextNote) seedFromNote(nextNote, activeTemplate);
  }

  function refreshFromNote(): void {
    if (!activeNote) return;
    seedFromNote(activeNote, activeTemplate);
  }

  function applySeveritySuggestion(): void {
    if (!severitySuggestion) return;
    fields = { ...fields, severity: severitySuggestion };
    emitChange();
  }

  function handleCvssChange(event: CustomEvent<{ vector: string; score: number; severity: string }>): void {
    const { vector, score } = event.detail;
    const mapped = severityFromCvssScore(score);
    fields = {
      ...fields,
      cvssVector: vector,
      cvssScore: score,
      severity: mapped === 'none' ? fields.severity : (mapped as ReportSeverity)
    };
    emitChange();
  }

  function appendToProofOfConcept(text: string): void {
    const current = fields.proofOfConcept?.trim() ?? '';
    const next = current ? `${current}\n\n${text}` : text;
    fields = { ...fields, proofOfConcept: next };
    emitChange();
  }

  function handleHttpInsert(event: CustomEvent<{ markdown: string }>): void {
    appendToProofOfConcept(event.detail.markdown);
    httpOpen = false;
  }

  function exportMarkdown(): void {
    downloadMarkdownReport(markdown, fields.title || activeNote?.title || 'huntflow-report');
    dispatch('export', { format: 'markdown', markdown });
  }

  async function copyMarkdown(): Promise<void> {
    copied = await copyReportMarkdown(markdown);
    dispatch('export', { format: 'clipboard', markdown });

    if (copiedReset) clearTimeout(copiedReset);
    copiedReset = setTimeout(() => {
      copied = false;
    }, 2200);
  }

  function exportPdf(): void {
    pdfBlocked = !printReportAsPdf(markdown, fields.title || activeNote?.title || 'HuntFlow Report');
    dispatch('export', { format: 'pdf', markdown });
  }

  function severityLabel(value: ReportSeverity): string {
    return severityOptions.find((option) => option.value === value)?.label ?? value;
  }

  onDestroy(() => {
    if (copiedReset) clearTimeout(copiedReset);
  });
</script>

<section class="space-y-5">
  <div class="rounded-lg border border-slate-700 bg-slate-800 shadow-dark-sm">
    <div class="flex flex-col gap-4 border-b border-slate-700 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-primary-400">Reports</p>
        <h1 class="mt-1 text-2xl font-bold leading-tight text-slate-100">Report Builder</h1>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          disabled={!markdown.trim()}
          on:click={copyMarkdown}
        >
          <Clipboard size={18} aria-hidden="true" />
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          disabled={!markdown.trim()}
          on:click={exportMarkdown}
        >
          <Download size={18} aria-hidden="true" />
          .md
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          disabled={!markdown.trim()}
          on:click={exportPdf}
        >
          <Printer size={18} aria-hidden="true" />
          PDF
        </button>
      </div>
    </div>

    <div class="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
      <label class="block">
        <span class="hf-label">Platform</span>
        <select
          value={platform}
          class="hf-select mt-2"
          on:change={handlePlatformChange}
        >
          {#each platformOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="block">
        <span class="hf-label">Source Note</span>
        <select
          value={selectedNoteId}
          class="hf-select mt-2"
          disabled={sourceNotes.length === 0}
          on:change={handleNoteChange}
        >
          {#if sourceNotes.length === 0}
            <option value="">Manual report</option>
          {:else}
            {#each sourceNotes as sourceNote}
              <option value={sourceNote.id}>{sourceNote.title || 'Untitled note'}</option>
            {/each}
          {/if}
        </select>
      </label>

      <button
        type="button"
        class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        disabled={!activeNote}
        on:click={refreshFromNote}
      >
        <RefreshCw size={18} aria-hidden="true" />
        Refresh
      </button>
    </div>
  </div>

  {#if missingRequiredSections.length > 0 || pdfBlocked}
    <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      <div class="flex gap-3">
        <AlertCircle size={20} class="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
        <div class="space-y-1">
          {#if missingRequiredSections.length > 0}
            <p>Missing required sections: {missingRequiredSections.join(', ')}</p>
          {/if}
          {#if pdfBlocked}
            <p>PDF export was blocked by the browser.</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <section class="rounded-lg border border-slate-700 bg-slate-800 shadow-dark-sm">
      <div class="border-b border-slate-700 px-4 py-3">
        <h2 class="text-sm font-semibold text-slate-200">{activeTemplate.name}</h2>
      </div>

      <div class="space-y-5 p-4">
        <label class="block">
          <span class="hf-label">Title</span>
          <input
            bind:value={fields.title}
            class="hf-input mt-2"
            maxlength="200"
            placeholder="Vulnerability report title"
            on:input={handleFieldInput}
          />
        </label>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="block">
            <span class="hf-label">Severity</span>
            <select
              bind:value={fields.severity}
              class="hf-select mt-2"
              on:change={handleFieldInput}
            >
              {#each severityOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            {#if severitySuggestion}
              <span class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                Suggested from tags: {severityLabel(severitySuggestion)}
                {#if fields.severity !== severitySuggestion}
                  <button
                    type="button"
                    class="min-h-0 rounded border border-primary-500/30 px-2 py-1 text-primary-300 transition hover:bg-primary-500/10"
                    on:click={applySeveritySuggestion}
                  >
                    Apply
                  </button>
                {/if}
              </span>
            {/if}
          </label>

          <label class="block">
            <span class="hf-label">Affected Asset</span>
            <input
              bind:value={fields.affectedAsset}
              class="hf-input mt-2"
              placeholder="Endpoint, host, app, or scope item"
              on:input={handleFieldInput}
            />
          </label>
        </div>

        <div class="rounded-lg border border-slate-700 bg-slate-850/60">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:bg-slate-700/40"
            on:click={() => (cvssOpen = !cvssOpen)}
            aria-expanded={cvssOpen}
          >
            <span class="flex items-center gap-3">
              <span>CVSS 3.1</span>
              {#if fields.cvssScore != null}
                <span class="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary">
                  {fields.cvssScore.toFixed(1)}
                </span>
              {:else}
                <span class="text-xs font-normal text-muted-foreground">Optional · adds vector & score to report</span>
              {/if}
            </span>
            <span class="text-xs text-muted-foreground">{cvssOpen ? 'Hide' : 'Open'}</span>
          </button>
          {#if cvssOpen}
            <div class="border-t border-slate-700 p-4">
              <CvssCalculator
                vector={fields.cvssVector ?? ''}
                on:change={handleCvssChange}
              />
            </div>
          {/if}
        </div>

        <label class="block">
          <span class="hf-label">Vulnerability Type</span>
          <input
            bind:value={fields.vulnerabilityType}
            class="hf-input mt-2"
            placeholder="IDOR, SSRF, stored XSS, access control, etc."
            on:input={handleFieldInput}
          />
        </label>

        <label class="block">
          <span class="hf-label">Summary</span>
          <textarea
            bind:value={fields.summary}
            rows={4}
            class="mt-2 min-h-[120px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            placeholder="Short description of the vulnerability"
            on:input={handleFieldInput}
          ></textarea>
        </label>

        <label class="block">
          <span class="hf-label">Steps to Reproduce</span>
          <textarea
            bind:value={fields.reproductionSteps}
            rows={7}
            class="mt-2 min-h-[180px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            placeholder="1. Authenticate as...
2. Send request to...
3. Observe..."
            on:input={handleFieldInput}
          ></textarea>
        </label>

        <label class="block">
          <span class="hf-label">Impact</span>
          <textarea
            bind:value={fields.impact}
            rows={4}
            class="mt-2 min-h-[120px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            placeholder="Security impact and business risk"
            on:input={handleFieldInput}
          ></textarea>
        </label>

        <label class="block">
          <span class="hf-label">Proof of Concept</span>
          <textarea
            bind:value={fields.proofOfConcept}
            rows={5}
            class="mt-2 min-h-[140px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            placeholder="Requests, responses, payloads, screenshots, or links"
            on:input={handleFieldInput}
          ></textarea>
        </label>

        <div class="rounded-lg border border-slate-700 bg-slate-850/60">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:bg-slate-700/40"
            on:click={() => (httpOpen = !httpOpen)}
            aria-expanded={httpOpen}
          >
            <span class="flex items-center gap-3">
              <span>HTTP Request Capture</span>
              <span class="text-xs font-normal text-muted-foreground">Paste raw req/res or cURL · inserts into PoC</span>
            </span>
            <span class="text-xs text-muted-foreground">{httpOpen ? 'Hide' : 'Open'}</span>
          </button>
          {#if httpOpen}
            <div class="border-t border-slate-700 p-4">
              <HttpRequestEditor on:insert={handleHttpInsert} />
            </div>
          {/if}
        </div>

        <label class="block">
          <span class="hf-label">Remediation</span>
          <textarea
            bind:value={fields.remediation}
            rows={4}
            class="mt-2 min-h-[120px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            placeholder="Recommended fix or mitigation"
            on:input={handleFieldInput}
          ></textarea>
        </label>

        <label class="block">
          <span class="hf-label">References</span>
          <textarea
            bind:value={fields.references}
            rows={3}
            class="mt-2 min-h-[96px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            placeholder="CWE, docs, advisories, or related writeups"
            on:input={handleFieldInput}
          ></textarea>
        </label>
      </div>
    </section>

    <ReportPreview {markdown} title="Live Preview" />
  </div>
</section>
