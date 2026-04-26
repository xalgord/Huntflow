<script lang="ts">
  import type { Payout, PayoutSeverity, PayoutStatus, Platform, Target } from '$lib/types';
  import { createId } from '$lib/utils/id';
  import { createEventDispatcher } from 'svelte';

  export let payout: Payout | null = null;
  export let targets: Target[] = [];
  export let submitLabel = 'Save Payout';

  const dispatch = createEventDispatcher<{
    submit: { payout: Payout };
    cancel: void;
  }>();

  const platforms: { label: string; value: Platform }[] = [
    { label: 'HackerOne', value: 'hackerone' },
    { label: 'Bugcrowd', value: 'bugcrowd' },
    { label: 'Intigriti', value: 'intigriti' },
    { label: 'Synack', value: 'synack' },
    { label: 'YesWeHack', value: 'yeswehack' },
    { label: 'Self-hosted', value: 'self-hosted' },
    { label: 'Other', value: 'other' }
  ];

  const severities: { label: string; value: PayoutSeverity }[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
    { label: 'Informational', value: 'informational' }
  ];

  const statuses: { label: string; value: PayoutStatus }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Triaged', value: 'triaged' },
    { label: 'Paid', value: 'paid' }
  ];

  let loadedPayoutId = '';
  let program = '';
  let platform: Platform = 'hackerone';
  let severity: PayoutSeverity = 'medium';
  let amount = 0;
  let date = inputDate(Date.now());
  let status: PayoutStatus = 'pending';
  let errors: Record<string, string> = {};

  $: programSuggestions = Array.from(new Set(targets.map((target) => target.name).filter(Boolean))).sort();
  $: if ((payout?.id ?? '') !== loadedPayoutId) {
    loadedPayoutId = payout?.id ?? '';
    program = payout?.program ?? '';
    platform = payout?.platform ?? 'hackerone';
    severity = payout?.severity ?? 'medium';
    amount = payout?.amount ?? 0;
    date = inputDate(payout?.date ?? Date.now());
    status = payout?.status ?? 'pending';
    errors = {};
  }

  function inputDate(timestamp: number): string {
    const value = new Date(timestamp);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function timestampFromDate(value: string): number {
    return new Date(`${value}T12:00:00`).getTime();
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!program.trim()) nextErrors.program = 'Program is required';
    if (program.trim().length > 100) nextErrors.program = 'Program must be 100 characters or fewer';
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Amount must be greater than zero';
    if (!date || Number.isNaN(timestampFromDate(date))) nextErrors.date = 'Date is required';
    errors = nextErrors;
    return Object.keys(nextErrors).length === 0;
  }

  function submit(): void {
    if (!validate()) return;

    const now = Date.now();
    dispatch('submit', {
      payout: {
        id: payout?.id ?? createId(),
        program: program.trim(),
        platform,
        severity,
        amount: Math.round(amount * 100) / 100,
        date: timestampFromDate(date),
        status,
        createdAt: payout?.createdAt ?? now,
        updatedAt: now
      }
    });
  }
</script>

<form class="grid gap-4" on:submit|preventDefault={submit}>
  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
    <label class="block">
      <span class="hf-label">Program</span>
      <input
        bind:value={program}
        list="income-programs"
        class="mt-2 w-full rounded-md border bg-slate-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 {errors.program
          ? 'border-red-500 ring-1 ring-red-500/50'
          : 'border-slate-600'}"
        placeholder="Example Corp"
      />
      <datalist id="income-programs">
        {#each programSuggestions as suggestion}
          <option value={suggestion}></option>
        {/each}
      </datalist>
      {#if errors.program}<span class="mt-1 block text-xs text-red-400">{errors.program}</span>{/if}
    </label>

    <label class="block">
      <span class="hf-label">Amount</span>
      <div class="mt-2 flex rounded-md border bg-slate-850 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/50 {errors.amount ? 'border-red-500 ring-1 ring-red-500/50' : 'border-slate-600'}">
        <span class="inline-flex min-h-[44px] items-center border-r border-slate-700 px-3 text-sm text-slate-500">$</span>
        <input
          bind:value={amount}
          min="0"
          step="0.01"
          type="number"
          class="w-full rounded-r-md bg-transparent px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          placeholder="0.00"
        />
      </div>
      {#if errors.amount}<span class="mt-1 block text-xs text-red-400">{errors.amount}</span>{/if}
    </label>
  </div>

  <div class="grid gap-4 sm:grid-cols-3">
    <label class="block">
      <span class="hf-label">Platform</span>
      <select
        bind:value={platform}
        class="hf-select mt-2"
      >
        {#each platforms as item}
          <option value={item.value}>{item.label}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Severity</span>
      <select
        bind:value={severity}
        class="hf-select mt-2"
      >
        {#each severities as item}
          <option value={item.value}>{item.label}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Date</span>
      <input
        bind:value={date}
        type="date"
        class="mt-2 w-full rounded-md border bg-slate-850 px-3 py-2.5 text-sm text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 {errors.date
          ? 'border-red-500 ring-1 ring-red-500/50'
          : 'border-slate-600'}"
      />
      {#if errors.date}<span class="mt-1 block text-xs text-red-400">{errors.date}</span>{/if}
    </label>
  </div>

  <fieldset>
    <legend class="hf-label">Status</legend>
    <div class="mt-2 grid gap-2 sm:grid-cols-3">
      {#each statuses as item, index}
        <button
          type="button"
          class="flex min-h-[44px] items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition {status === item.value
            ? 'border-primary-500/60 bg-primary-500/10 text-primary-300'
            : 'border-slate-600 bg-slate-850 text-slate-300 hover:bg-slate-700'}"
          on:click={() => (status = item.value)}
        >
          <span>{item.label}</span>
          <span class="text-xs text-slate-500">{index + 1}</span>
        </button>
      {/each}
    </div>
  </fieldset>

  <div class="flex flex-wrap justify-end gap-3">
    <button
      type="button"
      class="min-h-[44px] rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
      on:click={() => dispatch('cancel')}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="min-h-[44px] rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
    >
      {submitLabel}
    </button>
  </div>
</form>
