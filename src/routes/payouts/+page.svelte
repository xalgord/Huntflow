<script lang="ts">
  import PayoutForm from '$lib/components/income/PayoutForm.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { payoutStore, submissionStore, targetStore } from '$lib/stores';
  import type { Payout, PayoutStatus, Platform } from '$lib/types';
  import { formatDate, formatMoney, platformLabels, statusTone } from '$lib/utils/workspace';
  import { Banknote, CircleDollarSign, Plus, Search, TrendingUp } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type StatusFilter = PayoutStatus | 'all';
  type PlatformFilter = Platform | 'all';

  let loaded = false;
  let showForm = false;
  let editing: Payout | null = null;
  let query = '';
  let statusFilter: StatusFilter = 'all';
  let platformFilter: PlatformFilter = 'all';

  onMount(async () => {
    await Promise.all([payoutStore.load(), submissionStore.load(), targetStore.load()]);
    showForm = new URLSearchParams(location.search).get('new') === '1';
    loaded = true;
  });

  async function savePayout(event: CustomEvent<{ payout: Payout }>): Promise<void> {
    await payoutStore.put(event.detail.payout);
    await payoutStore.persistNow();
    editing = null;
    showForm = false;
  }

  async function deletePayout(payout: Payout): Promise<void> {
    if (!confirm(`Delete payout for ${payout.program}?`)) return;
    await payoutStore.delete(payout.id);
    await payoutStore.persistNow();
  }

  $: paidPayouts = $payoutStore.filter((payout) => payout.status === 'paid');
  $: pendingPayouts = $payoutStore.filter((payout) => payout.status !== 'paid');
  $: totalPaid = Math.round(paidPayouts.reduce((sum, payout) => sum + payout.amount, 0) * 100) / 100;
  $: pendingTotal = Math.round(pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0) * 100) / 100;
  $: averagePaid = paidPayouts.length > 0 ? Math.round((totalPaid / paidPayouts.length) * 100) / 100 : 0;
  $: acceptedReports = $submissionStore.filter((submission) => ['accepted', 'resolved', 'rewarded'].includes(submission.status)).length;
  $: decidedReports = $submissionStore.filter((submission) =>
    ['accepted', 'resolved', 'rewarded', 'duplicate', 'informational', 'not-applicable', 'closed'].includes(submission.status)
  ).length;
  $: acceptedRate = decidedReports > 0 ? Math.round((acceptedReports / decidedReports) * 100) : 0;
  $: duplicateRate =
    decidedReports > 0
      ? Math.round(($submissionStore.filter((submission) => submission.status === 'duplicate').length / decidedReports) * 100)
      : 0;
  $: filteredPayouts = $payoutStore
    .filter((payout) => {
      if (statusFilter !== 'all' && payout.status !== statusFilter) return false;
      if (platformFilter !== 'all' && payout.platform !== platformFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [payout.program, payout.platform, payout.status, payout.severity].join(' ').toLowerCase().includes(search);
    })
    .sort((a, b) => b.date - a.date);
</script>

<svelte:head>
  <title>Payouts | HuntFlow bug bounty command center</title>
  <meta name="description" content="Track bug bounty payouts, accepted report rate, duplicates, pending rewards, average payout, and program income." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Payouts</p>
        <h1 class="hf-title">Income and outcomes</h1>
        <p class="hf-description">
          Track bounty amounts, status, platform, submitted dates, paid dates, and outcome quality without a spreadsheet.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={() => (showForm = !showForm)}>
        <Plus size={17} aria-hidden="true" />
        Add Payout
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={CircleDollarSign} label="Total payout" value={formatMoney(totalPaid)} detail={`${paidPayouts.length} paid records`} tone="success" />
      <MetricCard icon={Banknote} label="Pending payout" value={formatMoney(pendingTotal)} detail="Pending or triaged" tone="warning" />
      <MetricCard icon={TrendingUp} label="Accepted rate" value={`${acceptedRate}%`} detail={`${acceptedReports}/${decidedReports || 0} decided reports`} />
      <MetricCard icon={TrendingUp} label="Duplicate rate" value={`${duplicateRate}%`} detail="Duplicate outcomes" />
      <MetricCard icon={CircleDollarSign} label="Average payout" value={formatMoney(averagePaid)} detail="Paid records only" />
      <MetricCard icon={Banknote} label="Tracked reports" value={String($submissionStore.length)} detail="Submission outcomes" />
      <MetricCard icon={CircleDollarSign} label="Best programs" value={String(new Set(paidPayouts.map((payout) => payout.program)).size)} detail="Programs with paid rewards" />
      <MetricCard icon={TrendingUp} label="Time vs payout" value={totalPaid > 0 ? formatMoney(totalPaid) : '$0'} detail="Use Analytics for time context" />
    </section>

    {#if showForm}
      <section class="hf-card p-5">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-zinc-100">{editing ? 'Edit payout' : 'New payout'}</h2>
          <p class="mt-1 text-sm text-zinc-500">Record only real program outcomes. Rejections, duplicates, and informative outcomes can be tracked on the linked report.</p>
        </div>
        <PayoutForm
          payout={editing}
          targets={$targetStore}
          submitLabel={editing ? 'Save Payout' : 'Create Payout'}
          on:submit={savePayout}
          on:cancel={() => {
            showForm = false;
            editing = null;
          }}
        />
      </section>
    {/if}

    <section class="hf-card p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <div class="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/20">
            <Search size={16} class="text-zinc-600" aria-hidden="true" />
            <input bind:value={query} class="min-h-[44px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" placeholder="Program, platform, status" />
          </div>
        </label>
        <label class="block">
          <span class="hf-label">Status</span>
          <select bind:value={statusFilter} class="hf-select mt-2">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="triaged">Triaged</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Platform</span>
          <select bind:value={platformFilter} class="hf-select mt-2">
            <option value="all">All platforms</option>
            <option value="hackerone">HackerOne</option>
            <option value="bugcrowd">Bugcrowd</option>
            <option value="intigriti">Intigriti</option>
            <option value="yeswehack">YesWeHack</option>
            <option value="self-hosted">Private</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
    </section>

    {#if filteredPayouts.length > 0}
      <section class="hf-card overflow-hidden">
        <div class="hidden grid-cols-[minmax(220px,1fr)_130px_120px_130px_130px_110px] border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-500 lg:grid">
          <span>Program</span>
          <span>Platform</span>
          <span>Severity</span>
          <span>Amount</span>
          <span>Date</span>
          <span>Status</span>
        </div>
        <div class="divide-y divide-zinc-900">
          {#each filteredPayouts as payout}
            <div class="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1fr)_130px_120px_130px_130px_110px] lg:items-center">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-zinc-100">{payout.program}</p>
                <div class="mt-2 flex gap-2">
                  <button type="button" class="text-xs font-medium text-zinc-500 hover:text-zinc-200" on:click={() => {
                    editing = payout;
                    showForm = true;
                  }}>Edit</button>
                  <button type="button" class="text-xs font-medium text-red-300 hover:text-red-200" on:click={() => deletePayout(payout)}>Delete</button>
                </div>
              </div>
              <span class="text-sm text-zinc-400">{platformLabels[payout.platform]}</span>
              <SeverityBadge severity={payout.severity} />
              <span class="font-mono text-sm text-zinc-100">{formatMoney(payout.amount)}</span>
              <span class="text-xs text-zinc-500">{formatDate(payout.date)}</span>
              <StatusBadge label={payout.status} tone={statusTone(payout.status)} />
            </div>
          {/each}
        </div>
      </section>
    {:else if loaded}
      <EmptyState
        icon={CircleDollarSign}
        title={$payoutStore.length === 0 ? 'No payouts yet' : 'No payouts match the filters'}
        description={$payoutStore.length === 0
          ? 'Track pending and paid rewards here once a report has an outcome.'
          : 'Adjust search, status, or platform filters.'}
        actionLabel={$payoutStore.length === 0 ? 'Add Payout' : undefined}
        href={$payoutStore.length === 0 ? '/payouts?new=1' : undefined}
      />
    {/if}
  </div>
</main>
