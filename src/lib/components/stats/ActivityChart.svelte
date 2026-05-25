<script lang="ts">
  import { browser } from '$app/environment';
  import type { DailyStat } from '$lib/types';
  import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    LinearScale,
    Tooltip
  } from 'chart.js';
  import { onDestroy, onMount } from 'svelte';

  export let dailyStats: DailyStat[] = [];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

  function dayLabel(date: string): string {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${date}T00:00:00`));
  }

  function render(): void {
    if (!browser || !canvas) return;

    const days = dailyStats.slice(-7);
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days.map((day) => dayLabel(day.date)),
        datasets: [
          {
            label: 'Minutes',
            data: days.map((day) => day.totalMinutes),
            backgroundColor: '#4ade80',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
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

  $: chartKey = JSON.stringify(dailyStats);
  $: if (canvas && chartKey) render();
</script>

<section class="hf-card p-4">
  <h2 class="text-lg font-semibold text-zinc-100">Weekly Activity</h2>
  <p class="mt-1 text-sm text-zinc-400">Completed hunting minutes over the last 7 days.</p>
  <div class="mt-4 h-72">
    {#if dailyStats.some((day) => day.totalMinutes > 0)}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <div class="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900 text-sm text-zinc-500">
        Complete a session to start charting activity.
      </div>
    {/if}
  </div>
</section>
