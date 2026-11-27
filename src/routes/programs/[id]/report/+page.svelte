<script lang="ts">
  import { page } from '$app/stores';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import {
    evidenceAssetStore,
    getEvidenceBlob,
    reconAssetStore,
    sessionStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import type { EngagementReportSettings, PayoutSeverity, Target } from '$lib/types';
  import {
    SEVERITY_NAMES,
    SEVERITY_ORDER,
    buildEngagementReport,
    findingFacts,
    findingSections,
    formatPeriod,
    formatReportDate,
    generateExecutiveSummary,
    isoDay,
    renderEngagementMarkdown,
    truncateLines,
    type EngagementReport
  } from '$lib/utils/engagementReport';
  import { downloadMarkdownReport, renderMarkdownToHtml } from '$lib/utils/reports';
  import DOMPurify from 'dompurify';
  import { ArrowLeft, Download, FileText, Printer, RotateCcw } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  let loaded = false;

  onMount(async () => {
    await Promise.all([
      targetStore.load(),
      submissionStore.load(),
      reconAssetStore.load(),
      sessionStore.load(),
      evidenceAssetStore.load()
    ]);
    loaded = true;
  });

  $: programId = $page.params.id;
  $: program = $targetStore.find((candidate) => candidate.id === programId);

  // Editable settings start from what's saved on the program.
  let settings: EngagementReportSettings = {};
  let settingsFor = '';
  $: if (program && program.id !== settingsFor) {
    settingsFor = program.id;
    settings = { ...(program.report ?? {}) };
  }

  $: report = program
    ? buildEngagementReport(
        program,
        { findings: $submissionStore, assets: $reconAssetStore, sessions: $sessionStore, evidence: $evidenceAssetStore },
        settings
      )
    : null;
  $: generatedSummary = report ? generateExecutiveSummary({ ...report, executiveSummary: undefined } as Omit<EngagementReport, 'executiveSummary'>) : '';

  // Persist settings to the program (debounced) so the next export matches.
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function update(patch: EngagementReportSettings): void {
    settings = { ...settings, ...patch };
    clearTimeout(saveTimer);
    const target = program;
    saveTimer = setTimeout(() => {
      if (!target) return;
      const latest = $targetStore.find((candidate) => candidate.id === target.id) ?? target;
      void targetStore.put({ ...latest, report: { ...settings }, updatedAt: Date.now() } as Target);
    }, 400);
  }
  onDestroy(() => {
    clearTimeout(saveTimer);
    for (const url of Object.values(imageUrls)) URL.revokeObjectURL(url);
  });

  const value = (event: Event) => (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;

  // Screenshots attached as evidence print inline.
  let imageUrls: Record<string, string> = {};
  $: void loadImages(report);
  async function loadImages(current: EngagementReport | null): Promise<void> {
    if (!current) return;
    const wanted = current.findings.flatMap((item) => item.evidence).filter((asset) => asset.kind === 'image' && !imageUrls[asset.id]);
    if (!wanted.length) return;
    const next = { ...imageUrls };
    for (const asset of wanted) {
      const record = await getEvidenceBlob(asset.id).catch(() => undefined);
      if (record?.blob) next[asset.id] = URL.createObjectURL(record.blob);
    }
    imageUrls = next;
  }

  const md = (text: string) => DOMPurify.sanitize(renderMarkdownToHtml(text), { USE_PROFILES: { html: true } });

  const severityColor: Record<PayoutSeverity, string> = {
    critical: '#B4232A',
    high: '#C2410C',
    medium: '#A16207',
    low: '#1D4ED8',
    informational: '#52525B'
  };

  function exportPdf(): void {
    window.print();
  }

  function downloadMarkdown(): void {
    if (report) downloadMarkdownReport(renderEngagementMarkdown(report), report.settings.title);
  }

  const hours = (seconds: number) => (seconds >= 3600 ? `${Math.round(seconds / 360) / 10} h` : `${Math.round(seconds / 60)} min`);
</script>

<svelte:head>
  <title>{report?.settings.title ?? 'Report'} | HuntFlow</title>
</svelte:head>

<main class="hf-page" data-print="flat">
  <div class="hf-page-inner" data-print="flat">
    {#if program && report}
      <header class="flex flex-wrap items-center justify-between gap-3" data-print="hide">
        <div class="min-w-0">
          <a href={`/programs/${program.id}#findings`} class="hf-button-ghost -ml-3 w-fit">
            <ArrowLeft size={16} aria-hidden="true" />
            {program.name}
          </a>
          <h1 class="hf-title mt-1">Engagement Report</h1>
        </div>
        <div class="flex gap-2">
          <button type="button" class="hf-button-secondary" on:click={downloadMarkdown}>
            <Download size={16} aria-hidden="true" />
            Markdown
          </button>
          <button type="button" class="hf-button-primary" on:click={exportPdf}>
            <Printer size={16} aria-hidden="true" />
            Export PDF
          </button>
        </div>
      </header>

      <div class="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]" data-print="flat">
        <aside class="space-y-4 xl:sticky xl:top-[4.5rem] xl:self-start" data-print="hide" aria-label="Report settings">
          <section class="hf-card space-y-3 p-4">
            <label class="block">
              <span class="hf-label">Title</span>
              <input class="hf-input mt-1.5" value={settings.title ?? ''} placeholder={report.settings.title} on:input={(event) => update({ title: value(event) })} />
            </label>
            <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-1">
              <label class="block">
                <span class="hf-label">Prepared for</span>
                <input class="hf-input mt-1.5" value={settings.preparedFor ?? ''} placeholder={program.name} on:input={(event) => update({ preparedFor: value(event) })} />
              </label>
              <label class="block">
                <span class="hf-label">Prepared by</span>
                <input class="hf-input mt-1.5" value={settings.preparedBy ?? ''} placeholder="Your name or company" on:input={(event) => update({ preparedBy: value(event) })} />
              </label>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <label class="block">
                <span class="hf-label">Testing from</span>
                <input type="date" class="hf-input mt-1.5" value={settings.periodStart ?? report.period.start ?? ''} on:change={(event) => update({ periodStart: value(event) })} />
              </label>
              <label class="block">
                <span class="hf-label">To</span>
                <input type="date" class="hf-input mt-1.5" value={settings.periodEnd ?? report.period.end ?? ''} on:change={(event) => update({ periodEnd: value(event) })} />
              </label>
            </div>
            <label class="block">
              <span class="hf-label">Classification</span>
              <input class="hf-input mt-1.5" value={settings.classification ?? 'Confidential'} on:input={(event) => update({ classification: value(event) })} />
            </label>
          </section>

          <section class="hf-card hf-list overflow-hidden p-1">
            <Toggle checked={report.settings.includeDrafts !== false} label="Include drafts" description="Leads and unsent write-ups." on:change={(event) => update({ includeDrafts: event.detail })} />
            <Toggle checked={Boolean(report.settings.includeClosed)} label="Include closed" description="Duplicates, informative and not applicable." on:change={(event) => update({ includeClosed: event.detail })} />
            <Toggle checked={report.settings.includeEvidence !== false} label="Include evidence" description="Screenshots and HTTP requests." on:change={(event) => update({ includeEvidence: event.detail })} />
            <Toggle checked={report.settings.findingPerPage !== false} label="Each finding on a new page" on:change={(event) => update({ findingPerPage: event.detail })} />
          </section>

          <section class="hf-card p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="hf-label">Executive summary</span>
              {#if settings.executiveSummary}
                <button type="button" class="hf-button-ghost h-7 min-h-0 px-2 text-xs" on:click={() => update({ executiveSummary: '' })}>
                  <RotateCcw size={12} aria-hidden="true" />
                  Use generated
                </button>
              {/if}
            </div>
            <textarea
              class="hf-input mt-1.5 min-h-[180px] text-[0.8125rem] leading-5"
              value={settings.executiveSummary || generatedSummary}
              aria-label="Executive summary"
              on:input={(event) => update({ executiveSummary: value(event) })}
            />
            <p class="mt-1.5 text-xs text-zinc-500">Written from your findings. Edit it freely; it updates as findings change until you do.</p>
          </section>
        </aside>

        <!-- The paper is always light: it's what the client receives. -->
        <article class="hf-report-paper" aria-label="Report preview">
          <section class="hf-report-cover">
            <p class="hf-report-eyebrow">Security Assessment Report</p>
            <h1 class="hf-report-title">{report.settings.title}</h1>
            <dl class="hf-report-meta">
              <div><dt>Prepared for</dt><dd>{report.settings.preparedFor}</dd></div>
              {#if report.settings.preparedBy}<div><dt>Prepared by</dt><dd>{report.settings.preparedBy}</dd></div>{/if}
              {#if formatPeriod(report.period)}<div><dt>Testing period</dt><dd>{formatPeriod(report.period)}</dd></div>{/if}
              <div><dt>Report date</dt><dd>{formatReportDate(isoDay(report.generatedAt))}</dd></div>
            </dl>
            {#if report.settings.classification}
              <p class="hf-report-classification">{report.settings.classification}</p>
            {/if}
          </section>

          <section class="hf-report-section hf-report-break">
            <h2>Executive Summary</h2>
            {#each report.executiveSummary.split(/\n{2,}/) as paragraph}
              <p>{paragraph}</p>
            {/each}
            <div class="hf-report-tiles" role="list" aria-label="Findings by severity">
              {#each SEVERITY_ORDER as severity}
                <div class="hf-report-tile" role="listitem" style="--tile: {severityColor[severity]}">
                  <span class="hf-report-tile-count">{report.counts[severity]}</span>
                  <span class="hf-report-tile-label">{SEVERITY_NAMES[severity]}</span>
                </div>
              {/each}
            </div>
            <p class="hf-report-risk">
              Overall risk:
              {#if report.overallRisk}
                <strong style="color: {severityColor[report.overallRisk]}">{SEVERITY_NAMES[report.overallRisk]}</strong>
              {:else}
                <strong>None open</strong>
              {/if}
              {#if report.time.sessions}
                <span class="hf-report-muted"> · {hours(report.time.seconds)} of testing across {report.time.sessions} session{report.time.sessions === 1 ? '' : 's'}</span>
              {/if}
            </p>
          </section>

          {#if report.scope.include.length || report.scope.exclude.length}
            <section class="hf-report-section">
              <h2>Scope</h2>
              <div class="hf-report-scope">
                {#if report.scope.include.length}
                  <div>
                    <h3>In scope</h3>
                    <ul>{#each report.scope.include as rule}<li><code>{rule}</code></li>{/each}</ul>
                  </div>
                {/if}
                {#if report.scope.exclude.length}
                  <div>
                    <h3>Out of scope</h3>
                    <ul>{#each report.scope.exclude as rule}<li><code>{rule}</code></li>{/each}</ul>
                  </div>
                {/if}
              </div>
            </section>
          {/if}

          {#if report.findings.length}
            <section class="hf-report-section">
              <h2>Findings Overview</h2>
              <div class="hf-report-scroll">
              <table class="hf-report-table">
                <thead><tr><th>Ref</th><th>Finding</th><th>Severity</th><th>CVSS</th><th>Status</th></tr></thead>
                <tbody>
                  {#each report.findings as item}
                    <tr>
                      <td class="hf-report-mono">{item.ref}</td>
                      <td><a href={`#${item.ref}`}>{item.finding.title}</a></td>
                      <td><span class="hf-report-chip" style="--chip: {severityColor[item.finding.severity]}">{SEVERITY_NAMES[item.finding.severity]}</span></td>
                      <td class="hf-report-mono">{(item.finding.cvssScore ?? item.finding.cvss4Score)?.toFixed(1) ?? '—'}</td>
                      <td>{item.status}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              </div>
            </section>

            {#each report.findings as item, index}
              <section id={item.ref} class="hf-report-section hf-report-finding {report.settings.findingPerPage !== false || index === 0 ? 'hf-report-break' : ''}">
                {#if index === 0}<h2>Detailed Findings</h2>{/if}
                <h3 class="hf-report-finding-title">
                  <span class="hf-report-mono hf-report-muted">{item.ref}</span>
                  {item.finding.title}
                </h3>
                <table class="hf-report-facts">
                  {#each findingFacts(item) as [label, text]}
                    <tr>
                      <th>{label}</th>
                      <td>
                        {#if label === 'Severity'}
                          <span class="hf-report-chip" style="--chip: {severityColor[item.finding.severity]}">{text}</span>
                        {:else}
                          <span class={label === 'CVSS' || label === 'Affected' ? 'hf-report-mono' : ''} style="white-space: pre-line">{text}</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </table>
                {#each findingSections(item.finding) as [heading, body]}
                  <h4>{heading}</h4>
                  <div class="hf-report-prose">{@html md(body)}</div>
                {/each}
                {#if item.evidence.length}
                  <h4>Evidence</h4>
                  {#each item.evidence as asset}
                    <figure class="hf-report-evidence">
                      {#if asset.kind === 'image' && imageUrls[asset.id]}
                        <img src={imageUrls[asset.id]} alt={asset.title} />
                      {:else if asset.httpExchange?.requestRaw}
                        <pre>{truncateLines([asset.httpExchange.requestRaw, asset.httpExchange.responseRaw].filter(Boolean).join('\n\n'), 60)}</pre>
                      {:else if asset.textContent}
                        <pre>{truncateLines(asset.textContent, 60)}</pre>
                      {:else if asset.url}
                        <p><a href={asset.url}>{asset.url}</a></p>
                      {/if}
                      <figcaption>{asset.title}</figcaption>
                    </figure>
                  {/each}
                {/if}
              </section>
            {/each}
          {:else}
            <section class="hf-report-section">
              <h2>Findings</h2>
              <p>No findings match the report settings.</p>
            </section>
          {/if}

          {#if report.testedAssets.length}
            <section class="hf-report-section {report.settings.findingPerPage !== false && report.findings.length ? 'hf-report-break' : ''}">
              <h2>Appendix: Tested Assets</h2>
              <ul class="hf-report-assets">
                {#each report.testedAssets as asset}<li class="hf-report-mono">{asset.url ?? asset.hostname}</li>{/each}
              </ul>
            </section>
          {/if}

          <p class="hf-report-footer">Generated with HuntFlow · {report.settings.classification}</p>
        </article>
      </div>
    {:else if loaded}
      <EmptyState icon={FileText} title="Program not found" description="This program may have been deleted." actionLabel="Back to Programs" href="/programs" />
    {/if}
  </div>
</main>

<style>
  .hf-report-paper {
    --ink: #1d1d1f;
    --ink-2: #515154;
    --ink-3: #86868b;
    --rule: #d2d2d7;
    --fill: #f5f5f7;
    color-scheme: light;
    background: #fff;
    color: var(--ink);
    border-radius: 14px;
    box-shadow: var(--hf-shadow-lg);
    padding: 56px 64px;
    font-size: 13.5px;
    line-height: 1.6;
    min-width: 0;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
  }
  @media (max-width: 640px) {
    .hf-report-paper {
      padding: 28px 22px;
      border-radius: 12px;
    }
  }
  .hf-report-paper :global(a) {
    color: #0066cc;
    text-decoration: none;
  }
  .hf-report-cover {
    min-height: 420px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
  }
  .hf-report-eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  .hf-report-title {
    font-size: 40px;
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .hf-report-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 28px;
    margin-top: 18px;
    padding-top: 22px;
    border-top: 1px solid var(--rule);
  }
  .hf-report-meta dt {
    font-size: 11px;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .hf-report-meta dd {
    margin: 2px 0 0;
    font-size: 15px;
    font-weight: 500;
  }
  .hf-report-classification {
    align-self: flex-start;
    margin-top: 12px;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 3px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .hf-report-section {
    margin-top: 40px;
  }
  .hf-report-section h2 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 14px;
  }
  .hf-report-section h3 {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 6px;
  }
  .hf-report-section h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 22px 0 6px;
  }
  .hf-report-section p {
    margin: 0 0 10px;
  }
  .hf-report-tiles {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin: 20px 0 14px;
  }
  .hf-report-tile {
    border-radius: 10px;
    padding: 12px 12px 10px;
    background: color-mix(in srgb, var(--tile) 9%, white);
    color: var(--tile);
  }
  .hf-report-tile-count {
    display: block;
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
  }
  .hf-report-tile-label {
    display: block;
    margin-top: 6px;
    font-size: 11.5px;
    font-weight: 600;
  }
  .hf-report-risk {
    font-size: 13px;
  }
  .hf-report-muted {
    color: var(--ink-3);
  }
  .hf-report-mono,
  .hf-report-paper code,
  .hf-report-paper pre {
    font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
  .hf-report-scope {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }
  .hf-report-scope ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .hf-report-scope li {
    padding: 3px 0;
    word-break: break-all;
  }
  .hf-report-table,
  .hf-report-facts {
    width: 100%;
    border-collapse: collapse;
  }
  .hf-report-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 8px;
    border-bottom: 1px solid var(--rule);
  }
  .hf-report-scroll {
    overflow-x: auto;
  }
  .hf-report-table td {
    overflow-wrap: anywhere;
    padding: 9px 8px;
    border-bottom: 1px solid #ececf0;
    vertical-align: top;
  }
  .hf-report-table tr,
  .hf-report-facts tr,
  .hf-report-evidence {
    break-inside: avoid;
  }
  .hf-report-table a {
    color: inherit !important;
  }
  .hf-report-chip {
    display: inline-block;
    border-radius: 999px;
    padding: 1px 9px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--chip);
    background: color-mix(in srgb, var(--chip) 11%, white);
    white-space: nowrap;
  }
  .hf-report-finding-title {
    font-size: 19px !important;
    font-weight: 700 !important;
    letter-spacing: -0.01em;
    margin: 0 0 14px !important;
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .hf-report-facts {
    background: var(--fill);
    border-radius: 10px;
    overflow: hidden;
  }
  .hf-report-facts th {
    width: 110px;
    text-align: left;
    vertical-align: top;
    font-weight: 500;
    color: var(--ink-2);
    padding: 8px 12px;
  }
  .hf-report-facts td {
    padding: 8px 12px;
    word-break: break-word;
  }
  .hf-report-facts tr + tr th,
  .hf-report-facts tr + tr td {
    border-top: 1px solid #e5e5ea;
  }
  .hf-report-prose :global(p) {
    margin: 0 0 8px;
  }
  .hf-report-prose :global(ul),
  .hf-report-prose :global(ol) {
    margin: 0 0 8px;
    padding-left: 22px;
  }
  .hf-report-prose :global(ul) {
    list-style: disc;
  }
  .hf-report-prose :global(ol) {
    list-style: decimal;
  }
  .hf-report-prose :global(code) {
    background: var(--fill);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .hf-report-paper pre,
  .hf-report-prose :global(pre) {
    background: var(--fill);
    border-radius: 8px;
    padding: 12px 14px;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0 0 8px;
    line-height: 1.5;
    font-size: 11px;
  }
  .hf-report-evidence {
    margin: 0 0 14px;
  }
  .hf-report-evidence img {
    max-width: 100%;
    border-radius: 8px;
    border: 1px solid var(--rule);
  }
  .hf-report-evidence figcaption {
    font-size: 11.5px;
    color: var(--ink-3);
    margin-top: 4px;
  }
  .hf-report-assets {
    columns: 2;
    column-gap: 28px;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .hf-report-assets li {
    padding: 2px 0;
    break-inside: avoid;
    word-break: break-all;
  }
  .hf-report-footer {
    margin-top: 48px;
    padding-top: 14px;
    border-top: 1px solid var(--rule);
    font-size: 11px;
    color: var(--ink-3);
  }

  @media print {
    .hf-report-paper {
      box-shadow: none;
      border-radius: 0;
      padding: 0;
      max-width: none;
      font-size: 10.5pt;
    }
    .hf-report-cover {
      min-height: 240mm;
    }
    .hf-report-break {
      break-before: page;
      margin-top: 0;
    }
    .hf-report-section h2,
    .hf-report-section h3,
    .hf-report-section h4 {
      break-after: avoid;
    }
  }
</style>
