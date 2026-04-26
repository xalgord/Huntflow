<script lang="ts">
  import { browser } from '$app/environment';
  import type { Payout, PayoutSeverity, Platform } from '$lib/types';
  import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    DoughnutController,
    ArcElement,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
  } from 'chart.js';
  import { onDestroy, onMount } from 'svelte';

  export let payouts: Payout[] = [];

  type ChartMode = 'time' | 'platform' | 'severity';

  const modes: { label: string; value: ChartMode }[] = [
    { label: 'Over time', value: 'time' },
    { label: 'Platform', value: 'platform' },
    { label: 'Severity', value: 'severity' }
  ];

  const platformLabels: Record<Platform, string> = {
    hackerone: 'HackerOne',
    bugcrowd: 'Bugcrowd',
    intigriti: 'Intigriti',
    synack: 'Synack',
    yeswehack: 'YesWeHack',
    'self-hosted': 'Self-hosted',
    other: 'Other'
  };

  const severityLabels: Record<PayoutSeverity, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    informational: 'Informational'
  };

  const palette = ['#16a34a', '#0ea5e9', '#f59e0b', '#dc2626', '#8b5cf6', '#14b8a6', '#71717a'];

  let mode: ChartMode = 'time';
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    ArcElement,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
  );

  $: paidPayouts = payouts.filter((payout) => payout.status === 'paid');
  $: hasPaidData = paidPayouts.length > 0 && paidPayouts.some((payout) => payout.amount > 0);
  $: chartKey = JSON.stringify({
    mode,
    payouts: paidPayouts.map((payout) => [payout.id, payout.amount, payout.date, payout.platform, payout.severity])
  });
  $: if (canvas && chartKey) render();

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  function monthKey(timestamp: number): string {
    const value = new Date(timestamp);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(key: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(
      new Date(`${key}-01T12:00:00`)
    );
  }

  function groupBy(keyFor: (payout: Payout) => string): [string, number][] {
    const groups = paidPayouts.reduce<Record<string, number>>((acc, payout) => {
      const key = keyFor(payout);
      acc[key] = (acc[key] ?? 0) + payout.amount;
      return acc;
    }, {});

    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }

  function render(): void {
    if (!browser || !canvas || !hasPaidData) return;

    chart?.destroy();

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          backgroundColor: '#09090b',
          borderColor: '#27272a',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1'
        }
      }
    };

    if (mode === 'time') {
      const entries = groupBy((payout) => monthKey(payout.date)).sort((a, b) => a[0].localeCompare(b[0]));
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: entries.map(([key]) => monthLabel(key)),
          datasets: [
            {
              label: 'Paid',
              data: entries.map(([, amount]) => amount),
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.18)',
              pointBackgroundColor: '#86efac',
              pointBorderColor: '#052e16',
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          ...commonOptions,
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#27272a' } }
          },
          plugins: {
            ...commonOptions.plugins,
            legend: { display: false }
          }
        }
      });
      return;
    }

    if (mode === 'platform') {
      const entries = groupBy((payout) => platformLabels[payout.platform]);
      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: entries.map(([label]) => label),
          datasets: [
            {
              label: 'Paid',
              data: entries.map(([, amount]) => amount),
              backgroundColor: '#0ea5e9',
              borderRadius: 6,
              borderSkipped: false
            }
          ]
        },
        options: {
          ...commonOptions,
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#27272a' } }
          },
          plugins: {
            ...commonOptions.plugins,
            legend: { display: false }
          }
        }
      });
      return;
    }

    const entries = groupBy((payout) => severityLabels[payout.severity]);
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(([label]) => label),
        datasets: [
          {
            label: 'Paid',
            data: entries.map(([, amount]) => amount),
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
            labels: {
              color: '#cbd5e1',
              boxWidth: 12,
              padding: 14
            }
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
      <h2 class="text-lg font-semibold text-foreground">Earnings</h2>
      <p class="mt-1 text-sm text-muted-foreground">Paid payouts over time, by platform, and by severity.</p>
    </div>
    <div class="grid grid-cols-3 overflow-hidden rounded-md border border-border bg-background/50 shadow-inner-line">
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
    {#if hasPaidData}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <div class="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-background/50 text-sm text-muted-foreground">
        Mark a payout as paid to chart earnings.
      </div>
    {/if}
  </div>
</section>
