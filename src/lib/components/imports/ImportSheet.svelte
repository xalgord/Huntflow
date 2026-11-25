<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { evidenceAssetStore, reconAssetStore, submissionStore, targetStore } from '$lib/stores';
  import type { Target } from '$lib/types';
  import {
    IMPORT_KIND_LABELS,
    detectImportKind,
    parseImport,
    type ImportKind,
    type ImportResult
  } from '$lib/utils/importers';
  import { describePlan, planImport, type ImportPlan } from '$lib/utils/importPlan';
  import { AlertTriangle, CheckCircle2, ChevronRight, FileUp, Loader2 } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  /** Program to import into; the user can change it unless `lockProgram`. */
  export let programId = '';
  export let lockProgram = false;

  const dispatch = createEventDispatcher<{ close: void; imported: { programId: string; summary: string; findings: number } }>();

  const KINDS = Object.keys(IMPORT_KIND_LABELS) as ImportKind[];
  const SCOPE_KINDS: ImportKind[] = ['h1-scope-csv', 'scope-text'];
  const MAX_BYTES = 25 * 1024 * 1024;

  let text = '';
  let fileName = '';
  let kindOverride: ImportKind | 'auto' = 'auto';
  let includeOutOfScope = false;
  let createFindings = true;
  let updateScope = true;
  let dragging = false;
  let busy = false;
  let error = '';
  let done: { summary: string; findings: number; programId: string } | null = null;
  let fileInput: HTMLInputElement;
  let wasOpen = false;

  // Fresh sheet every time it opens.
  $: if (open && !wasOpen) {
    wasOpen = true;
    text = '';
    fileName = '';
    kindOverride = 'auto';
    includeOutOfScope = false;
    createFindings = true;
    updateScope = true;
    error = '';
    done = null;
    if (!programId && $targetStore.length) programId = $targetStore[0].id;
  } else if (!open && wasOpen) {
    wasOpen = false;
  }

  $: program = $targetStore.find((candidate) => candidate.id === programId) as Target | undefined;

  // Parsing big scans on every keystroke would stall typing; debounce it.
  let parsed: ImportResult | null = null;
  let detected: ImportKind = 'hosts';
  let parseTimer: ReturnType<typeof setTimeout> | undefined;
  $: scheduleParse(text, kindOverride, fileName);
  function scheduleParse(input: string, override: ImportKind | 'auto', name: string): void {
    clearTimeout(parseTimer);
    if (!input.trim()) {
      parsed = null;
      return;
    }
    parseTimer = setTimeout(() => {
      detected = detectImportKind(input, name);
      parsed = parseImport(input, override === 'auto' ? detected : override);
    }, input.length > 200_000 ? 250 : 80);
  }

  $: kind = parsed?.kind ?? (kindOverride === 'auto' ? detected : kindOverride);
  $: isScopeImport = SCOPE_KINDS.includes(kind);
  $: plan =
    parsed && program
      ? planImport(parsed, program, $reconAssetStore, $submissionStore, { includeOutOfScope, createFindings, updateScope })
      : null;
  $: total = plan ? plan.newAssets.length + plan.updatedAssets.length + plan.findings.length + (plan.scopeText !== undefined ? 1 : 0) : 0;
  $: previewRows = plan ? buildPreview(plan) : [];
  $: canCreateFindings = Boolean(parsed?.findings.length);
  $: hasScopeRules = Boolean(program?.scope?.trim()) || Boolean(parsed && (parsed.scope.include.length || parsed.scope.exclude.length));

  interface PreviewRow {
    id: string;
    label: string;
    detail: string;
    badge: string;
    tone: 'new' | 'update' | 'out' | 'finding';
    mono: boolean;
  }

  function buildPreview(next: ImportPlan): PreviewRow[] {
    const rows: PreviewRow[] = [
      ...next.findings.map((finding) => ({
        id: finding.id,
        label: finding.title,
        detail: finding.affectedAssets?.[0] ?? '',
        badge: finding.severity === 'informational' ? 'Info' : finding.severity[0].toUpperCase() + finding.severity.slice(1),
        tone: 'finding' as const,
        mono: false
      })),
      ...next.newAssets.map((asset) => ({
        id: asset.id,
        label: asset.url ?? asset.hostname,
        detail: [asset.httpStatus, asset.title, asset.ports?.join(', '), asset.technologies.slice(0, 3).join(', ')].filter(Boolean).join(' · '),
        badge: asset.scopeStatus === 'out-of-scope' ? 'Out of scope' : 'New',
        tone: asset.scopeStatus === 'out-of-scope' ? ('out' as const) : ('new' as const),
        mono: true
      })),
      ...next.updatedAssets.map((asset) => ({
        id: asset.id,
        label: asset.url ?? asset.hostname,
        detail: [asset.httpStatus, asset.title, asset.technologies.slice(0, 3).join(', ')].filter(Boolean).join(' · '),
        badge: 'Update',
        tone: 'update' as const,
        mono: true
      }))
    ];
    return rows;
  }

  async function readFile(file: File): Promise<void> {
    error = '';
    if (file.size > MAX_BYTES) {
      error = `${file.name} is larger than 25 MB. Split the scan or filter it first.`;
      return;
    }
    fileName = file.name;
    text = await file.text();
  }

  function handleDrop(event: DragEvent): void {
    dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void readFile(file);
  }

  function handleFile(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void readFile(file);
    (event.currentTarget as HTMLInputElement).value = '';
  }

  async function commit(): Promise<void> {
    // Snapshot the plan: writing to the stores re-runs the reactive plan,
    // which would then (correctly) report that everything already exists.
    const committed = plan;
    const target = program;
    if (!committed || !target || total === 0) return;
    busy = true;
    error = '';
    try {
      const now = Date.now();
      if (committed.scopeText !== undefined) {
        await targetStore.put({ ...target, scope: committed.scopeText, updatedAt: now });
        await targetStore.persistNow();
      }
      const assets = [...committed.newAssets, ...committed.updatedAssets];
      if (assets.length) {
        await reconAssetStore.putBatch(assets);
        await reconAssetStore.persistNow();
      }
      if (committed.evidence.length) {
        await evidenceAssetStore.putBatch(committed.evidence);
        await evidenceAssetStore.persistNow();
      }
      if (committed.findings.length) {
        await submissionStore.putBatch(committed.findings);
        await submissionStore.persistNow();
      }
      done = { summary: describePlan(committed), findings: committed.findings.length, programId: target.id };
      dispatch('imported', { programId: target.id, summary: done.summary, findings: done.findings });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Import failed.';
    } finally {
      busy = false;
    }
  }

  function close(): void {
    dispatch('close');
  }

  function importMore(): void {
    done = null;
    text = '';
    fileName = '';
  }

  const toneClass: Record<PreviewRow['tone'], string> = {
    new: 'bg-green-500/[0.14] text-green-500 dark:text-green-400',
    update: 'bg-blue-500/[0.14] text-blue-600 dark:text-blue-400',
    out: 'bg-zinc-500/[0.16] text-zinc-400',
    finding: 'bg-orange-500/[0.14] text-orange-500 dark:text-orange-400'
  };
</script>

<Modal
  {open}
  title={done ? 'Import complete' : 'Import'}
  description={done ? '' : 'Paste or drop scope from HackerOne or Bugcrowd, or output from subfinder, httpx, nuclei, nmap and Burp.'}
  on:close={close}
>
  {#if done}
    <div class="flex flex-col items-center px-2 py-4 text-center" role="status">
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/[0.14] text-green-500">
        <CheckCircle2 size={26} aria-hidden="true" />
      </span>
      <p class="mt-3 text-[0.9375rem] font-semibold text-zinc-100">{done.summary[0].toUpperCase() + done.summary.slice(1)}.</p>
      <p class="mt-1 text-[0.8125rem] text-zinc-500">
        Added to {program?.name ?? 'the program'}.{done.findings ? ' Scanner results are drafts until you verify them.' : ''}
      </p>
      <div class="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" class="hf-button-secondary" on:click={importMore}>Import More</button>
        {#if done.findings}
          <a class="hf-button-secondary" href="/findings?target={done.programId}&bucket=drafts" on:click={close}>Review Drafts</a>
        {/if}
        <button type="button" class="hf-button-primary" on:click={close}>Done</button>
      </div>
    </div>
  {:else if $targetStore.length === 0}
    <div class="py-4 text-center">
      <p class="text-[0.8125rem] text-zinc-400">Create a program first, then import its scope and recon into it.</p>
      <a class="hf-button-primary mt-4" href="/programs?new=1" on:click={close}>New Program</a>
    </div>
  {:else}
    <form class="space-y-4" on:submit|preventDefault={commit}>
      {#if !lockProgram}
        <label class="block">
          <span class="hf-label">Program</span>
          <select bind:value={programId} class="hf-select mt-2" aria-label="Import into program">
            {#each $targetStore as option (option.id)}
              <option value={option.id}>{option.name}</option>
            {/each}
          </select>
        </label>
      {/if}

      <div
        class="relative rounded-[12px] transition {dragging ? 'ring-2 ring-primary' : ''}"
        style="background: var(--hf-fill)"
        role="group"
        aria-label="Import data"
        on:dragenter|preventDefault={() => (dragging = true)}
        on:dragover|preventDefault={() => (dragging = true)}
        on:dragleave|preventDefault={() => (dragging = false)}
        on:drop|preventDefault={handleDrop}
      >
        <textarea
          bind:value={text}
          on:input={() => (fileName = '')}
          class="block h-36 w-full resize-none rounded-t-[12px] bg-transparent px-3.5 py-3 font-mono text-xs leading-5 text-zinc-100 placeholder:font-sans placeholder:text-[0.8125rem] placeholder:text-zinc-500 focus:outline-none"
          placeholder="Paste here, or drop a file…"
          aria-label="Scope or tool output"
          spellcheck="false"
        />
        <div class="flex items-center justify-between gap-3 border-t px-2.5 py-2" style="border-color: var(--hf-hairline)">
          <button type="button" class="hf-button-ghost h-8 min-h-0 px-2 text-xs" on:click={() => fileInput.click()}>
            <FileUp size={14} aria-hidden="true" />
            {fileName || 'Choose File…'}
          </button>
          <input
            bind:this={fileInput}
            type="file"
            class="hidden"
            accept=".txt,.json,.jsonl,.csv,.xml,.log,text/*,application/json,application/xml"
            on:change={handleFile}
            data-testid="import-file"
          />
          <label class="flex items-center gap-1.5 text-xs text-zinc-500">
            <span class="hidden sm:inline">Format</span>
            <select bind:value={kindOverride} class="hf-select h-8 min-h-0 w-auto py-0 pl-2 pr-7 text-xs" aria-label="Format">
              <option value="auto">{text.trim() ? `Auto · ${IMPORT_KIND_LABELS[detected]}` : 'Automatic'}</option>
              {#each KINDS as option}
                <option value={option}>{IMPORT_KIND_LABELS[option]}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>

      {#if !text.trim()}
        <details class="group rounded-[12px] px-3.5 py-2.5 text-xs text-zinc-500" style="background: var(--hf-fill)">
          <summary class="flex cursor-pointer list-none items-center justify-between font-medium text-zinc-300">
            What can I import?
            <ChevronRight size={14} class="transition group-open:rotate-90" aria-hidden="true" />
          </summary>
          <dl class="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
            <dt class="font-medium text-zinc-400">HackerOne</dt>
            <dd>Scope tab → <span class="font-medium">Download CSV</span></dd>
            <dt class="font-medium text-zinc-400">Bugcrowd, Intigriti</dt>
            <dd>Copy the in-scope and out-of-scope tables</dd>
            <dt class="font-medium text-zinc-400">subfinder, amass</dt>
            <dd><code>subfinder -d acme.com -oJ</code> or a plain host list</dd>
            <dt class="font-medium text-zinc-400">httpx</dt>
            <dd><code>httpx -json</code> or default output</dd>
            <dt class="font-medium text-zinc-400">nuclei</dt>
            <dd><code>nuclei -jsonl</code> → draft findings with evidence</dd>
            <dt class="font-medium text-zinc-400">nmap</dt>
            <dd><code>nmap -sV -oX scan.xml</code></dd>
            <dt class="font-medium text-zinc-400">Burp Suite</dt>
            <dd>Issues → Report selected issues → XML</dd>
          </dl>
        </details>
      {/if}

      {#if parsed && plan}
        {#if parsed.warnings.length}
          <div class="flex items-start gap-2 rounded-[10px] bg-orange-500/[0.12] p-3 text-[0.8125rem] text-orange-500 dark:text-orange-400" role="status">
            <AlertTriangle size={15} class="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{parsed.warnings.join(' ')} Try choosing the format manually.</span>
          </div>
        {/if}

        <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Import summary">
          {#each [{ label: 'New targets', value: plan.newAssets.length }, { label: 'Updated', value: plan.updatedAssets.length }, { label: 'Draft findings', value: plan.findings.length }, { label: isScopeImport ? 'Scope rules' : 'Out of scope', value: isScopeImport ? parsed.scope.include.length + parsed.scope.exclude.length : plan.skipped.outOfScope }] as stat}
            <div class="rounded-[10px] px-3 py-2" style="background: var(--hf-fill)">
              <dt class="text-[0.6875rem] text-zinc-500">{stat.label}</dt>
              <dd class="text-lg font-semibold tabular-nums text-zinc-100">{stat.value.toLocaleString()}</dd>
            </div>
          {/each}
        </dl>

        {#if previewRows.length}
          <ul class="hf-list max-h-56 overflow-y-auto rounded-[12px]" style="background: var(--hf-fill)" aria-label="Preview">
            {#each previewRows.slice(0, 40) as row (row.id)}
              <li class="flex items-center gap-3 px-3.5 py-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-zinc-200 {row.mono ? 'font-mono text-xs' : 'text-[0.8125rem] font-medium'}">{row.label}</p>
                  {#if row.detail}<p class="truncate text-[0.6875rem] text-zinc-500">{row.detail}</p>{/if}
                </div>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold {toneClass[row.tone]}">{row.badge}</span>
              </li>
            {/each}
            {#if previewRows.length > 40}
              <li class="px-3.5 py-2 text-xs text-zinc-500">and {(previewRows.length - 40).toLocaleString()} more</li>
            {/if}
          </ul>
        {:else if !parsed.warnings.length}
          <p class="rounded-[10px] px-3.5 py-3 text-[0.8125rem] text-zinc-500" style="background: var(--hf-fill)">
            Everything here is already in {program?.name}.{plan.skipped.existingFindings ? ` ${plan.skipped.existingFindings} scanner result${plan.skipped.existingFindings === 1 ? ' was' : 's were'} imported before.` : ''}
          </p>
        {/if}

        <div class="hf-list overflow-hidden rounded-[12px]" style="background: var(--hf-fill)">
          {#if isScopeImport}
            <Toggle
              bind:checked={updateScope}
              label="Add scope rules to {program?.name ?? 'program'}"
              description="Wildcards and exclusions are used to flag hosts from every future import."
            />
          {:else if hasScopeRules}
            <Toggle
              bind:checked={includeOutOfScope}
              label="Keep out-of-scope hosts"
              description="Off by default so nothing outside the rules ends up on your test list."
            />
          {/if}
          {#if canCreateFindings}
            <Toggle
              bind:checked={createFindings}
              label="Create draft findings"
              description="One draft per issue and location, with the request and response attached. Info-level hits are saved as technologies."
            />
          {/if}
        </div>
      {/if}

      {#if error}
        <p class="text-[0.8125rem] text-red-500" role="alert">{error}</p>
      {/if}

      <div
        class="sticky -bottom-5 -mx-5 -mb-5 flex flex-col-reverse gap-2 px-5 pb-5 pt-3 backdrop-blur-xl sm:flex-row sm:justify-end"
        style="background: var(--hf-material)"
      >
        <button type="button" class="hf-button-secondary" on:click={close}>Cancel</button>
        <button type="submit" class="hf-button-primary" disabled={busy || !plan || total === 0}>
          {#if busy}<Loader2 size={15} class="animate-spin" aria-hidden="true" />{/if}
          {plan && total > 0 ? `Import ${total.toLocaleString()} item${total === 1 ? '' : 's'}` : 'Import'}
        </button>
      </div>
    </form>
  {/if}
</Modal>
