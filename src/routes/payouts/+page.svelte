<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import IncomeChart from '$lib/components/income/IncomeChart.svelte';
  import PayoutForm from '$lib/components/income/PayoutForm.svelte';
  import TaxExport from '$lib/components/income/TaxExport.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { payoutStore, submissionStore, targetStore } from '$lib/stores';
  import type { Payout, PayoutSeverity, PayoutStatus, Platform } from '$lib/types';
  import { buildSubmissionFromPayout } from '$lib/utils/migrations';
  import { formatDate, formatMoney, platformLabels, statusTone } from '$lib/utils/workspace';
  import { Banknote, CircleDollarSign, Pencil, Plus, Receipt, Search, ShieldAlert, Trash2, TrendingUp } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type StatusFilter = PayoutStatus | 'all';

  const statusSegments: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'triaged', label: 'Triaged' },
    { value: 'paid', label: 'Paid' }
  ];

  const statusLabels: Record<PayoutStatus, string> = { pending: 'Pending', triaged: 'Triaged', paid: 'Paid' };

  let loaded = false;
  let showForm = false;
  let editing: Payout | null = null;
  let query = '';
  let statusFilter: StatusFilter = 'all';
  let platformFilter: Platform | 'all' = 'all';
  let severityFilter: PayoutSeverity | 'all' = 'all';
  let yearFilter = 'all';

  // Re-read ?new=1 when a link targets this page while it's already open
  // (the + menu, command palette), since that doesn't remount the page.
  afterNavigate(({ type }) => {
    if (type === 'enter') return;
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') startCreate(params.get('submission') ?? undefined);
  });

  onMount(async () => {
    await Promise.all([payoutStore.load(), submissionStore.load(), targetStore.load()]);
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') startCreate(params.get('submission') ?? undefined);
    loaded = true;
  });

  /** Prefill a new payout from the finding it rewards. */
  function startCreate(submissionId?: string): void {
    const submission = submissionId ? $submissionStore.find((item) => item.id === submissionId) : undefined;
    const program = submission ? $targetStore.find((target) => target.id === submission.targetId) : undefined;
    editing = submission
      ? {
          id: '',
          program: program?.name ?? '',
          platform: submission.platform,
          severity: submission.severity,
          amount: submission.bountyAmount ?? 0,
          date: Date.now(),
          status: submission.status === 'rewarded' ? 'paid' : 'pending',
          submissionId: submission.id,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      : null;
    showForm = true;
  }

  function startEdit(payout: Payout): void {
    editing = payout;
    showForm = true;
  }

  async function savePayout(event: CustomEvent<{ payout: Payout }>): Promise<void> {
    const payout = event.detail.payout;
    await payoutStore.put(payout);
    // Keep the originating finding in sync so it stops asking for a bounty.
    if (payout.submissionId) {
      const submission = $submissionStore.find((item) => item.id === payout.submissionId);
      if (submission) {
        const payoutIds = Array.from(new Set([...(submission.payoutIds ?? []), payout.id]));
        const linked = $payoutStore.filter((item) => payoutIds.includes(item.id) && item.id !== payout.id);
        const bountyAmount = [...linked, payout].reduce((sum, item) => sum + item.amount, 0);
        await submissionStore.put({ ...submission, payoutIds, bountyAmount, updatedAt: Date.now() });
        await submissionStore.persistNow();
      }
    }
    await payoutStore.persistNow();
    editing = null;
    showForm = false;
  }

  function nextStatus(status: PayoutStatus): PayoutStatus | null {
    if (status === 'pending') return 'triaged';
    if (status === 'triaged') return 'paid';
    return null;
  }

  async function advancePayout(payout: Payout): Promise<void> {
    const status = nextStatus(payout.status);
    if (!status) return;
    await payoutStore.put({ ...payout, status, updatedAt: Date.now() });
    await payoutStore.persistNow();
  }

  async function openFinding(payout: Payout): Promise<void> {
    if (payout.submissionId && existingSubmissionIds.has(payout.submissionId)) {
      await goto(`/findings?id=${payout.submissionId}`);
      return;
    }
    const { submission, updatedPayout } = buildSubmissionFromPayout(payout, $targetStore);
    if (!submission.targetId) {
      alert('Add a program first so the finding can be linked to it.');
      return;
    }
    await submissionStore.put(submission);
    await payoutStore.put(updatedPayout);
    await Promise.all([submissionStore.persistNow(), payoutStore.persistNow()]);
    await goto(`/findings?id=${submission.id}`);
  }

  async function deletePayout(payout: Payout): Promise<void> {
    if (!confirm(`Delete the ${formatMoney(payout.amount)} payout from ${payout.program}?`)) return;
    await payoutStore.delete(payout.id);
    await payoutStore.persistNow();
  }

  $: existingSubmissionIds = new Set($submissionStore.map((submission) => submission.id));
  $: years = Array.from(new Set($payoutStore.map((payout) => String(new Date(payout.date).getFullYear())))).sort(
    (a, b) => Number(b) - Number(a)
  );
  $: paidPayouts = $payoutStore.filter((payout) => payout.status === 'paid');
  $: paidTotal = Math.round(paidPayouts.reduce((sum, payout) => sum + payout.amount, 0) * 100) / 100;
  $: pendingTotal =
    Math.round($payoutStore.filter((payout) => payout.status !== 'paid').reduce((sum, payout) => sum + payout.amount, 0) * 100) /
    100;
  $: currentYear = new Date().getFullYear();
  $: yearPaidTotal =
    Math.round(
      paidPayouts
        .filter((payout) => new Date(payout.date).getFullYear() === currentYear)
        .reduce((sum, payout) => sum + payout.amount, 0) * 100
    ) / 100;
  $: averagePaid = paidPayouts.length > 0 ? Math.round((paidTotal / paidPayouts.length) * 100) / 100 : 0;
  $: filteredPayouts = $payoutStore
    .filter((payout) => {
      if (statusFilter !== 'all' && payout.status !== statusFilter) return false;
      if (platformFilter !== 'all' && payout.platform !== platformFilter) return false;
      if (severityFilter !== 'all' && payout.severity !== severityFilter) return false;
      if (yearFilter !== 'all' && String(new Date(payout.date).getFullYear()) !== yearFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [payout.program, payout.platform, payout.severity, payout.status].join(' ').toLowerCase().includes(search);
    })
    .sort((a, b) => b.date - a.date);
</script>

<svelte:head>
  <title>Payouts | HuntFlow</title>
  <meta name="description" content="Track bug bounty payouts from pending to paid, see income over time and export a tax-year CSV." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <h1 class="hf-title">Payouts</h1>
        <p class="hf-description">Bounties from award to paid, with a tax-year export when you need it.</p>
      </div>
      <button type="button" class="hf-button-primary" on:click={() => startCreate()}>
        <Plus size={15} aria-hidden="true" />
        Add Payout
      </button>
    </header>

    <section class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard icon={TrendingUp} label={`Paid in ${currentYear}`} value={formatMoney(yearPaidTotal)} detail="Tax-year total" tone="success" />
      <MetricCard icon={CircleDollarSign} label="Paid all time" value={formatMoney(paidTotal)} detail={`${paidPayouts.length} paid payout${paidPayouts.length === 1 ? '' : 's'}`} tone="success" />
      <MetricCard icon={Banknote} label="Pending" value={formatMoney(pendingTotal)} detail="Awarded, not yet paid" tone="warning" />
      <MetricCard icon={Receipt} label="Average payout" value={formatMoney(averagePaid)} detail="Paid payouts only" />
    </section>

    {#if showForm}
      <section class="hf-card p-5">
        <h2 class="hf-section-title">{editing?.id ? 'Edit Payout' : 'New Payout'}</h2>
        <p class="mb-4 mt-0.5 text-xs text-zinc-500">
          {editing?.submissionId ? 'Linked to a finding — saving updates its bounty total.' : 'Record real program outcomes only.'}
        </p>
        <PayoutForm
          payout={editing}
          targets={$targetStore}
          submitLabel={editing?.id ? 'Save Changes' : 'Create Payout'}
          on:submit={savePayout}
          on:cancel={() => {
            showForm = false;
            editing = null;
          }}
        />
      </section>
    {/if}

    {#if $payoutStore.length > 0}
      <section class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <IncomeChart payouts={$payoutStore} />
        <TaxExport payouts={$payoutStore} />
      </section>
    {/if}

    <section class="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="hf-segmented self-start" role="radiogroup" aria-label="Payout status">
        {#each statusSegments as segment}
          <button
            type="button"
            role="radio"
            aria-checked={statusFilter === segment.value}
            class="hf-segment {statusFilter === segment.value ? 'hf-segment-active' : ''}"
            on:click={() => (statusFilter = segment.value)}
          >
            {segment.label}
          </button>
        {/each}
      </div>
      <label class="relative block flex-1">
        <span class="sr-only">Search payouts</span>
        <Search size={14} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input bind:value={query} class="hf-input pl-8" placeholder="Search program, platform or severity" />
      </label>
      <div class="grid grid-cols-3 gap-2 lg:flex">
        <select bind:value={platformFilter} class="hf-select lg:w-36" aria-label="Platform">
          <option value="all">All platforms</option>
          {#each Object.entries(platformLabels) as [value, label]}
            <option {value}>{label}</option>
          {/each}
        </select>
        <select bind:value={severityFilter} class="hf-select lg:w-36" aria-label="Severity">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational</option>
        </select>
        <select bind:value={yearFilter} class="hf-select lg:w-28" aria-label="Year">
          <option value="all">All years</option>
          {#each years as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
      </div>
    </section>

    {#if filteredPayouts.length > 0}
      <section class="hf-card overflow-hidden">
        <div
          class="hidden grid-cols-[minmax(12rem,1fr)_7rem_6.5rem_7rem_7.5rem_minmax(14rem,auto)] gap-4 border-b-[0.5px] border-zinc-800 px-4 py-2 text-[0.6875rem] font-semibold text-zinc-500 lg:grid"
        >
          <span>Program</span>
          <span>Severity</span>
          <span class="text-right">Amount</span>
          <span>Date</span>
          <span>Status</span>
          <span class="sr-only">Actions</span>
        </div>
        <ul class="hf-list">
          {#each filteredPayouts as payout (payout.id)}
            {@const next = nextStatus(payout.status)}
            <li
              class="grid gap-x-4 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(12rem,1fr)_7rem_6.5rem_7rem_7.5rem_minmax(14rem,auto)] lg:items-center"
            >
              <div class="min-w-0">
                <p class="truncate text-[0.8125rem] font-semibold text-zinc-100">{payout.program}</p>
                <p class="text-xs text-zinc-500">{platformLabels[payout.platform]}<span class="lg:hidden"> · {formatDate(payout.date)}</span></p>
              </div>
              <div><SeverityBadge severity={payout.severity} variant="dot" /></div>
              <span class="font-mono text-[0.8125rem] font-semibold tabular-nums text-zinc-50 lg:text-right">
                {formatMoney(payout.amount, 'USD', 2)}
              </span>
              <span class="hidden text-xs text-zinc-500 lg:block">{formatDate(payout.date)}</span>
              <span><StatusBadge label={statusLabels[payout.status]} tone={statusTone(payout.status)} /></span>
              <div class="flex items-center justify-start gap-1 lg:justify-end">
                {#if next}
                  <button type="button" class="hf-button-tinted h-7 min-h-0 px-2.5 text-xs" on:click={() => advancePayout(payout)}>
                    Mark {statusLabels[next]}
                  </button>
                {/if}
                <button
                  type="button"
                  class="hf-icon-button"
                  aria-label={payout.submissionId && existingSubmissionIds.has(payout.submissionId) ? 'Open linked finding' : 'Create finding from payout'}
                  title={payout.submissionId && existingSubmissionIds.has(payout.submissionId) ? 'Open linked finding' : 'Create finding from payout'}
                  on:click={() => openFinding(payout)}
                >
                  <ShieldAlert size={15} aria-hidden="true" />
                </button>
                <button type="button" class="hf-icon-button" aria-label="Edit payout" title="Edit" on:click={() => startEdit(payout)}>
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="hf-icon-button hover:!text-red-400"
                  aria-label="Delete payout"
                  title="Delete"
                  on:click={() => deletePayout(payout)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {:else if loaded}
      <EmptyState
        icon={CircleDollarSign}
        title={$payoutStore.length === 0 ? 'No Payouts Yet' : 'No Results'}
        description={$payoutStore.length === 0
          ? 'When a program awards a bounty, log it here and follow it through to paid.'
          : 'Try a different status, platform, severity or year.'}
      />
    {/if}
  </div>
</main>
