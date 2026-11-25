<script lang="ts">
  import {
    CVSS_DEFAULT_METRICS,
    CVSS_METRIC_LABELS,
    CVSS_METRIC_OPTIONS,
    calculateCvss,
    parseCvssVector,
    type CvssBaseMetrics
  } from '$lib/utils/cvss';
  import { buildCvss4Vector, CVSS4_DEFAULTS, CVSS4_METRICS, parseCvss4Vector, scoreCvss4, type Cvss4Metrics } from '$lib/utils/cvss4';
  import { severityFromCvssScore } from '$lib/utils/findingReport';
  import type { PayoutSeverity } from '$lib/types';
  import { Check, Copy } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  /** Current v3.1 and v4.0 vectors on the finding (either may be empty). */
  export let vector31 = '';
  export let vector40 = '';

  const dispatch = createEventDispatcher<{
    change31: { vector: string | undefined; score: number | undefined; severity?: PayoutSeverity };
    change40: { vector: string | undefined; score: number | undefined; severity?: PayoutSeverity };
  }>();

  let version: '3.1' | '4.0' = vector40 && !vector31 ? '4.0' : '3.1';
  let copied = false;
  let score40: number | null = null;

  const keys31: (keyof CvssBaseMetrics)[] = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];

  $: metrics31 = parseCvssVector(vector31) ?? null;
  $: metrics40 = parseCvss4Vector(vector40);
  $: result31 = metrics31 ? calculateCvss(metrics31) : null;
  $: if (vector40) void scoreCvss4(vector40).then((value) => (score40 = value));
  $: if (!vector40) score40 = null;
  $: activeVector = version === '3.1' ? (result31?.vectorString ?? '') : vector40;
  $: activeScore = version === '3.1' ? result31?.baseScore ?? null : score40;

  function set31(key: keyof CvssBaseMetrics, value: string): void {
    const next = { ...(metrics31 ?? CVSS_DEFAULT_METRICS), [key]: value } as CvssBaseMetrics;
    const result = calculateCvss(next);
    dispatch('change31', { vector: result.vectorString, score: result.baseScore, severity: severityFromCvssScore(result.baseScore) });
  }

  async function set40(key: keyof Cvss4Metrics, value: string): Promise<void> {
    const vector = buildCvss4Vector({ ...(metrics40 ?? CVSS4_DEFAULTS), [key]: value });
    const score = await scoreCvss4(vector);
    dispatch('change40', { vector, score: score ?? undefined, severity: score == null ? undefined : severityFromCvssScore(score) });
  }

  async function pasteVector(event: Event): Promise<void> {
    const text = (event.currentTarget as HTMLInputElement).value.trim();
    if (text.startsWith('CVSS:4.0/') && parseCvss4Vector(text)) {
      version = '4.0';
      const score = await scoreCvss4(text);
      dispatch('change40', { vector: text, score: score ?? undefined, severity: score == null ? undefined : severityFromCvssScore(score) });
    } else if (parseCvssVector(text)) {
      version = '3.1';
      const result = calculateCvss(parseCvssVector(text)!);
      dispatch('change31', { vector: result.vectorString, score: result.baseScore, severity: severityFromCvssScore(result.baseScore) });
    }
  }

  function clear(): void {
    if (version === '3.1') dispatch('change31', { vector: undefined, score: undefined });
    else dispatch('change40', { vector: undefined, score: undefined });
  }

  async function copy(): Promise<void> {
    if (!activeVector) return;
    await navigator.clipboard.writeText(activeVector);
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }

  const scoreTone = (score: number | null) =>
    score == null
      ? 'text-zinc-500'
      : score >= 9
        ? 'text-red-500'
        : score >= 7
          ? 'text-orange-500'
          : score >= 4
            ? 'text-yellow-500'
            : score > 0
              ? 'text-blue-500'
              : 'text-zinc-500';
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center gap-3">
    <div class="hf-segmented" role="radiogroup" aria-label="CVSS version">
      {#each ['3.1', '4.0'] as option}
        <button
          type="button"
          role="radio"
          aria-checked={version === option}
          class="hf-segment {version === option ? 'hf-segment-active' : ''}"
          on:click={() => (version = option === '3.1' ? '3.1' : '4.0')}>CVSS {option}</button
        >
      {/each}
    </div>
    <div class="flex items-baseline gap-1.5">
      <span class="text-[1.375rem] font-semibold tabular-nums {scoreTone(activeScore)}">
        {activeScore == null ? '—' : activeScore.toFixed(1)}
      </span>
      {#if activeScore != null}
        <span class="text-xs font-medium capitalize text-zinc-500">{severityFromCvssScore(activeScore)}</span>
      {/if}
    </div>
    <div class="ml-auto flex min-w-0 flex-1 items-center gap-1 sm:max-w-sm">
      <input
        class="hf-input h-8 min-h-0 py-0 font-mono text-[0.6875rem]"
        value={activeVector}
        placeholder={version === '3.1' ? 'Paste a CVSS:3.1 vector or pick metrics' : 'Paste a CVSS:4.0 vector or pick metrics'}
        spellcheck="false"
        aria-label="CVSS vector"
        on:change={pasteVector}
      />
      <button type="button" class="hf-icon-button" aria-label="Copy vector" disabled={!activeVector} on:click={copy}>
        {#if copied}<Check size={14} class="text-green-500" aria-hidden="true" />{:else}<Copy size={14} aria-hidden="true" />{/if}
      </button>
    </div>
  </div>

  <div class="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
    {#if version === '3.1'}
      {#each keys31 as key}
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-zinc-400">{CVSS_METRIC_LABELS[key]}</span>
          <div class="hf-segmented shrink-0" role="radiogroup" aria-label={CVSS_METRIC_LABELS[key]}>
            {#each CVSS_METRIC_OPTIONS[key] as option}
              <button
                type="button"
                role="radio"
                aria-checked={metrics31?.[key] === option.value}
                title={option.description}
                class="hf-segment px-2 text-[0.6875rem] {metrics31?.[key] === option.value ? 'hf-segment-active' : ''}"
                on:click={() => set31(key, option.value)}>{option.label}</button
              >
            {/each}
          </div>
        </div>
      {/each}
    {:else}
      {#each CVSS4_METRICS as metric}
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-zinc-400">
            {metric.label}
            {#if metric.group !== 'Exploitability'}<span class="text-zinc-600">· {metric.group === 'Vulnerable system' ? 'VS' : 'SS'}</span>{/if}
          </span>
          <div class="hf-segmented shrink-0" role="radiogroup" aria-label={`${metric.label} (${metric.group})`}>
            {#each metric.options as option}
              <button
                type="button"
                role="radio"
                aria-checked={metrics40?.[metric.key] === option.value}
                class="hf-segment px-2 text-[0.6875rem] {metrics40?.[metric.key] === option.value ? 'hf-segment-active' : ''}"
                on:click={() => set40(metric.key, option.value)}>{option.label}</button
              >
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if activeVector}
    <button type="button" class="text-xs font-medium text-zinc-500 hover:text-red-400" on:click={clear}>
      Remove CVSS {version} score
    </button>
  {/if}
</div>
