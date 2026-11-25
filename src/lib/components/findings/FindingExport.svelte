<script lang="ts">
  import type { EvidenceAsset, Submission } from '$lib/types';
  import {
    EXPORT_PLATFORMS,
    exportPlatformFor,
    platformFields,
    renderFindingMarkdown,
    reportCompleteness,
    type ExportPlatform
  } from '$lib/utils/findingReport';
  import { downloadMarkdownReport, printReportAsPdf } from '$lib/utils/reports';
  import { AlertCircle, Check, CheckCircle2, Copy, Download, Printer } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let finding: Submission;
  export let programName = '';
  export let evidence: EvidenceAsset[] = [];

  const dispatch = createEventDispatcher<{ markSubmitted: { reportUrl?: string } }>();

  let platform: ExportPlatform = exportPlatformFor(finding.platform);
  let loadedId = finding.id;
  let copiedId = '';
  let reportUrl = finding.reportUrl ?? '';

  $: if (finding.id !== loadedId) {
    loadedId = finding.id;
    platform = exportPlatformFor(finding.platform);
    reportUrl = finding.reportUrl ?? '';
  }
  $: context = { programName, evidence };
  $: fields = platformFields(finding, platform, context);
  $: completeness = reportCompleteness(finding);

  async function copy(id: string, value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    copiedId = id;
    setTimeout(() => {
      if (copiedId === id) copiedId = '';
    }, 1400);
  }
</script>

<div class="space-y-4">
  <div
    class="flex items-start gap-2.5 rounded-[10px] p-3 text-[0.8125rem] {completeness.ready
      ? 'bg-green-500/[0.12] text-green-400'
      : 'bg-orange-500/[0.12] text-orange-400'}"
    role="status"
  >
    {#if completeness.ready}
      <CheckCircle2 size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
      <span><span class="font-semibold">Ready to submit.</span> Every section triage expects is filled in.</span>
    {:else}
      <AlertCircle size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
      <span><span class="font-semibold">Before you submit:</span> {completeness.missing.join(', ')}.</span>
    {/if}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="hf-segmented" role="radiogroup" aria-label="Export format">
      {#each EXPORT_PLATFORMS as option}
        <button
          type="button"
          role="radio"
          aria-checked={platform === option.id}
          class="hf-segment {platform === option.id ? 'hf-segment-active' : ''}"
          on:click={() => (platform = option.id)}>{option.label}</button
        >
      {/each}
    </div>
    <div class="flex gap-1">
      <button
        type="button"
        class="hf-button-secondary h-8 min-h-0 text-xs"
        on:click={() => copy('__all', renderFindingMarkdown(finding, context))}
      >
        {#if copiedId === '__all'}<Check size={13} aria-hidden="true" />{:else}<Copy size={13} aria-hidden="true" />{/if}
        Copy Markdown
      </button>
      <button
        type="button"
        class="hf-icon-button"
        title="Download .md"
        aria-label="Download markdown"
        on:click={() => downloadMarkdownReport(renderFindingMarkdown(finding, context), finding.title || 'finding')}
      >
        <Download size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="hf-icon-button"
        title="Print or save as PDF"
        aria-label="Print or save as PDF"
        on:click={() => printReportAsPdf(renderFindingMarkdown(finding, context), finding.title || 'finding')}
      >
        <Printer size={15} aria-hidden="true" />
      </button>
    </div>
  </div>

  <p class="text-xs text-zinc-500">
    {platform === 'generic'
      ? 'A complete report you can paste into email, a pentest report or any platform with a single body.'
      : `Each field matches a box on the ${EXPORT_PLATFORMS.find((option) => option.id === platform)?.label} submission form — copy them in order.`}
  </p>

  <ul class="hf-list overflow-hidden rounded-[12px]" style="background: var(--hf-fill)">
    {#each fields as field (field.id)}
      <li class="px-3.5 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-zinc-300">{field.label}</p>
            {#if field.hint}<p class="text-[0.6875rem] text-zinc-500">{field.hint}</p>{/if}
          </div>
          <button
            type="button"
            class="hf-button-tinted h-7 min-h-0 shrink-0 px-2.5 text-xs"
            disabled={!field.value.trim()}
            on:click={() => copy(field.id, field.value)}
          >
            {#if copiedId === field.id}<Check size={12} aria-hidden="true" /> Copied{:else}<Copy size={12} aria-hidden="true" /> Copy{/if}
          </button>
        </div>
        {#if field.value.trim()}
          {#if field.multiline}
            <pre
              class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 font-mono text-[0.72rem] leading-5 text-zinc-200"
              style="background: var(--hf-surface)">{field.value}</pre>
          {:else}
            <p class="mt-1 break-words text-[0.8125rem] text-zinc-100">{field.value}</p>
          {/if}
        {:else}
          <p class="mt-1 text-[0.8125rem] italic text-zinc-600">Empty</p>
        {/if}
      </li>
    {/each}
  </ul>

  {#if finding.status === 'draft'}
    <div class="hf-card-muted flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <label class="min-w-0 flex-1">
        <span class="sr-only">Report URL</span>
        <input bind:value={reportUrl} type="url" class="hf-input" placeholder="Report URL after submitting (optional)" />
      </label>
      <button
        type="button"
        class="hf-button-primary"
        on:click={() => dispatch('markSubmitted', { reportUrl: reportUrl.trim() || undefined })}
      >
        Mark as Submitted
      </button>
    </div>
  {/if}
</div>
