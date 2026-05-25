<script lang="ts">
  import type { Payout } from '$lib/types';
  import { Download } from 'lucide-svelte';

  export let payouts: Payout[] = [];

  let year = String(new Date().getFullYear());

  $: years = availableYears(payouts);
  $: if (years.length > 0 && !years.includes(year)) year = years[0];
  $: exportRows = payouts
    .filter((payout) => payout.status === 'paid')
    .filter((payout) => String(new Date(payout.date).getFullYear()) === year)
    .sort((a, b) => a.date - b.date);
  $: exportTotal = exportRows.reduce((sum, payout) => sum + payout.amount, 0);

  function availableYears(items: Payout[]): string[] {
    const values = Array.from(
      new Set(
        items
          .filter((payout) => payout.status === 'paid')
          .map((payout) => String(new Date(payout.date).getFullYear()))
      )
    ).sort((a, b) => Number(b) - Number(a));

    return values.length > 0 ? values : [String(new Date().getFullYear())];
  }

  function formatDate(timestamp: number): string {
    const value = new Date(timestamp);
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  function csvCell(value: string | number): string {
    const text = String(value);
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildCsv(): string {
    const lines = [['date', 'program', 'amount', 'platform'].join(',')];

    for (const payout of exportRows) {
      lines.push(
        [
          formatDate(payout.date),
          csvCell(payout.program),
          payout.amount.toFixed(2),
          payout.platform
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  function exportCsv(): void {
    const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `huntflow-payouts-${year}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="hf-card p-4">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-zinc-100">Tax Export</h2>
      <p class="mt-1 text-sm text-zinc-400">CSV includes date, program, amount, and platform for paid payouts.</p>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row">
      <label class="block">
        <span class="sr-only">Tax year</span>
        <select
          bind:value={year}
          class="hf-select"
        >
          {#each years as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        disabled={exportRows.length === 0}
        on:click={exportCsv}
      >
        <Download size={18} aria-hidden="true" />
        Export CSV
      </button>
    </div>
  </div>

  <dl class="mt-4 grid gap-3 sm:grid-cols-3">
    <div class="rounded-md border border-zinc-700 bg-zinc-850 p-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rows</dt>
      <dd class="mt-1 text-xl font-bold text-zinc-100">{exportRows.length}</dd>
    </div>
    <div class="rounded-md border border-zinc-700 bg-zinc-850 p-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paid Total</dt>
      <dd class="mt-1 text-xl font-bold text-zinc-100">{money(exportTotal)}</dd>
    </div>
    <div class="rounded-md border border-zinc-700 bg-zinc-850 p-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Year</dt>
      <dd class="mt-1 text-xl font-bold text-zinc-100">{year}</dd>
    </div>
  </dl>
</section>
