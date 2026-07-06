<script lang="ts">
  import AnalyticsCard from '$lib/components/workspace/AnalyticsCard.svelte';
  import BarRow from '$lib/components/workspace/BarRow.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import { payoutStore, reconAssetStore, sessionStore, submissionStore, targetStore } from '$lib/stores';
  import type { PayoutSeverity, SubmissionStatus } from '$lib/types';
  import { formatDuration, formatMoney, platformLabels, severityLabels, submissionStatusLabels } from '$lib/utils/workspace';
  import { BarChart3, Clock, CircleDollarSign, Target, Timer, TrendingUp } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let loaded = false;

  onMount(async () => {
    await Promise.all([
      sessionStore.load(),
      targetStore.load(),
      submissionStore.load(),
      payoutStore.load(),
      reconAssetStore.load()
    ]);
    loaded = true;
  });

  function weekKey(timestamp: number): string {
    const date = new Date(timestamp);
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    return `${start.getMonth() + 1}/${start.getDate()}`;
  }

  function monthKey(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(timestamp));
  }

  function barWidth(value: number, max: number): string {
    if (max <= 0) return '0%';
    return `${Math.max(4, Math.round((value / max) * 100))}%`;
  }

  const severityOrder: PayoutSeverity[] = ['critical', 'high', 'medium', 'low', 'informational'];
  const statusOrder: SubmissionStatus[] = [
    'draft',
    'submitted',
    'triaged',
    'accepted',
    'duplicate',
    'informational',
    'not-applicable',
    'resolved',
    'rewarded',
    'closed'
  ];

  $: completedSessions = $sessionStore.filter((session) => session.status === 'completed');
  $: totalSeconds = completedSessions.reduce((sum, session) => sum + session.durationActual, 0);
  $: totalPayout = Math.round(
    $payoutStore.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amount, 0) * 100
  ) / 100;
  $: decidedReports = $submissionStore.filter((submission) =>
    ['accepted', 'resolved', 'rewarded', 'duplicate', 'informational', 'not-applicable', 'closed'].includes(submission.status)
  );
  $: acceptedReports = decidedReports.filter((submission) => ['accepted', 'resolved', 'rewarded'].includes(submission.status));
  $: acceptedRate = decidedReports.length > 0 ? Math.round((acceptedReports.length / decidedReports.length) * 100) : 0;
  $: duplicateRate =
    decidedReports.length > 0
      ? Math.round((decidedReports.filter((submission) => submission.status === 'duplicate').length / decidedReports.length) * 100)
      : 0;
  $: weekHours = Object.entries(
    completedSessions.reduce<Record<string, number>>((groups, session) => {
      const key = weekKey(session.startedAt);
      groups[key] = (groups[key] ?? 0) + session.durationActual / 3600;
      return groups;
    }, {})
  ).slice(-8);
  $: maxWeekHours = Math.max(0, ...weekHours.map(([, value]) => value));
  $: severityCounts = severityOrder.map((severity) => ({
    label: severityLabels[severity],
    value: $submissionStore.filter((submission) => submission.severity === severity).length
  }));
  $: maxSeverity = Math.max(0, ...severityCounts.map((item) => item.value));
  $: statusCounts = statusOrder.map((status) => ({
    label: submissionStatusLabels[status],
    value: $submissionStore.filter((submission) => submission.status === status).length
  })).filter((item) => item.value > 0);
  $: maxStatus = Math.max(0, ...statusCounts.map((item) => item.value));
  $: payoutMonths = Object.entries(
    $payoutStore.reduce<Record<string, number>>((groups, payout) => {
      const key = monthKey(payout.date);
      groups[key] = (groups[key] ?? 0) + (payout.status === 'paid' ? payout.amount : 0);
      return groups;
    }, {})
  ).slice(-8);
  $: maxPayoutMonth = Math.max(0, ...payoutMonths.map(([, value]) => value));
  $: programSuccess = $targetStore
    .map((program) => {
      const reports = $submissionStore.filter((submission) => submission.targetId === program.id);
      const decided = reports.filter((submission) =>
        ['accepted', 'resolved', 'rewarded', 'duplicate', 'informational', 'not-applicable', 'closed'].includes(submission.status)
      );
      const accepted = decided.filter((submission) => ['accepted', 'resolved', 'rewarded'].includes(submission.status));
      return {
        name: program.name,
        platform: platformLabels[program.platform],
        value: decided.length > 0 ? Math.round((accepted.length / decided.length) * 100) : 0,
        decided: decided.length
      };
    })
    .filter((item) => item.decided > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  $: productiveTargets = $reconAssetStore
    .map((asset) => ({
      name: asset.url ?? asset.hostname,
      value: $submissionStore.filter((submission) =>
        [submission.title, submission.reportMarkdown ?? '', submission.notes ?? '']
          .join(' ')
          .toLowerCase()
          .includes(asset.hostname.toLowerCase())
      ).length
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  $: timeToReport = $submissionStore
    .filter((submission) => submission.submittedAt && submission.createdAt)
    .map((submission) => Math.max(0, (submission.submittedAt! - submission.createdAt) / 86_400_000));
  $: avgLeadToReport =
    timeToReport.length > 0 ? Math.round(timeToReport.reduce((sum, value) => sum + value, 0) / timeToReport.length) : null;
  $: timeToPayout = $submissionStore
    .filter((submission) => submission.submittedAt && submission.rewardedAt)
    .map((submission) => Math.max(0, (submission.rewardedAt! - submission.submittedAt!) / 86_400_000));
  $: avgReportToPayout =
    timeToPayout.length > 0 ? Math.round(timeToPayout.reduce((sum, value) => sum + value, 0) / timeToPayout.length) : null;
</script>

<svelte:head>
  <title>Analytics | HuntFlow bug bounty command center</title>
  <meta name="description" content="Analyze hunt hours, finding severity, report outcomes, payouts, duplicate rate, productive targets, and payout timing." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Analytics</p>
        <h1 class="hf-title">Improve your hunting strategy</h1>
        <p class="hf-description">
          Analytics are computed from local sessions, targets, reports, and payouts. Empty charts stay empty until real data exists.
        </p>
      </div>
      <a href="/sessions" class="hf-button-primary">
        <Timer size={17} aria-hidden="true" />
        Start from sessions
      </a>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={Clock} label="Total hunt time" value={formatDuration(totalSeconds)} detail={`${completedSessions.length} completed sessions`} />
      <MetricCard icon={CircleDollarSign} label="Paid bounty" value={formatMoney(totalPayout)} detail="Paid payout records" tone="success" />
      <MetricCard icon={TrendingUp} label="Accepted rate" value={`${acceptedRate}%`} detail={`${acceptedReports.length}/${decidedReports.length} decided`} />
      <MetricCard icon={BarChart3} label="Duplicate/N/A rate" value={`${duplicateRate}%`} detail="Duplicate reports only" />
      <MetricCard icon={Target} label="Most productive targets" value={String(productiveTargets.length)} detail="Targets with linked findings" />
      <MetricCard icon={Clock} label="Lead to report" value={avgLeadToReport == null ? 'No data' : `${avgLeadToReport}d`} detail="Average submitted draft age" />
      <MetricCard icon={Clock} label="Report to payout" value={avgReportToPayout == null ? 'No data' : `${avgReportToPayout}d`} detail="Average rewarded report time" />
      <MetricCard icon={BarChart3} label="Programs with outcomes" value={String(programSuccess.length)} detail="Success-rate eligible" />
    </section>

    {#if loaded && completedSessions.length === 0 && $submissionStore.length === 0 && $payoutStore.length === 0}
      <EmptyState
        icon={BarChart3}
        title="No analytics yet"
        description="Complete sessions, capture findings, submit reports, and log payout outcomes to populate analytics."
        actionLabel="Start Session"
        href="/timer"
      />
    {/if}

    <section class="grid gap-4 xl:grid-cols-2">
      <AnalyticsCard title="Hunt hours per week" subtitle="Completed session duration by week">
        {#if weekHours.length > 0}
          <div class="space-y-3">
            {#each weekHours as [label, value]}
              <BarRow {label} value={`${value.toFixed(1)}h`} width={barWidth(value, maxWeekHours)} />
            {/each}
          </div>
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No completed sessions yet.</p>
        {/if}
      </AnalyticsCard>

      <AnalyticsCard title="Findings by severity" subtitle="Only real local findings are counted">
        {#if $submissionStore.length > 0}
          <div class="space-y-3">
            {#each severityCounts as item}
              <BarRow label={item.label} value={String(item.value)} width={barWidth(item.value, maxSeverity)} />
            {/each}
          </div>
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No findings yet.</p>
        {/if}
      </AnalyticsCard>

      <AnalyticsCard title="Findings by status" subtitle="Lead through paid/closed outcomes">
        {#if statusCounts.length > 0}
          <div class="space-y-3">
            {#each statusCounts as item}
              <BarRow label={item.label} value={String(item.value)} width={barWidth(item.value, maxStatus)} />
            {/each}
          </div>
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No status data yet.</p>
        {/if}
      </AnalyticsCard>

      <AnalyticsCard title="Payout by month" subtitle="Paid payout records only">
        {#if payoutMonths.length > 0}
          <div class="space-y-3">
            {#each payoutMonths as [label, value]}
              <BarRow {label} value={formatMoney(value)} width={barWidth(value, maxPayoutMonth)} />
            {/each}
          </div>
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No paid payouts yet.</p>
        {/if}
      </AnalyticsCard>

      <AnalyticsCard title="Programs by success rate" subtitle="Programs with decided report outcomes">
        {#if programSuccess.length > 0}
          <div class="space-y-3">
            {#each programSuccess as item}
              <BarRow label={`${item.name} · ${item.platform}`} value={`${item.value}%`} width={barWidth(item.value, 100)} />
            {/each}
          </div>
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No decided program outcomes yet.</p>
        {/if}
      </AnalyticsCard>

      <AnalyticsCard title="Most productive targets" subtitle="Target assets referenced by findings">
        {#if productiveTargets.length > 0}
          <div class="space-y-3">
            {#each productiveTargets as item}
              <BarRow label={item.name} value={`${item.value} findings`} width={barWidth(item.value, Math.max(...productiveTargets.map((target) => target.value)))} />
            {/each}
          </div>
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No target/finding linkage yet.</p>
        {/if}
      </AnalyticsCard>
    </section>
  </div>
</main>
