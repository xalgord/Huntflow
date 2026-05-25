<script lang="ts">
  import { browser } from '$app/environment';
  import type { NoteTemplate } from '$lib/types';
  import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    LinearScale,
    Tooltip
  } from 'chart.js';
  import { onDestroy, onMount } from 'svelte';

  export let byVulnType: Record<string, number> = {};
  export let templates: NoteTemplate[] = [];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

  function labelFor(id: string): string {
    if (id === 'uncategorized') return 'Uncategorized';
    return templates.find((template) => template.id === id)?.name ?? id;
  }

  function render(): void {
    if (!browser || !canvas) return;

    const entries = Object.entries(byVulnType).sort((a, b) => b[1] - a[1]).slice(0, 8);
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: entries.map(([id]) => labelFor(id)),
        datasets: [
          {
            label: 'Sessions',
            data: entries.map(([, count]) => count),
            backgroundColor: '#16a34a',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: '#1e293b' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#020617',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1'
          }
        }
      }
    });
  }

  onMount(render);
  onDestroy(() => chart?.destroy());

  $: chartKey = JSON.stringify({
    byVulnType,
    templates: templates.map((template) => [template.id, template.name])
  });
  $: if (canvas && chartKey) render();
</script>

<section class="hf-card p-4">
  <h2 class="text-lg font-semibold text-zinc-100">Vulnerability Types</h2>
  <p class="mt-1 text-sm text-zinc-400">Completed sessions by selected template.</p>
  <div class="mt-4 h-72">
    {#if Object.keys(byVulnType).length > 0}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <div class="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900 text-sm text-zinc-500">
        Complete sessions with templates to populate this chart.
      </div>
    {/if}
  </div>
</section>
