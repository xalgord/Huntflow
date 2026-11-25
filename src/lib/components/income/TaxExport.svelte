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
  $: exportTotal = Math.round(exportRows.reduce((sum, payout) => sum + payout.amount, 0) * 100) / 100;

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
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildCsv(): string {
    const lines = [['date', 'program', 'amount', 'platform'].join(',')];

    for (const payout of exportRows) {
      lines.push(
        [
          csvCell(formatDate(payout.date)),
          csvCell(payout.program),
          payout.amount.toFixed(2),
          csvCell(payout.platform)
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

<section class="hf-card flex flex-col p-4">
  <h2 class="hf-section-title">Tax Export</h2>
  <p class="mt-0.5 text-xs leading-5 text-zinc-500">A CSV of paid payouts — date, program, amount and platform — for your accountant.</p>

  <dl class="hf-list mt-4 overflow-hidden rounded-[10px]" style="background: var(--hf-fill)">
    <div class="flex items-center justify-between px-3 py-2.5 text-[0.8125rem]">
      <dt class="text-zinc-400">Tax year</dt>
      <dd>
        <label>
          <span class="sr-only">Tax year</span>
          <select bind:value={year} class="hf-select h-7 min-h-0 w-auto py-0 pl-2.5 text-[0.8125rem]">
            {#each years as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>
      </dd>
    </div>
    <div class="flex items-center justify-between px-3 py-2.5 text-[0.8125rem]">
      <dt class="text-zinc-400">Rows</dt>
      <dd class="font-semibold tabular-nums text-zinc-100">{exportRows.length}</dd>
    </div>
    <div class="flex items-center justify-between px-3 py-2.5 text-[0.8125rem]">
      <dt class="text-zinc-400">Paid total</dt>
      <dd class="font-semibold tabular-nums text-zinc-100">{money(exportTotal)}</dd>
    </div>
  </dl>

  <button type="button" class="hf-button-primary mt-4 w-full" disabled={exportRows.length === 0} on:click={exportCsv}>
    <Download size={15} aria-hidden="true" />
    Export CSV
  </button>
</section>
