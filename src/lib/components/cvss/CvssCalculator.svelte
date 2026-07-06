<script lang="ts">
  import {
    CVSS_DEFAULT_METRICS,
    CVSS_METRIC_LABELS,
    CVSS_METRIC_OPTIONS,
    buildVectorString,
    calculateCvss,
    formatCvssVersionWarning,
    parseCvssVector,
    severityColorClass,
    type CvssBaseMetrics
  } from '$lib/utils/cvss';
  import type { CvssBaseSeverity } from '$lib/types';
  import { Check, Copy } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  /**
   * Existing CVSS:3.1 vector string (e.g. "CVSS:3.1/AV:N/...") to seed the
   * calculator. Ignored if it can't be parsed.
   */
  export let vector = '';
  export let compact = false;

  const dispatch = createEventDispatcher<{
    change: { vector: string; score: number; severity: CvssBaseSeverity };
  }>();

  function metricsFromVector(input: string): CvssBaseMetrics {
    const parsed = parseCvssVector(input);
    return parsed ?? { ...CVSS_DEFAULT_METRICS };
  }

  let metrics: CvssBaseMetrics = metricsFromVector(vector);
  let lastEmittedString = '';
  let copied = false;
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  // Keep metrics in sync if the parent provides a different vector at runtime
  // (e.g. switching between drafts). We only re-parse on actual external change.
  $: if (vector && vector !== buildVectorString(metrics)) {
    const parsed = parseCvssVector(vector);
    if (parsed) metrics = parsed;
  }

  $: cvss = calculateCvss(metrics);
  $: vectorString = cvss.vectorString;
  // Surface a warning when the user pasted/typed a CVSS:3.0 vector — the
  // score is recomputed with 3.1 formulas, so the result may differ.
  $: versionWarning = formatCvssVersionWarning(vector);

  // Emit change after computation, but only when the resulting vector differs
  // from the last emit to avoid feedback loops with the parent.
  $: if (vectorString !== lastEmittedString) {
    lastEmittedString = vectorString;
    dispatch('change', {
      vector: vectorString,
      score: cvss.baseScore,
      severity: cvss.baseSeverity
    });
  }

  const metricKeys: (keyof CvssBaseMetrics)[] = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];

  function setMetric<K extends keyof CvssBaseMetrics>(key: K, value: CvssBaseMetrics[K]) {
    metrics = { ...metrics, [key]: value };
  }

  async function copyVector() {
    try {
      await navigator.clipboard.writeText(vectorString);
      copied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => (copied = false), 1500);
    } catch (error) {
      console.error('Copy failed', error);
    }
  }

  function handlePaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text');
    if (!text) return;
    const parsed = parseCvssVector(text);
    if (parsed) {
      event.preventDefault();
      metrics = parsed;
    }
  }

  function handleVectorInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const parsed = parseCvssVector(value);
    if (parsed) metrics = parsed;
  }
</script>

<div class="space-y-4">
  <header
    class="flex flex-col gap-3 rounded-[14px] border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <p class="hf-eyebrow">CVSS 3.1 Base Score</p>
      <div class="mt-1 flex items-baseline gap-3">
        <span class="op-mono text-4xl font-semibold text-foreground">{cvss.baseScore.toFixed(1)}</span>
        <span
          class="inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] {severityColorClass(cvss.baseSeverity)}"
        >
          {cvss.baseSeverity}
        </span>
      </div>
    </div>
    <div class="min-w-0 flex-1 sm:max-w-xs">
      <label class="block">
        <span class="hf-label">Vector String</span>
        <div
          class="mt-1.5 flex items-center gap-2 rounded-[14px] border border-input bg-background/70 px-3 shadow-inner-line"
        >
          <input
            value={vectorString}
            on:paste={handlePaste}
            on:input={handleVectorInput}
            class="op-mono min-h-[44px] w-full bg-transparent text-xs text-foreground focus:outline-none"
            spellcheck="false"
          />
          <button
            type="button"
            class="inline-flex h-8 min-h-[36px] w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Copy vector"
            on:click={copyVector}
          >
            {#if copied}
              <Check size={14} class="text-primary" aria-hidden="true" />
            {:else}
              <Copy size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
        {#if versionWarning}
          <p class="mt-1.5 text-[11px] text-amber-500 dark:text-amber-400">{versionWarning}</p>
        {/if}
      </label>
    </div>
  </header>

  <div class="grid gap-3 {compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}">
    {#each metricKeys as key}
      <fieldset class="rounded-[14px] border border-border/60 bg-background/40 p-3">
        <legend class="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {CVSS_METRIC_LABELS[key]} ({key})
        </legend>
        <div class="mt-1 flex flex-wrap gap-1.5">
          {#each CVSS_METRIC_OPTIONS[key] as option}
            <button
              type="button"
              title={option.description}
              class="rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition {metrics[key] === option.value ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
              aria-pressed={metrics[key] === option.value}
              on:click={() => setMetric(key, option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </fieldset>
    {/each}
  </div>
</div>
