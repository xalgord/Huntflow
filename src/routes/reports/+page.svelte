<script lang="ts">
  import CopyButton from '$lib/components/workspace/CopyButton.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { noteStore, submissionStore, targetStore } from '$lib/stores';
  import type { Platform, PayoutSeverity, Submission, SubmissionStatus } from '$lib/types';
  import {
    formatDate,
    formatRelativeDate,
    platformLabels,
    severityLabels,
    statusTone,
    submissionStatusLabels
  } from '$lib/utils/workspace';
  import { CheckCircle2, FileText, Plus, Search, Send } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type ReportTemplateId =
    | 'xss'
    | 'idor'
    | 'sqli'
    | 'ssrf'
    | 'ato'
    | 'auth-bypass'
    | 'access-control'
    | 'file-upload'
    | 'business-logic'
    | 'generic';

  const templateOptions: { id: ReportTemplateId; label: string; vuln: string; severity: PayoutSeverity; body: string }[] = [
    {
      id: 'xss',
      label: 'XSS',
      vuln: 'Cross-site scripting',
      severity: 'medium',
      body: `# Summary\nA cross-site scripting issue was identified in an authorized in-scope surface.\n\n# Steps to reproduce\n1. Authenticate as the test account.\n2. Navigate to the affected feature.\n3. Submit the benign proof value documented in the evidence.\n4. Observe script execution in the expected browser context.\n\n# Impact\nDescribe the affected user role, data exposure, session risk, or account action impact.\n\n# Evidence\nAttach screenshots, request/response snippets, and affected URL.\n\n# Suggested fix\nEncode output for the rendering context and validate/sanitize untrusted input.\n\n# Additional notes\nTesting was performed only within the authorized program scope.`
    },
    {
      id: 'idor',
      label: 'IDOR',
      vuln: 'Insecure direct object reference',
      severity: 'high',
      body: `# Summary\nAn access-control issue allows one authorized test account to access or modify another scoped account's resource.\n\n# Steps to reproduce\n1. Create or use two authorized test accounts.\n2. Capture the in-scope request for account A.\n3. Replace only the documented object identifier with account B's identifier.\n4. Observe the unauthorized read or write described below.\n\n# Impact\nExplain the cross-account data or action impact.\n\n# Evidence\nInclude affected endpoint, redacted identifiers, and request/response proof.\n\n# Suggested fix\nEnforce object-level authorization on the server for every request.\n\n# Additional notes\nNo third-party systems were tested outside authorized scope.`
    },
    {
      id: 'sqli',
      label: 'SQL Injection',
      vuln: 'SQL injection',
      severity: 'critical',
      body: `# Summary\nA SQL injection risk was identified in an authorized in-scope endpoint.\n\n# Steps to reproduce\n1. Use the authorized test account and in-scope endpoint.\n2. Send the documented benign validation payload.\n3. Observe the database error, boolean difference, or timing behavior recorded in evidence.\n\n# Impact\nDescribe confirmed data exposure or query manipulation risk without overclaiming.\n\n# Evidence\nAttach sanitized request/response pairs and timing notes.\n\n# Suggested fix\nUse parameterized queries and central input handling for the affected path.\n\n# Additional notes\nTesting stopped at safe validation and did not extract unauthorized data.`
    },
    {
      id: 'ssrf',
      label: 'SSRF',
      vuln: 'Server-side request forgery',
      severity: 'high',
      body: `# Summary\nAn in-scope feature can be induced to make server-side network requests.\n\n# Steps to reproduce\n1. Use the authorized test feature that accepts a URL or remote resource.\n2. Provide the controlled callback URL documented in evidence.\n3. Observe the server-side request metadata in the controlled listener.\n\n# Impact\nDescribe reachable internal services or metadata risk only if confirmed safely.\n\n# Evidence\nInclude callback logs, request metadata, and affected parameter.\n\n# Suggested fix\nRestrict outbound destinations, block private address ranges, and validate redirects.\n\n# Additional notes\nOnly controlled infrastructure and authorized scope were used.`
    },
    {
      id: 'ato',
      label: 'Account Takeover',
      vuln: 'Account takeover',
      severity: 'critical',
      body: `# Summary\nA weakness in the authorized account flow can compromise a scoped test account.\n\n# Steps to reproduce\n1. Use the program-approved test accounts.\n2. Follow the account flow described below.\n3. Observe the unauthorized account state change or session access.\n\n# Impact\nExplain the account-level impact, affected roles, and prerequisites.\n\n# Evidence\nAttach redacted requests, screenshots, and timeline.\n\n# Suggested fix\nHarden token validation, session binding, rate limits, and step-up checks as applicable.\n\n# Additional notes\nNo real user accounts were accessed.`
    },
    {
      id: 'auth-bypass',
      label: 'Authentication bypass',
      vuln: 'Authentication bypass',
      severity: 'critical',
      body: `# Summary\nAn authentication control can be bypassed on an in-scope surface.\n\n# Steps to reproduce\n1. Start from a logged-out or lower-privileged state.\n2. Perform the documented request sequence.\n3. Observe access to the protected function or data.\n\n# Impact\nDescribe what the bypass enables and which users or assets are affected.\n\n# Evidence\nInclude request sequence and screenshots.\n\n# Suggested fix\nEnforce authentication server-side before every protected action.\n\n# Additional notes\nTesting was limited to authorized accounts and assets.`
    },
    {
      id: 'access-control',
      label: 'Access control',
      vuln: 'Access control',
      severity: 'high',
      body: `# Summary\nA role or tenant boundary is not enforced consistently.\n\n# Steps to reproduce\n1. Use the authorized low-privilege role.\n2. Attempt the documented in-scope action.\n3. Observe the unauthorized access or state change.\n\n# Impact\nDescribe affected role, tenant, or resource boundaries.\n\n# Evidence\nAttach role setup, request/response proof, and screenshots.\n\n# Suggested fix\nCentralize authorization checks and verify role/tenant ownership server-side.\n\n# Additional notes\nOnly authorized test roles were used.`
    },
    {
      id: 'file-upload',
      label: 'File upload',
      vuln: 'Unsafe file upload',
      severity: 'high',
      body: `# Summary\nA file upload workflow accepts or serves unsafe content in an in-scope feature.\n\n# Steps to reproduce\n1. Upload the benign test file described in evidence.\n2. Observe validation, storage, or serving behavior.\n3. Confirm the resulting impact without executing unauthorized actions.\n\n# Impact\nDescribe content execution, storage abuse, or user-impact risk.\n\n# Evidence\nAttach upload request, response, and resulting file URL if safe to share.\n\n# Suggested fix\nValidate content type, scan files, isolate uploads, and serve with safe headers.\n\n# Additional notes\nNo malicious payloads were deployed.`
    },
    {
      id: 'business-logic',
      label: 'Business logic',
      vuln: 'Business logic flaw',
      severity: 'medium',
      body: `# Summary\nA business workflow can be manipulated in a way that violates intended rules.\n\n# Steps to reproduce\n1. Start with the authorized account state described below.\n2. Follow the documented workflow variation.\n3. Observe the incorrect state, price, quota, or permission outcome.\n\n# Impact\nExplain business impact and prerequisites.\n\n# Evidence\nInclude screenshots, state before/after, and request IDs if available.\n\n# Suggested fix\nValidate workflow invariants server-side and add state transition checks.\n\n# Additional notes\nTesting stayed within authorized program rules.`
    },
    {
      id: 'generic',
      label: 'Generic vulnerability report',
      vuln: 'Generic vulnerability',
      severity: 'medium',
      body: `# Summary\nDescribe the vulnerability in one or two clear sentences.\n\n# Steps to reproduce\n1. \n2. \n3. \n\n# Impact\nExplain the practical security impact and affected users or assets.\n\n# Evidence\nAdd screenshots, affected URL, request/response snippets, and evidence links.\n\n# Suggested fix\nDescribe a practical remediation path.\n\n# Additional notes\nUse HuntFlow to organize authorized security research and bug bounty work. It does not grant permission to test third-party systems.`
    }
  ];

  let loaded = false;
  let query = '';
  let selectedId = '';
  let selectedTemplate: ReportTemplateId = 'generic';
  let editing = false;
  let title = '';
  let targetId = '';
  let linkedFindingId = '';
  let platform: Platform = 'hackerone';
  let severity: PayoutSeverity = 'medium';
  let status: SubmissionStatus = 'draft';
  let reportUrl = '';
  let reportBody = '';
  let error = '';

  onMount(async () => {
    await Promise.all([submissionStore.load(), targetStore.load(), noteStore.load()]);
    const params = new URLSearchParams(location.search);
    selectedId = params.get('id') ?? '';
    if (params.get('new') === '1') startNew(params.get('target') ?? undefined);
    loaded = true;
  });

  function programName(id: string): string {
    return $targetStore.find((target) => target.id === id)?.name ?? 'Missing program';
  }

  function seedForm(report: Submission): void {
    title = report.title;
    targetId = report.targetId;
    linkedFindingId = report.id;
    platform = report.platform;
    severity = report.severity;
    status = report.status;
    reportUrl = report.reportUrl ?? '';
    reportBody = report.reportMarkdown ?? report.notes ?? '';
    editing = true;
  }

  function startNew(preferredTargetId?: string): void {
    const template = templateOptions.find((item) => item.id === selectedTemplate) ?? templateOptions[templateOptions.length - 1];
    const target = $targetStore.find((item) => item.id === preferredTargetId) ?? $targetStore[0];
    if (!target) {
      editing = true;
      return;
    }
    title = template.label === 'Generic vulnerability report' ? '' : `${template.vuln} in ${target.name}`;
    targetId = target.id;
    linkedFindingId = '';
    platform = target.platform;
    severity = template.severity;
    status = 'draft';
    reportUrl = '';
    reportBody = template.body;
    editing = true;
  }

  function applyTemplate(): void {
    const template = templateOptions.find((item) => item.id === selectedTemplate);
    if (!template) return;
    if (reportBody.trim() && !confirm('Replace the current report body with this template?')) return;
    reportBody = template.body;
    severity = template.severity;
    if (!title.trim() && targetId) title = `${template.vuln} in ${programName(targetId)}`;
  }

  async function saveReport(): Promise<void> {
    error = '';
    if (!title.trim()) {
      error = 'Report title is required.';
      return;
    }
    if (!targetId) {
      error = 'Choose a program.';
      return;
    }
    const now = Date.now();
    const existing = selectedId ? $submissionStore.find((item) => item.id === selectedId) : undefined;
    const timeline = [...(existing?.timeline ?? [])];
    if (timeline[timeline.length - 1]?.status !== status) {
      timeline.push({ id: crypto.randomUUID(), status, at: now });
    }
    const next: Submission = {
      id: existing?.id || linkedFindingId || crypto.randomUUID(),
      title: title.trim(),
      targetId,
      noteId: existing?.noteId,
      platform,
      vulnerabilityType: templateOptions.find((item) => item.id === selectedTemplate)?.vuln,
      severity,
      reportUrl: reportUrl.trim() || undefined,
      reportMarkdown: reportBody,
      status,
      submittedAt: status === 'draft' ? undefined : existing?.submittedAt ?? now,
      triagedAt: existing?.triagedAt,
      resolvedAt: existing?.resolvedAt,
      rewardedAt: existing?.rewardedAt,
      bountyAmount: existing?.bountyAmount,
      payoutIds: existing?.payoutIds ?? [],
      duplicateOf: existing?.duplicateOf,
      notes: existing?.notes,
      tags: existing?.tags ?? [],
      timeline,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await submissionStore.put(next);
    await submissionStore.persistNow();
    selectedId = next.id;
    editing = false;
  }

  $: reports = $submissionStore;
  $: draftReports = reports.filter((report) => report.status === 'draft');
  $: readyReports = reports.filter((report) => ['draft', 'submitted'].includes(report.status) && (report.reportMarkdown ?? '').trim().length > 0);
  $: submittedReports = reports.filter((report) => report.status !== 'draft');
  $: acceptedReports = reports.filter((report) => ['accepted', 'resolved', 'rewarded'].includes(report.status));
  $: filteredReports = reports
    .filter((report) => {
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [report.title, report.reportMarkdown ?? '', report.vulnerabilityType ?? '', programName(report.targetId)]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  $: selectedReport = selectedId ? $submissionStore.find((report) => report.id === selectedId) : filteredReports[0];
</script>

<svelte:head>
  <title>Reports | HuntFlow bug bounty command center</title>
  <meta name="description" content="Draft structured bug bounty reports with summary, steps to reproduce, impact, evidence, suggested fix, and notes." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Reports</p>
        <h1 class="hf-title">Report builder</h1>
        <p class="hf-description">
          Build clear bug bounty submissions from confirmed findings, notes, and evidence without leaving your local workspace.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={() => startNew()}>
        <Plus size={17} aria-hidden="true" />
        New Report
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={FileText} label="Reports" value={String(reports.length)} detail="Drafts and submissions" />
      <MetricCard icon={FileText} label="Draft" value={String(draftReports.length)} detail="Not submitted yet" />
      <MetricCard icon={Send} label="Ready/submitted" value={String(readyReports.length)} detail="Has report text" tone="warning" />
      <MetricCard icon={CheckCircle2} label="Accepted" value={String(acceptedReports.length)} detail="Accepted, resolved, or paid" tone="success" />
    </section>

    <section class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside class="space-y-4">
        <section class="hf-card p-4">
          <label class="block">
            <span class="hf-label">Search reports</span>
            <div class="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/20">
              <Search size={16} class="text-zinc-600" aria-hidden="true" />
              <input bind:value={query} class="min-h-[44px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" placeholder="Title, program, body" />
            </div>
          </label>
        </section>

        {#if filteredReports.length > 0}
          <section class="hf-card divide-y divide-zinc-900 overflow-hidden">
            {#each filteredReports as report}
              <button
                type="button"
                class="block w-full px-4 py-3 text-left transition hover:bg-zinc-950 {selectedReport?.id === report.id ? 'bg-zinc-950' : ''}"
                on:click={() => {
                  selectedId = report.id;
                  seedForm(report);
                }}
              >
                <div class="flex items-start justify-between gap-3">
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-medium text-zinc-100">{report.title}</span>
                    <span class="mt-1 block truncate text-xs text-zinc-500">{programName(report.targetId)} · {formatRelativeDate(report.updatedAt)}</span>
                  </span>
                  <SeverityBadge severity={report.severity} />
                </div>
              </button>
            {/each}
          </section>
        {:else if loaded}
          <EmptyState icon={FileText} title="No reports yet" description="Link a confirmed finding and generate a structured draft." actionLabel="New Report" href="/reports?new=1" />
        {/if}
      </aside>

      <section class="hf-card p-5">
        {#if editing}
          <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-zinc-100">Structured draft</h2>
              <p class="mt-1 text-sm text-zinc-500">Use placeholders for authorized testing evidence and replace them with your confirmed details.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <CopyButton value={reportBody} label="Copy body" />
              <button type="button" class="hf-button-primary" on:click={saveReport}>Save Report</button>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3">
            <label class="block lg:col-span-2">
              <span class="hf-label">Title</span>
              <input bind:value={title} class="hf-input mt-2" placeholder="IDOR allows cross-account invoice access" />
            </label>
            <label class="block">
              <span class="hf-label">Template</span>
              <div class="mt-2 flex gap-2">
                <select bind:value={selectedTemplate} class="hf-select">
                  {#each templateOptions as option}
                    <option value={option.id}>{option.label}</option>
                  {/each}
                </select>
                <button type="button" class="hf-button-secondary" on:click={applyTemplate}>Apply</button>
              </div>
            </label>
          </div>

          <div class="mt-4 grid gap-4 md:grid-cols-4">
            <label class="block">
              <span class="hf-label">Program</span>
              <select bind:value={targetId} class="hf-select mt-2">
                {#each $targetStore as program}
                  <option value={program.id}>{program.name}</option>
                {/each}
              </select>
            </label>
            <label class="block">
              <span class="hf-label">Platform</span>
              <select bind:value={platform} class="hf-select mt-2">
                <option value="hackerone">HackerOne</option>
                <option value="bugcrowd">Bugcrowd</option>
                <option value="intigriti">Intigriti</option>
                <option value="yeswehack">YesWeHack</option>
                <option value="self-hosted">Private</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label class="block">
              <span class="hf-label">Severity</span>
              <select bind:value={severity} class="hf-select mt-2">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="informational">Info</option>
              </select>
            </label>
            <label class="block">
              <span class="hf-label">Status</span>
              <select bind:value={status} class="hf-select mt-2">
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="duplicate">Duplicate</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>

          <label class="mt-4 block">
            <span class="hf-label">Submitted URL</span>
            <input bind:value={reportUrl} class="hf-input mt-2 font-mono text-sm" placeholder="https://hackerone.com/reports/..." />
          </label>

          <label class="mt-4 block">
            <span class="hf-label">Report body</span>
            <textarea bind:value={reportBody} class="hf-input mt-2 min-h-[520px] font-mono text-xs leading-6" />
          </label>

          {#if error}
            <p class="mt-3 text-sm text-red-300" role="alert">{error}</p>
          {/if}
        {:else if selectedReport}
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="hf-eyebrow">Report detail</p>
              <h2 class="mt-2 text-2xl font-semibold text-zinc-50">{selectedReport.title}</h2>
              <p class="mt-2 text-sm text-zinc-500">{programName(selectedReport.targetId)} · {platformLabels[selectedReport.platform]}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <SeverityBadge severity={selectedReport.severity} />
              <StatusBadge label={submissionStatusLabels[selectedReport.status]} tone={statusTone(selectedReport.status)} />
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <button type="button" class="hf-button-secondary" on:click={() => seedForm(selectedReport)}>Edit draft</button>
            <CopyButton value={selectedReport.reportMarkdown ?? selectedReport.notes ?? ''} label="Copy report" />
          </div>

          <div class="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-300">{selectedReport.reportMarkdown ?? 'No report body saved yet.'}</pre>
          </div>

          <div class="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p class="hf-label">Submitted</p>
              <p class="mt-2 text-sm text-zinc-300">{formatDate(selectedReport.submittedAt)}</p>
            </div>
            <div>
              <p class="hf-label">Platform</p>
              <p class="mt-2 text-sm text-zinc-300">{platformLabels[selectedReport.platform]}</p>
            </div>
            <div>
              <p class="hf-label">Severity</p>
              <p class="mt-2 text-sm text-zinc-300">{severityLabels[selectedReport.severity]}</p>
            </div>
          </div>
        {:else if loaded}
          <EmptyState icon={FileText} title="No reports yet" description="Link a confirmed finding and generate a structured draft." actionLabel="New Report" href="/reports?new=1" />
        {/if}
      </section>
    </section>
  </div>
</main>
