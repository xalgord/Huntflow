<script lang="ts">
  import SlaIndicator from '$lib/components/submissions/SlaIndicator.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import { getFindingTemplate, type FindingTemplate } from '$lib/data/findingTemplates';
  import type {
    EvidenceAsset,
    Payout,
    PayoutSeverity,
    ReconAsset,
    RetestStatus,
    Submission,
    SubmissionStatus,
    Target
  } from '$lib/types';
  import { applyFindingTemplate, findSimilarFindings, migrateLegacyReport, reportCompleteness } from '$lib/utils/findingReport';
  import { CLOSED_STATUSES, evidenceFromHttp, STATUS_FLOW, STATUS_LABELS, withStatus } from '$lib/utils/findingWorkflow';
  import { formatDate, formatMoney, formatRelativeDate, platformLabels } from '$lib/utils/workspace';
  import {
    AlertTriangle,
    ChevronLeft,
    CircleDollarSign,
    FileCode2,
    Link2,
    Network,
    Paperclip,
    Sparkles,
    Trash2,
    X
  } from 'lucide-svelte';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import AutoTextarea from './AutoTextarea.svelte';
  import CvssPanel from './CvssPanel.svelte';
  import FindingExport from './FindingExport.svelte';
  import TemplatePicker from './TemplatePicker.svelte';

  type SectionKey = 'summary' | 'stepsToReproduce' | 'impact' | 'remediation' | 'references';

  export let finding: Submission;
  export let programs: Target[] = [];
  export let reconAssets: ReconAsset[] = [];
  export let evidence: EvidenceAsset[] = [];
  export let allFindings: Submission[] = [];
  export let payouts: Payout[] = [];

  const dispatch = createEventDispatcher<{
    change: Submission;
    delete: Submission;
    createEvidence: EvidenceAsset;
    back: void;
  }>();

  const severities: Array<{ id: PayoutSeverity; label: string }> = [
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
    { id: 'informational', label: 'Info' }
  ];

  const sections: Array<{ key: SectionKey; label: string; hint: string; rows: number }> = [
    { key: 'summary', label: 'Summary', hint: 'What is vulnerable, where, and why — two or three sentences.', rows: 3 },
    { key: 'stepsToReproduce', label: 'Steps to Reproduce', hint: 'Numbered steps a triager can follow cold. Paste requests in ```http blocks.', rows: 5 },
    { key: 'impact', label: 'Impact', hint: 'What an attacker gains, who is affected, and how realistic it is. Avoid overclaiming.', rows: 3 },
    { key: 'remediation', label: 'Remediation', hint: 'The fix you would make. Optional, but triage teams love it.', rows: 2 },
    { key: 'references', label: 'References', hint: 'One link per line: CWE, OWASP, vendor docs.', rows: 2 }
  ];

  let draft: Submission = migrateLegacyReport(finding);
  let loadedId = finding.id;
  let tab: 'write' | 'submit' | 'activity' = 'write';
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let templatesOpen = false;
  let assetInput = '';
  let pasteOpen = false;
  let pasteText = '';
  let pasteError = '';
  let attachOpen = false;

  // Switching findings: flush pending edits to the previous one first.
  $: if (finding.id !== loadedId) {
    flush();
    loadedId = finding.id;
    draft = migrateLegacyReport(finding);
    tab = 'write';
    pasteOpen = false;
    attachOpen = false;
  }

  function flush(): void {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    dispatch('change', draft);
  }

  function update(patch: Partial<Submission>, immediate = false): void {
    draft = { ...draft, ...patch, updatedAt: Date.now() };
    if (saveTimer) clearTimeout(saveTimer);
    if (immediate) {
      saveTimer = null;
      dispatch('change', draft);
    } else {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        dispatch('change', draft);
      }, 350);
    }
  }

  onDestroy(flush);

  function setStatus(status: SubmissionStatus, extra: Partial<Submission> = {}): void {
    flush();
    draft = { ...withStatus(draft, status), ...extra };
    dispatch('change', draft);
  }

  function pickTemplate(event: CustomEvent<FindingTemplate>): void {
    templatesOpen = false;
    const next = applyFindingTemplate(draft, event.detail);
    update(next, true);
  }

  function addAsset(value = assetInput): void {
    const clean = value.trim();
    if (!clean) return;
    const assets = draft.affectedAssets ?? [];
    if (!assets.includes(clean)) update({ affectedAssets: [...assets, clean] }, true);
    assetInput = '';
  }

  function removeAsset(value: string): void {
    update({ affectedAssets: (draft.affectedAssets ?? []).filter((asset) => asset !== value) }, true);
  }

  function attachEvidence(id: string): void {
    const ids = draft.evidenceAssetIds ?? [];
    if (!ids.includes(id)) update({ evidenceAssetIds: [...ids, id] }, true);
    attachOpen = false;
  }

  function detachEvidence(id: string): void {
    update({ evidenceAssetIds: (draft.evidenceAssetIds ?? []).filter((candidate) => candidate !== id) }, true);
  }

  function attachPasted(): void {
    pasteError = '';
    const asset = evidenceFromHttp(pasteText, draft.targetId);
    if (!asset) {
      pasteError = 'That doesn’t look like an HTTP request or curl command.';
      return;
    }
    dispatch('createEvidence', asset);
    update({ evidenceAssetIds: [...(draft.evidenceAssetIds ?? []), asset.id] }, true);
    // Offer the request's URL as an affected asset the first time.
    const url = asset.httpExchange?.url;
    if (url && !(draft.affectedAssets ?? []).length) update({ affectedAssets: [url] }, true);
    pasteText = '';
    pasteOpen = false;
  }

  function onStatusChange(event: Event): void {
    setStatus((event.currentTarget as HTMLSelectElement).value as SubmissionStatus);
  }

  function onPlatformChange(event: Event): void {
    update({ platform: (event.currentTarget as HTMLSelectElement).value as Submission['platform'] }, true);
  }

  function onSectionInput(key: SectionKey, event: Event): void {
    update({ [key]: (event.target as HTMLTextAreaElement).value } as Partial<Submission>);
  }

  function onNotesInput(event: Event): void {
    update({ notes: (event.target as HTMLTextAreaElement).value || undefined });
  }

  function setRetest(value: string): void {
    const status = value as RetestStatus;
    update({ retestStatus: status, retestedAt: status === 'pending' ? undefined : Date.now() }, true);
  }

  function handleAssetKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addAsset();
    } else if (event.key === 'Backspace' && !assetInput && (draft.affectedAssets ?? []).length) {
      removeAsset((draft.affectedAssets ?? [])[(draft.affectedAssets ?? []).length - 1]);
    }
  }

  $: program = programs.find((item) => item.id === draft.targetId);
  $: programAssets = reconAssets.filter((asset) => asset.targetId === draft.targetId);
  $: assetSuggestions = Array.from(new Set(programAssets.map((asset) => asset.url ?? asset.hostname))).filter(
    (value) => !(draft.affectedAssets ?? []).includes(value)
  );
  $: attachedEvidence = (draft.evidenceAssetIds ?? [])
    .map((id) => evidence.find((asset) => asset.id === id))
    .filter((asset): asset is EvidenceAsset => Boolean(asset));
  $: attachableEvidence = evidence.filter(
    (asset) => (!asset.targetId || asset.targetId === draft.targetId) && !(draft.evidenceAssetIds ?? []).includes(asset.id)
  );
  $: similar = findSimilarFindings(draft, allFindings).slice(0, 3);
  $: completeness = reportCompleteness(draft);
  $: template = getFindingTemplate(draft.templateId);
  $: linkedPayouts = payouts.filter((payout) => (draft.payoutIds ?? []).includes(payout.id) || payout.submissionId === draft.id);
  $: isClosed = CLOSED_STATUSES.includes(draft.status) || draft.status === 'rewarded';
</script>

<div class="flex h-full flex-col">
  <!-- Editor toolbar -->
  <div class="flex flex-wrap items-center gap-2 border-b-[0.5px] border-zinc-800 px-4 py-2.5 sm:px-5">
    <button type="button" class="hf-icon-button -ml-1 lg:hidden" aria-label="Back to findings" on:click={() => dispatch('back')}>
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
    <div class="hf-segmented" role="tablist" aria-label="Finding view">
      {#each [['write', 'Write'], ['submit', 'Submit'], ['activity', 'Activity']] as [id, label]}
        <button
          type="button"
          role="tab"
          aria-selected={tab === id}
          class="hf-segment px-3.5 {tab === id ? 'hf-segment-active' : ''}"
          on:click={() => {
            flush();
            tab = id === 'write' ? 'write' : id === 'submit' ? 'submit' : 'activity';
          }}>{label}</button
        >
      {/each}
    </div>
    <div class="ml-auto flex items-center gap-1.5">
      <label class="sr-only" for="finding-status">Status</label>
      <select
        id="finding-status"
        class="hf-select h-8 min-h-0 w-auto py-0 text-xs font-semibold"
        value={draft.status}
        on:change={onStatusChange}
      >
        <optgroup label="Progress">
          {#each STATUS_FLOW as status}<option value={status}>{STATUS_LABELS[status]}</option>{/each}
        </optgroup>
        <optgroup label="Closed">
          {#each CLOSED_STATUSES as status}<option value={status}>{STATUS_LABELS[status]}</option>{/each}
        </optgroup>
      </select>
      <button
        type="button"
        class="hf-icon-button hover:!text-red-400"
        aria-label="Delete finding"
        title="Delete finding"
        on:click={() => dispatch('delete', draft)}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-4 pb-10 pt-4 sm:px-5">
    {#if tab === 'write'}
      <label class="sr-only" for="finding-title">Title</label>
      <textarea
        id="finding-title"
        rows="1"
        class="block w-full resize-none bg-transparent text-[1.375rem] font-bold leading-tight tracking-[-0.015em] text-zinc-50 placeholder:text-zinc-600 focus:outline-none"
        placeholder="Untitled finding"
        maxlength="200"
        value={draft.title}
        on:input={(event) => update({ title: event.currentTarget.value.replace(/\n/g, ' ') })}
      ></textarea>
      <p class="mt-1 text-xs text-zinc-500">
        {program?.name ?? 'No program'} · {platformLabels[draft.platform]} · created {formatRelativeDate(draft.createdAt)}
      </p>

      {#if similar.length > 0}
        <div class="mt-4 rounded-[10px] bg-orange-500/[0.12] p-3 text-[0.8125rem] text-orange-400" role="status">
          <p class="flex items-center gap-2 font-semibold"><AlertTriangle size={15} aria-hidden="true" /> Possible duplicate</p>
          <ul class="mt-1.5 space-y-1">
            {#each similar as match (match.finding.id)}
              <li>
                <a class="underline-offset-2 hover:underline" href={`/findings?id=${match.finding.id}`}>{match.finding.title}</a>
                <span class="text-xs text-zinc-400"> — {match.reasons.join(', ')} · {STATUS_LABELS[match.finding.status]}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Details -->
      <div class="hf-card-muted mt-4 divide-y divide-zinc-800 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
          <span class="text-[0.8125rem] text-zinc-300">Severity</span>
          <div class="hf-segmented" role="radiogroup" aria-label="Severity">
            {#each severities as option}
              <button
                type="button"
                role="radio"
                aria-checked={draft.severity === option.id}
                class="hf-segment px-2.5 {draft.severity === option.id ? 'hf-segment-active' : ''}"
                on:click={() => update({ severity: option.id }, true)}>{option.label}</button
              >
            {/each}
          </div>
        </div>
        <div class="grid gap-x-4 gap-y-2 px-3.5 py-2.5 sm:grid-cols-2">
          <label class="flex items-center justify-between gap-3">
            <span class="text-[0.8125rem] text-zinc-300">Program</span>
            <select
              class="hf-select h-8 min-h-0 w-48 py-0 text-[0.8125rem]"
              value={draft.targetId}
              on:change={(event) => {
                const next = programs.find((item) => item.id === event.currentTarget.value);
                update({ targetId: event.currentTarget.value, platform: next?.platform ?? draft.platform }, true);
              }}
            >
              {#each programs as item}<option value={item.id}>{item.name}</option>{/each}
            </select>
          </label>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[0.8125rem] text-zinc-300">Platform</span>
            <select
              class="hf-select h-8 min-h-0 w-48 py-0 text-[0.8125rem]"
              value={draft.platform}
              on:change={onPlatformChange}
            >
              {#each Object.entries(platformLabels) as [value, label]}<option {value}>{label}</option>{/each}
            </select>
          </label>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[0.8125rem] text-zinc-300">Type</span>
            <input
              class="hf-input h-8 min-h-0 w-48 py-0 text-[0.8125rem]"
              placeholder="IDOR, SSRF…"
              value={draft.vulnerabilityType ?? ''}
              on:input={(event) => update({ vulnerabilityType: event.currentTarget.value || undefined })}
            />
          </label>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[0.8125rem] text-zinc-300">Weakness</span>
            <input
              class="hf-input h-8 min-h-0 w-48 py-0 font-mono text-xs"
              placeholder="CWE-639"
              value={draft.cweId ?? ''}
              on:input={(event) => update({ cweId: event.currentTarget.value.toUpperCase() || undefined })}
            />
          </label>
        </div>
        <div class="px-3.5 py-2.5">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[0.8125rem] text-zinc-300">Affected assets</span>
            <span class="text-xs text-zinc-500">Enter to add</span>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            {#each draft.affectedAssets ?? [] as asset (asset)}
              <span class="inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-2.5 pr-1 font-mono text-[0.6875rem] text-zinc-200" style="background: var(--hf-surface)">
                <span class="truncate">{asset}</span>
                <button type="button" class="rounded-full p-0.5 text-zinc-500 hover:text-zinc-200" aria-label={`Remove ${asset}`} on:click={() => removeAsset(asset)}>
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            {/each}
            <input
              class="min-w-[12rem] flex-1 bg-transparent py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              placeholder="https://api.example.com/v1/orders/{'{id}'}"
              list="finding-asset-suggestions"
              bind:value={assetInput}
              on:keydown={handleAssetKey}
              on:blur={() => addAsset()}
              aria-label="Add affected asset"
            />
            <datalist id="finding-asset-suggestions">
              {#each assetSuggestions as suggestion}<option value={suggestion}></option>{/each}
            </datalist>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" class="hf-button-tinted h-8 min-h-0 text-xs" on:click={() => (templatesOpen = true)}>
          <Sparkles size={13} aria-hidden="true" />
          {template ? `Template: ${template.vulnerabilityType}` : 'Start from a Template'}
        </button>
        {#if !completeness.ready}
          <span class="text-xs text-zinc-500">Missing: {completeness.missing.join(', ')}</span>
        {:else}
          <span class="text-xs text-green-500">Ready to submit</span>
        {/if}
      </div>

      <!-- Write-up -->
      <div class="mt-5 space-y-5">
        {#each sections as section (section.key)}
          <section>
            <label for={`finding-${section.key}`} class="block text-[0.8125rem] font-semibold text-zinc-100">{section.label}</label>
            <p class="mb-1.5 text-xs text-zinc-500">{section.hint}</p>
            <AutoTextarea
              id={`finding-${section.key}`}
              minRows={section.rows}
              mono={section.key === 'stepsToReproduce' || section.key === 'references'}
              value={draft[section.key] ?? ''}
              on:input={(event) => onSectionInput(section.key, event)}
            />
          </section>
        {/each}

        <!-- Evidence -->
        <section>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-[0.8125rem] font-semibold text-zinc-100">Evidence</p>
              <p class="text-xs text-zinc-500">Requests are embedded in the report; attach screenshots on the platform too.</p>
            </div>
            <div class="flex gap-1.5">
              <button type="button" class="hf-button-secondary h-8 min-h-0 text-xs" on:click={() => (pasteOpen = !pasteOpen)}>
                <FileCode2 size={13} aria-hidden="true" /> Paste Request
              </button>
              <div class="relative">
                <button
                  type="button"
                  class="hf-button-secondary h-8 min-h-0 text-xs"
                  disabled={attachableEvidence.length === 0}
                  title={attachableEvidence.length === 0 ? 'No evidence for this program yet' : 'Attach from the evidence vault'}
                  on:click={() => (attachOpen = !attachOpen)}
                >
                  <Paperclip size={13} aria-hidden="true" /> Attach
                </button>
                {#if attachOpen}
                  <div class="fixed inset-0 z-30" role="presentation" on:click={() => (attachOpen = false)}></div>
                  <ul class="hf-material absolute right-0 z-40 mt-1 max-h-72 w-72 overflow-y-auto rounded-[10px] p-1 shadow-dark-lg" role="menu">
                    {#each attachableEvidence as asset (asset.id)}
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[0.8125rem] text-zinc-100 hover:bg-primary hover:text-white"
                          on:click={() => attachEvidence(asset.id)}
                        >
                          <span class="truncate">{asset.title}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          </div>

          {#if pasteOpen}
            <div class="mt-2 space-y-2">
              <AutoTextarea
                bind:value={pasteText}
                mono
                minRows={5}
                label="Raw HTTP request or curl command"
                placeholder={'Paste a raw request (optionally followed by the response) from Burp/Caido, or a curl command'}
              />
              {#if pasteError}<p class="text-xs text-red-400" role="alert">{pasteError}</p>{/if}
              <div class="flex justify-end gap-2">
                <button type="button" class="hf-button-ghost h-8 min-h-0 text-xs" on:click={() => (pasteOpen = false)}>Cancel</button>
                <button type="button" class="hf-button-primary h-8 min-h-0 text-xs" on:click={attachPasted}>Attach Request</button>
              </div>
            </div>
          {/if}

          {#if attachedEvidence.length > 0}
            <ul class="hf-list mt-2 overflow-hidden rounded-[10px]" style="background: var(--hf-fill)">
              {#each attachedEvidence as asset (asset.id)}
                <li class="flex items-center gap-2.5 px-3 py-2">
                  {#if asset.kind === 'http-exchange'}
                    <Network size={14} class="shrink-0 text-blue-500" aria-hidden="true" />
                  {:else if asset.kind === 'url'}
                    <Link2 size={14} class="shrink-0 text-blue-500" aria-hidden="true" />
                  {:else}
                    <Paperclip size={14} class="shrink-0 text-zinc-500" aria-hidden="true" />
                  {/if}
                  <span class="min-w-0 flex-1 truncate text-[0.8125rem] text-zinc-100">{asset.title}</span>
                  {#if asset.httpExchange?.statusCode}
                    <span class="font-mono text-[0.6875rem] text-zinc-500">{asset.httpExchange.statusCode}</span>
                  {/if}
                  <button type="button" class="hf-icon-button h-6 w-6" aria-label={`Detach ${asset.title}`} on:click={() => detachEvidence(asset.id)}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <section>
          <p class="text-[0.8125rem] font-semibold text-zinc-100">CVSS</p>
          <p class="mb-2 text-xs text-zinc-500">Picking metrics updates the severity above.</p>
          <div class="hf-card-muted p-3.5">
            <CvssPanel
              vector31={draft.cvssVector ?? ''}
              vector40={draft.cvss4Vector ?? ''}
              on:change31={(event) =>
                update({ cvssVector: event.detail.vector, cvssScore: event.detail.score, ...(event.detail.severity ? { severity: event.detail.severity } : {}) }, true)}
              on:change40={(event) =>
                update({ cvss4Vector: event.detail.vector, cvss4Score: event.detail.score, ...(event.detail.severity ? { severity: event.detail.severity } : {}) }, true)}
            />
          </div>
        </section>
      </div>
    {:else if tab === 'submit'}
      <FindingExport
        finding={draft}
        programName={program?.name ?? ''}
        evidence={attachedEvidence}
        on:markSubmitted={(event) => setStatus('submitted', { reportUrl: event.detail.reportUrl ?? draft.reportUrl })}
      />
    {:else}
      <div class="space-y-5">
        <div class="hf-card-muted divide-y divide-zinc-800 overflow-hidden text-[0.8125rem]">
          <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span class="text-zinc-300">Response time</span>
            <SlaIndicator submission={draft} />
          </div>
          <label class="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span class="text-zinc-300">Report URL</span>
            <input
              type="url"
              class="hf-input h-8 min-h-0 max-w-xs py-0 text-[0.8125rem]"
              placeholder="https://hackerone.com/reports/…"
              value={draft.reportUrl ?? ''}
              on:input={(event) => update({ reportUrl: event.currentTarget.value || undefined })}
            />
          </label>
          {#if draft.status === 'resolved' || draft.status === 'rewarded' || draft.retestStatus}
            <div class="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
              <span class="text-zinc-300">Retest</span>
              <div class="hf-segmented" role="radiogroup" aria-label="Retest status">
                {#each [['pending', 'Pending'], ['fixed', 'Fixed'], ['not-fixed', 'Not Fixed']] as [value, label]}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.retestStatus === value}
                    class="hf-segment {draft.retestStatus === value ? 'hf-segment-active' : ''}"
                    on:click={() => setRetest(value)}
                    >{label}</button
                  >
                {/each}
              </div>
            </div>
          {/if}
          <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span class="text-zinc-300">Bounty</span>
            <span class="flex items-center gap-2">
              <span class="font-semibold tabular-nums text-zinc-100">{draft.bountyAmount ? formatMoney(draft.bountyAmount, 'USD', 2) : '—'}</span>
              <a class="hf-button-tinted h-7 min-h-0 px-2.5 text-xs" href={`/payouts?new=1&submission=${draft.id}`}>
                <CircleDollarSign size={12} aria-hidden="true" /> Record Payout
              </a>
            </span>
          </div>
        </div>

        {#if linkedPayouts.length > 0}
          <section>
            <p class="mb-1.5 text-[0.8125rem] font-semibold text-zinc-100">Payouts</p>
            <ul class="hf-card-muted hf-list overflow-hidden">
              {#each linkedPayouts as payout (payout.id)}
                <li class="flex items-center justify-between px-3.5 py-2.5 text-[0.8125rem]">
                  <span class="text-zinc-200">{formatDate(payout.date)} · {payout.status}</span>
                  <span class="font-semibold tabular-nums text-zinc-100">{formatMoney(payout.amount, 'USD', 2)}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <section>
          <p class="mb-1.5 text-[0.8125rem] font-semibold text-zinc-100">Timeline</p>
          <ol class="relative ml-2 space-y-3 border-l-[1.5px] border-zinc-800 pl-4">
            {#each [...(draft.timeline ?? [])].reverse() as entry (entry.id)}
              <li class="relative">
                <span class="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full {isClosed && entry === draft.timeline[draft.timeline.length - 1] ? 'bg-zinc-500' : 'bg-primary'}"></span>
                <p class="text-[0.8125rem] font-medium text-zinc-100">{STATUS_LABELS[entry.status]}</p>
                <p class="text-xs text-zinc-500">{new Date(entry.at).toLocaleString()}{entry.note ? ` · ${entry.note}` : ''}</p>
              </li>
            {:else}
              <li class="text-xs text-zinc-500">No status changes yet.</li>
            {/each}
          </ol>
        </section>

        <section>
          <label for="finding-notes" class="block text-[0.8125rem] font-semibold text-zinc-100">Private notes</label>
          <p class="mb-1.5 text-xs text-zinc-500">Triage conversations, follow-ups, payout negotiations. Never exported.</p>
          <AutoTextarea
            id="finding-notes"
            minRows={3}
            value={draft.notes ?? ''}
            on:input={onNotesInput}
          />
        </section>

        <p class="text-xs text-zinc-500">
          Severity <SeverityBadge severity={draft.severity} /> · updated {formatRelativeDate(draft.updatedAt)}
        </p>
      </div>
    {/if}
  </div>
</div>

<TemplatePicker
  open={templatesOpen}
  initialQuery={draft.vulnerabilityType ?? ''}
  on:pick={pickTemplate}
  on:close={() => (templatesOpen = false)}
/>

