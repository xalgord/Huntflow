<script lang="ts">
  import { browser } from '$app/environment';
  import type { EvidenceAsset, EvidenceAssetKind, Target } from '$lib/types';
  import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    DoughnutController,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
  } from 'chart.js';
  import { onDestroy, onMount } from 'svelte';

  export let assets: EvidenceAsset[] = [];
  export let targets: Target[] = [];

  type ChartMode = 'kind' | 'target' | 'timeline' | 'readiness';

  const modes: { label: string; value: ChartMode }[] = [
    { label: 'Type', value: 'kind' },
    { label: 'Target', value: 'target' },
    { label: 'Timeline', value: 'timeline' },
    { label: 'Readiness', value: 'readiness' }
  ];

  const kindLabels: Record<EvidenceAssetKind, string> = {
    image: 'Images',
    pdf: 'PDFs',
    text: 'Text',
    request: 'Requests',
    response: 'Responses',
    'http-exchange': 'HTTP Exchanges',
    archive: 'Archives',
    binary: 'Binary',
    url: 'URLs'
  };

  const palette = ['#4ade80', '#22d3ee', '#f59e0b', '#a78bfa', '#fb7185', '#38bdf8', '#94a3b8'];

  let mode: ChartMode = 'kind';
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  Chart.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
  );

  $: hasData = assets.length > 0;
  $: chartKey = JSON.stringify({
    mode,
    assets: assets.map((asset) => [asset.id, asset.kind, asset.targetId, asset.createdAt, asset.tags.join(',')])
  });
  $: if (canvas && chartKey) render();

  function targetName(targetId: string | undefined): string {
    if (!targetId) return 'Unassigned';
    return targets.find((target) => target.id === targetId)?.name ?? 'Missing target';
  }

  function dayKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  }

  function dayLabel(key: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
      new Date(`${key}T12:00:00`)
    );
  }

  function groupBy(keyFor: (asset: EvidenceAsset) => string): [string, number][] {
    const groups = assets.reduce<Record<string, number>>((acc, asset) => {
      const key = keyFor(asset);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }

  function render(): void {
    if (!browser || !canvas || !hasData) return;
    chart?.destroy();

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          backgroundColor: '#09090b',
          borderColor: '#27272a',
          borderWidth: 1,
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1'
        }
      }
    };

    if (mode === 'timeline') {
      const entries = groupBy((asset) => dayKey(asset.createdAt)).sort((a, b) => a[0].localeCompare(b[0]));
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: entries.map(([key]) => dayLabel(key)),
          datasets: [
            {
              label: 'Evidence',
              data: entries.map(([, count]) => count),
              borderColor: '#4ade80',
              backgroundColor: 'rgba(74, 222, 128, 0.16)',
              pointBackgroundColor: '#bbf7d0',
              tension: 0.35,
              fill: true
            }
          ]
        },
        options: {
          ...commonOptions,
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: '#27272a' } }
          },
          plugins: { ...commonOptions.plugins, legend: { display: false } }
        }
      });
      return;
    }

    if (mode === 'target') {
      const entries = groupBy((asset) => targetName(asset.targetId)).slice(0, 8);
      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: entries.map(([label]) => label),
          datasets: [
            {
              label: 'Assets',
              data: entries.map(([, count]) => count),
              backgroundColor: '#22d3ee',
              borderRadius: 8,
              borderSkipped: false
            }
          ]
        },
        options: {
          ...commonOptions,
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: '#27272a' } }
          },
          plugins: { ...commonOptions.plugins, legend: { display: false } }
        }
      });
      return;
    }

    const readinessEntries = ([
      ['Report-ready', assets.filter((asset) => asset.tags.includes('needs-report')).length],
      ['High signal', assets.filter((asset) => asset.tags.some((tag) => tag === 'critical' || tag === 'high')).length],
      ['Untriaged', assets.filter((asset) => asset.tags.length === 0).length]
    ] as [string, number][]).filter(([, count]) => count > 0);
    const entries: [string, number][] =
      mode === 'readiness'
        ? readinessEntries
        : groupBy((asset) => kindLabels[asset.kind]);

    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(([label]) => label),
        datasets: [
          {
            label: 'Assets',
            data: entries.map(([, count]) => count),
            backgroundColor: entries.map((_, index) => palette[index % palette.length]),
            borderColor: '#09090b',
            borderWidth: 2
          }
        ]
      },
      options: {
        ...commonOptions,
        cutout: '58%',
        plugins: {
          ...commonOptions.plugins,
          legend: {
            position: 'bottom',
            labels: { color: '#cbd5e1', boxWidth: 12, padding: 14 }
          }
        }
      }
    });
  }

  onMount(render);
  onDestroy(() => chart?.destroy());
</script>

<section class="hf-card p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p class="op-kicker">Evidence analytics</p>
      <h2 class="mt-2 text-lg font-semibold text-foreground">Asset intelligence</h2>
      <p class="mt-1 text-sm text-muted-foreground">Distribution by proof type, target, capture date, and readiness.</p>
    </div>
    <div class="grid grid-cols-4 overflow-hidden rounded-[14px] border border-border bg-background/50 shadow-inner-line">
      {#each modes as item}
        <button
          type="button"
          class="min-h-[40px] px-3 text-xs font-medium transition {mode === item.value
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          on:click={() => (mode = item.value)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="mt-4 h-80">
    {#if hasData}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <div class="flex h-full items-center justify-center rounded-[14px] border border-dashed border-border bg-background/50 text-sm text-muted-foreground">
        Upload or capture evidence to chart coverage.
      </div>
    {/if}
  </div>
</section>
