<script lang="ts">
  import IncomeChart from '$lib/components/income/IncomeChart.svelte';
  import PayoutForm from '$lib/components/income/PayoutForm.svelte';
  import TaxExport from '$lib/components/income/TaxExport.svelte';
  import PlatformIcon from '$lib/components/targets/PlatformIcon.svelte';
  import StatCard from '$lib/components/stats/StatCard.svelte';
  import { payoutStore, submissionStore, targetStore } from '$lib/stores';
  import type { Payout, PayoutSeverity, PayoutStatus, Platform } from '$lib/types';
  import { buildSubmissionFromPayout } from '$lib/utils/migrations';
  import {
    Banknote,
    CalendarDays,
    DollarSign,
    Pencil,
    Plus,
    Receipt,
    Send,
    Trash2,
    TrendingUp
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  type StatusFilter = PayoutStatus | 'all';
  type SeverityFilter = PayoutSeverity | 'all';
  type PlatformFilter = Platform | 'all';

  const platformOptions: { value: Platform; label: string }[] = [
    { value: 'hackerone', label: 'HackerOne' },
    { value: 'bugcrowd', label: 'Bugcrowd' },
    { value: 'intigriti', label: 'Intigriti' },
    { value: 'synack', label: 'Synack' },
    { value: 'yeswehack', label: 'YesWeHack' },
    { value: 'self-hosted', label: 'Self-hosted' },
    { value: 'other', label: 'Other' }
  ];

  const severityOptions: { value: PayoutSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Informational' }
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'triaged', label: 'Triaged' },
    { value: 'paid', label: 'Paid' }
  ];

  let showForm = false;
  let editingPayout: Payout | null = null;
  let query = '';
  let statusFilter: StatusFilter = 'all';
  let platformFilter: PlatformFilter = 'all';
  let severityFilter: SeverityFilter = 'all';
  let yearFilter = 'all';

  onMount(async () => {
    await Promise.all([payoutStore.load(), targetStore.load(), submissionStore.load()]);
  });

  // Set of submission IDs that actually exist, so we can tell when a payout's
  // linked submission has been deleted (and offer re-promotion in that case).
  $: existingSubmissionIds = new Set($submissionStore.map((submission) => submission.id));

  $: years = Array.from(new Set($payoutStore.map((payout) => String(new Date(payout.date).getFullYear())))).sort(
    (a, b) => Number(b) - Number(a)
  );
  $: paidPayouts = $payoutStore.filter((payout) => payout.status === 'paid');
  $: paidTotal = paidPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  $: pendingTotal = $payoutStore
    .filter((payout) => payout.status !== 'paid')
    .reduce((sum, payout) => sum + payout.amount, 0);
  $: currentYear = new Date().getFullYear();
  $: yearPaidTotal = paidPayouts
    .filter((payout) => new Date(payout.date).getFullYear() === currentYear)
    .reduce((sum, payout) => sum + payout.amount, 0);
  $: averagePaid = paidPayouts.length > 0 ? paidTotal / paidPayouts.length : 0;
  $: filteredPayouts = $payoutStore.filter((payout) => {
    if (statusFilter !== 'all' && payout.status !== statusFilter) return false;
    if (platformFilter !== 'all' && payout.platform !== platformFilter) return false;
    if (severityFilter !== 'all' && payout.severity !== severityFilter) return false;
    if (yearFilter !== 'all' && String(new Date(payout.date).getFullYear()) !== yearFilter) return false;

    const search = query.trim().toLowerCase();
    if (!search) return true;

    return (
      payout.program.toLowerCase().includes(search) ||
      payout.platform.toLowerCase().includes(search) ||
      payout.severity.toLowerCase().includes(search) ||
      payout.status.toLowerCase().includes(search)
    );
  });

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(timestamp));
  }

  function severityLabel(value: PayoutSeverity): string {
    return severityOptions.find((option) => option.value === value)?.label ?? value;
  }

  function statusLabel(value: PayoutStatus): string {
    if (value === 'pending') return 'Pending';
    if (value === 'triaged') return 'Triaged';
    return 'Paid';
  }

  function statusClass(value: PayoutStatus): string {
    if (value === 'paid') return 'border-green-500/30 bg-green-500/20 text-green-400';
    if (value === 'triaged') return 'border-blue-500/30 bg-blue-500/20 text-blue-400';
    return 'border-amber-500/30 bg-amber-500/20 text-amber-400';
  }

  function severityClass(value: PayoutSeverity): string {
    if (value === 'critical') return 'border-red-500/30 bg-red-500/20 text-red-400';
    if (value === 'high') return 'border-orange-500/30 bg-orange-500/20 text-orange-400';
    if (value === 'medium') return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400';
    if (value === 'low') return 'border-slate-500/30 bg-slate-700 text-slate-300';
    return 'border-blue-500/30 bg-blue-500/20 text-blue-400';
  }

  function nextStatus(status: PayoutStatus): PayoutStatus | null {
    if (status === 'pending') return 'triaged';
    if (status === 'triaged') return 'paid';
    return null;
  }

  function startCreate(): void {
    editingPayout = null;
    showForm = true;
  }

  function startEdit(payout: Payout): void {
    editingPayout = payout;
    showForm = true;
  }

  async function savePayout(event: CustomEvent<{ payout: Payout }>): Promise<void> {
    await payoutStore.put(event.detail.payout);
    await payoutStore.persistNow();
    showForm = false;
    editingPayout = null;
  }

  async function advancePayout(payout: Payout): Promise<void> {
    const status = nextStatus(payout.status);
    if (!status) return;
    await payoutStore.put({ ...payout, status, updatedAt: Date.now() });
    await payoutStore.persistNow();
  }

  async function promoteToSubmission(payout: Payout): Promise<void> {
    // If already linked to a still-existing submission, just navigate to it.
    if (payout.submissionId && existingSubmissionIds.has(payout.submissionId)) {
      const linked = $submissionStore.find((s) => s.id === payout.submissionId);
      const targetId = linked?.targetId ?? 'all';
      await goto(`/submissions?target=${targetId}`);
      return;
    }
    // Otherwise build a fresh submission (covers both unlinked payouts and
    // payouts whose linked submission was deleted).
    const { submission, updatedPayout } = buildSubmissionFromPayout(payout, $targetStore);
    if (!submission.targetId) {
      alert('Add a target first so the submission can be linked to a program.');
      return;
    }
    await submissionStore.put(submission);
    await payoutStore.put(updatedPayout);
    await Promise.all([submissionStore.persistNow(), payoutStore.persistNow()]);
    await goto(`/submissions?target=${submission.targetId}`);
  }

  async function deletePayout(payout: Payout): Promise<void> {
    if (!confirm(`Delete payout for ${payout.program}?`)) return;
    await payoutStore.delete(payout.id);
    await payoutStore.persistNow();
  }
</script>

<svelte:head>
  <title>Income | HuntFlow</title>
  <meta name="description" content="Track bug bounty payouts, payout status, income charts, and tax CSV exports." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Income Tracker</p>
        <h1 class="hf-title">Payouts</h1>
        <p class="hf-description">
          Track reported earnings across platforms from pending disclosure through paid reward.
        </p>
      </div>
      <button
        type="button"
        class="hf-button-primary"
        on:click={startCreate}
      >
        <Plus size={20} aria-hidden="true" />
        Add Payout
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={DollarSign} value={money(paidTotal)} label="Total paid" trend={`${paidPayouts.length} paid payouts`} tone="primary" />
      <StatCard icon={TrendingUp} value={money(yearPaidTotal)} label={`${currentYear} paid`} trend="tax year view" tone="blue" />
      <StatCard icon={Banknote} value={money(pendingTotal)} label="Pipeline value" trend="pending + triaged" tone="amber" />
      <StatCard icon={Receipt} value={money(averagePaid)} label="Average paid payout" trend="paid only" tone="violet" />
    </section>

    {#if showForm}
      <section class="hf-card p-4">
        <h2 class="mb-4 text-lg font-semibold text-slate-100">{editingPayout ? 'Edit Payout' : 'New Payout'}</h2>
        <PayoutForm
          payout={editingPayout}
          targets={$targetStore}
          submitLabel={editingPayout ? 'Save Changes' : 'Create Payout'}
          on:submit={savePayout}
          on:cancel={() => {
            showForm = false;
            editingPayout = null;
          }}
        />
      </section>
    {/if}

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
      <IncomeChart payouts={$payoutStore} />
      <TaxExport payouts={$payoutStore} />
    </section>

    <section class="hf-card space-y-4 p-4">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_160px_150px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <input
            bind:value={query}
            class="hf-input mt-2"
            placeholder="Program, platform, severity"
          />
        </label>

        <label class="block">
          <span class="hf-label">Status</span>
          <select bind:value={statusFilter} class="hf-select mt-2">
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="hf-label">Platform</span>
          <select bind:value={platformFilter} class="hf-select mt-2">
            <option value="all">All platforms</option>
            {#each platformOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="hf-label">Severity</span>
          <select bind:value={severityFilter} class="hf-select mt-2">
            <option value="all">All severities</option>
            {#each severityOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="hf-label">Year</span>
          <select bind:value={yearFilter} class="hf-select mt-2">
            <option value="all">All years</option>
            {#each years as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    {#if filteredPayouts.length > 0}
      <section class="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-dark-sm">
        <div class="hidden grid-cols-[minmax(180px,1fr)_150px_130px_120px_120px_220px] gap-4 border-b border-slate-700 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <span>Program</span>
          <span>Platform</span>
          <span>Severity</span>
          <span>Amount</span>
          <span>Date</span>
          <span>Status</span>
        </div>

        <div class="divide-y divide-slate-700">
          {#each filteredPayouts as payout (payout.id)}
            {@const submissionExists =
              payout.submissionId != null && existingSubmissionIds.has(payout.submissionId)}
            <article class="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_150px_130px_120px_120px_220px] lg:items-center">
              <div>
                <h2 class="font-semibold text-slate-100">{payout.program}</h2>
                <p class="mt-1 flex items-center gap-1 text-xs text-slate-500 lg:hidden">
                  <CalendarDays size={14} aria-hidden="true" />
                  {formatDate(payout.date)}
                </p>
              </div>

              <PlatformIcon platform={payout.platform} />

              <span class="inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium {severityClass(payout.severity)}">
                {severityLabel(payout.severity)}
              </span>

              <span class="font-semibold text-slate-100">{money(payout.amount)}</span>

              <span class="hidden text-sm text-slate-400 lg:block">{formatDate(payout.date)}</span>

              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium {statusClass(payout.status)}">
                  {statusLabel(payout.status)}
                </span>

                {#if nextStatus(payout.status)}
                  <button
                    type="button"
                    class="min-h-[36px] rounded-md border border-slate-600 bg-slate-850 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                    on:click={() => advancePayout(payout)}
                  >
                    Mark {statusLabel(nextStatus(payout.status) ?? payout.status)}
                  </button>
                {/if}

                <button
                  type="button"
                  class="inline-flex h-9 min-h-0 w-9 items-center justify-center rounded-md transition {submissionExists
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-slate-400 hover:bg-primary/10 hover:text-primary'}"
                  aria-label={submissionExists ? 'View linked submission' : 'Promote to submission'}
                  title={submissionExists ? 'View linked submission' : 'Promote to submission'}
                  on:click={() => promoteToSubmission(payout)}
                >
                  <Send size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  class="inline-flex h-9 min-h-0 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700 hover:text-slate-100"
                  aria-label="Edit payout"
                  on:click={() => startEdit(payout)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  class="inline-flex h-9 min-h-0 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Delete payout"
                  on:click={() => deletePayout(payout)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {:else}
      <section class="hf-card p-8 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-slate-600">
          <DollarSign size={48} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-slate-300">
          {#if $payoutStore.length === 0}
            No payouts logged
          {:else}
            No payouts match the filters
          {/if}
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          {#if $payoutStore.length === 0}
            Add payouts as reports move from pending to triaged to paid.
          {:else}
            Adjust filters to widen the payout list.
          {/if}
        </p>
        {#if $payoutStore.length === 0}
          <button
            type="button"
            class="mt-5 hf-button-primary"
            on:click={startCreate}
          >
            <Plus size={20} aria-hidden="true" />
            Add Payout
          </button>
        {/if}
      </section>
    {/if}
  </div>
</main>
