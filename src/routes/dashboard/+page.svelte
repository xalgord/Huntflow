<script lang="ts">
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import {
    noteStore,
    payoutStore,
    reconAssetStore,
    sessionStore,
    submissionStore,
    targetStore,
    timerStore
  } from '$lib/stores';
  import {
    buildAttentionQueue,
    buildRecentActivity,
    buildSetupSteps,
    buildWeekSummary,
    type ActivityKind,
    type AttentionKind,
    type AttentionTone
  } from '$lib/utils/attention';
  import {
    formatDuration,
    formatMoney,
    formatRelativeDate,
    formatTimer,
    platformLabels,
    priorityLabels,
    statusTone,
    targetStatusLabels
  } from '$lib/utils/workspace';
  import {
    AlarmClock,
    CheckCircle2,
    ChevronRight,
    CircleDollarSign,
    Clock,
    FileText,
    FolderKanban,
    Lightbulb,
    PenLine,
    Play,
    Send,
    ShieldAlert,
    Target as TargetIcon,
    Timer,
    TrendingUp
  } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';
  import { onMount } from 'svelte';

  let loaded = false;
  let showAllAttention = false;

  onMount(async () => {
    await Promise.all([
      targetStore.load(),
      reconAssetStore.load(),
      sessionStore.load(),
      noteStore.load(),
      submissionStore.load(),
      payoutStore.load()
    ]);
    loaded = true;
  });

  const kindIcon: Record<AttentionKind, ComponentType> = {
    'sla-overdue': AlarmClock,
    'sla-approaching': Clock,
    draft: PenLine,
    lead: Lightbulb,
    'record-bounty': CircleDollarSign,
    'payout-pending': CircleDollarSign,
    target: TargetIcon
  };

  const toneBg: Record<AttentionTone, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    gray: 'bg-zinc-500'
  };

  const activityIcon: Record<ActivityKind, ComponentType> = {
    session: Timer,
    note: FileText,
    finding: ShieldAlert,
    payout: CircleDollarSign
  };

  $: today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  $: attention = buildAttentionQueue({
    programs: $targetStore,
    submissions: $submissionStore,
    notes: $noteStore,
    payouts: $payoutStore,
    assets: $reconAssetStore
  });
  $: visibleAttention = showAllAttention ? attention : attention.slice(0, 7);
  $: summary = buildWeekSummary($sessionStore, $submissionStore, $payoutStore);
  $: activity = buildRecentActivity({
    programs: $targetStore,
    sessions: $sessionStore,
    notes: $noteStore,
    submissions: $submissionStore,
    payouts: $payoutStore
  });
  $: setupSteps = buildSetupSteps({
    programs: $targetStore,
    assets: $reconAssetStore,
    sessions: $sessionStore,
    submissions: $submissionStore
  });
  $: setupDone = setupSteps.filter((step) => step.done).length;
  $: showSetup = loaded && setupDone < setupSteps.length;

  $: activePrograms = $targetStore
    .filter((program) => !['archived', 'closed'].includes(program.status))
    .sort((a, b) => a.priority - b.priority || (b.lastSessionAt ?? b.updatedAt) - (a.lastSessionAt ?? a.updatedAt));
  $: lastHunted = [...$targetStore]
    .filter((program) => program.lastSessionAt)
    .sort((a, b) => (b.lastSessionAt ?? 0) - (a.lastSessionAt ?? 0))[0];
  $: timerActive = $timerStore.status === 'running' || $timerStore.status === 'paused';
  $: activeSession = $timerStore.sessionId
    ? $sessionStore.find((session) => session.id === $timerStore.sessionId)
    : undefined;
  $: activeProgram = activeSession ? $targetStore.find((program) => program.id === activeSession?.targetId) : undefined;
  $: continueProgram = timerActive ? activeProgram : lastHunted ?? activePrograms[0];
</script>

<svelte:head>
  <title>Today | HuntFlow</title>
  <meta
    name="description"
    content="Today in HuntFlow: overdue reports, drafts to finish, leads to promote, payouts to chase and targets to test."
  />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="text-[0.8125rem] font-semibold text-primary">{today}</p>
        <h1 class="hf-title">Today</h1>
        <p class="hf-description">Local programs, findings and payouts — ranked by what needs you next.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="/notes/new" class="hf-button-secondary">
          <FileText size={15} aria-hidden="true" />
          Capture Note
        </a>
        <a href="/timer" class="hf-button-primary">
          <Play size={13} fill="currentColor" aria-hidden="true" />
          Start Session
        </a>
      </div>
    </header>

    {#if showSetup}
      <section class="hf-card p-4 sm:p-5" aria-labelledby="setup-heading">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 id="setup-heading" class="hf-section-title">Set up your workspace</h2>
            <p class="mt-0.5 text-xs text-zinc-500">{setupDone} of {setupSteps.length} done · everything stays on this device</p>
          </div>
          <div class="h-1.5 w-28 overflow-hidden rounded-full" style="background: var(--hf-fill)" aria-hidden="true">
            <div class="h-full rounded-full bg-primary transition-all" style={`width: ${(setupDone / setupSteps.length) * 100}%`}></div>
          </div>
        </div>
        <ol class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {#each setupSteps as step, index}
            <li>
              <a
                href={step.href}
                class="flex h-full gap-3 rounded-[10px] p-3 transition hover:opacity-90"
                style="background: var(--hf-fill)"
              >
                {#if step.done}
                  <CheckCircle2 size={20} class="shrink-0 text-green-500" aria-hidden="true" />
                {:else}
                  <span
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-zinc-500 text-[0.625rem] font-bold text-zinc-400"
                    aria-hidden="true">{index + 1}</span
                  >
                {/if}
                <span class="min-w-0">
                  <span class="block text-[0.8125rem] font-semibold {step.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}"
                    >{step.title}</span
                  >
                  <span class="mt-0.5 block text-xs leading-4 text-zinc-500">{step.detail}</span>
                </span>
              </a>
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    <section class="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="This week">
      <MetricCard
        icon={Clock}
        label="Hunted this week"
        value={formatDuration(summary.huntSeconds)}
        detail={`${summary.sessions} focused session${summary.sessions === 1 ? '' : 's'}`}
        href="/sessions"
      />
      <MetricCard
        icon={Send}
        label="In flight"
        value={String(summary.inFlight)}
        detail={`${summary.submitted} submitted in the last 7 days`}
        href="/findings"
        tone="info"
      />
      <MetricCard
        icon={TrendingUp}
        label="Acceptance"
        value={summary.acceptanceRate == null ? '—' : `${Math.round(summary.acceptanceRate * 100)}%`}
        detail={summary.decided ? `${summary.decided} decided report${summary.decided === 1 ? '' : 's'}` : 'No decisions yet'}
        href="/analytics"
        tone="success"
      />
      <MetricCard
        icon={CircleDollarSign}
        label="Earned this year"
        value={formatMoney(summary.earnedThisYear)}
        detail={`${formatMoney(summary.pending)} pending payout`}
        href="/payouts"
        tone="success"
      />
    </section>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
      <section class="min-w-0" aria-labelledby="attention-heading">
        <div class="mb-2 flex items-baseline justify-between px-1">
          <h2 id="attention-heading" class="text-[1.25rem] font-bold tracking-[-0.015em] text-zinc-50">Needs Attention</h2>
          {#if attention.length > 0}
            <span class="text-xs font-medium text-zinc-500">{attention.length} item{attention.length === 1 ? '' : 's'}</span>
          {/if}
        </div>
        <div class="hf-card overflow-hidden">
          {#if !loaded}
            <div class="space-y-px p-1">
              {#each Array(4) as _}
                <div class="h-14 animate-pulse rounded-lg" style="background: var(--hf-fill)"></div>
              {/each}
            </div>
          {:else if attention.length === 0}
            <div class="flex flex-col items-center px-6 py-10 text-center">
              <CheckCircle2 size={36} strokeWidth={1.6} class="text-green-500" aria-hidden="true" />
              <p class="mt-3 text-[0.9375rem] font-semibold text-zinc-100">You're all caught up</p>
              <p class="mt-1 max-w-sm text-[0.8125rem] text-zinc-500">
                No overdue reports, unsent drafts or pending payouts. A good moment to start a focused session.
              </p>
            </div>
          {:else}
            <ul class="hf-list">
              {#each visibleAttention as item (item.id)}
                <li>
                  <a href={item.href} class="hf-list-row group">
                    <span
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white {toneBg[item.tone]}"
                      aria-hidden="true"
                    >
                      <svelte:component this={kindIcon[item.kind]} size={14} strokeWidth={2.4} />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[0.8125rem] font-medium text-zinc-100">{item.title}</span>
                      <span class="block truncate text-xs text-zinc-500">{item.detail}</span>
                    </span>
                    <ChevronRight size={15} class="shrink-0 text-zinc-600 transition group-hover:text-zinc-400" aria-hidden="true" />
                  </a>
                </li>
              {/each}
            </ul>
            {#if attention.length > 7}
              <button
                type="button"
                class="w-full border-t-[0.5px] border-zinc-900 px-4 py-2.5 text-left text-[0.8125rem] font-medium text-primary"
                on:click={() => (showAllAttention = !showAllAttention)}
              >
                {showAllAttention ? 'Show less' : `Show all ${attention.length}`}
              </button>
            {/if}
          {/if}
        </div>
      </section>

      <div class="min-w-0 space-y-5">
        <section aria-labelledby="continue-heading">
          <h2 id="continue-heading" class="mb-2 px-1 text-[1.25rem] font-bold tracking-[-0.015em] text-zinc-50">
            {timerActive ? 'In Session' : 'Continue'}
          </h2>
          <div class="hf-card p-4">
            {#if timerActive}
              <div class="flex items-center gap-3">
                <span class="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60"></span>
                  <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                </span>
                <p class="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-zinc-100">
                  {continueProgram?.name ?? 'Focused session'}
                </p>
                <p class="font-mono text-[1.375rem] font-semibold tabular-nums text-zinc-50">
                  {formatTimer($timerStore.remainingMs)}
                </p>
              </div>
              <a href="/timer" class="hf-button-secondary mt-3 w-full">Open Session</a>
            {:else if continueProgram}
              <p class="text-xs font-medium text-zinc-500">
                {lastHunted ? `Last hunted ${formatRelativeDate(lastHunted.lastSessionAt)}` : 'Top priority program'}
              </p>
              <p class="mt-0.5 truncate text-[0.9375rem] font-semibold text-zinc-50">{continueProgram.name}</p>
              <p class="truncate text-xs text-zinc-500">
                {platformLabels[continueProgram.platform]} · {priorityLabels[continueProgram.priority]}
              </p>
              <div class="mt-3 flex gap-2">
                <a href={`/timer?target=${continueProgram.id}`} class="hf-button-primary flex-1">
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                  Hunt {continueProgram.name}
                </a>
                <a href={`/programs/${continueProgram.id}`} class="hf-button-secondary">Open</a>
              </div>
            {:else}
              <p class="text-[0.8125rem] text-zinc-500">Add a program to start tracking your hunting.</p>
              <a href="/programs?new=1" class="hf-button-tinted mt-3 w-full">Add Program</a>
            {/if}
          </div>
        </section>

        {#if activePrograms.length > 0}
          <section aria-labelledby="programs-heading">
            <div class="mb-2 flex items-baseline justify-between px-1">
              <h2 id="programs-heading" class="text-[1.25rem] font-bold tracking-[-0.015em] text-zinc-50">Programs</h2>
              <a href="/programs" class="text-[0.8125rem] font-medium text-primary">See All</a>
            </div>
            <ul class="hf-card hf-list">
              {#each activePrograms.slice(0, 5) as program (program.id)}
                <li>
                  <a href={`/programs/${program.id}`} class="hf-list-row group">
                    <FolderKanban size={16} class="shrink-0 text-primary" aria-hidden="true" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[0.8125rem] font-medium text-zinc-100">{program.name}</span>
                      <span class="block truncate text-xs text-zinc-500">
                        {platformLabels[program.platform]} · {program.lastSessionAt
                          ? `hunted ${formatRelativeDate(program.lastSessionAt)}`
                          : 'not hunted yet'}
                      </span>
                    </span>
                    <StatusBadge label={targetStatusLabels[program.status]} tone={statusTone(program.status)} />
                  </a>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if activity.length > 0}
          <section aria-labelledby="activity-heading">
            <h2 id="activity-heading" class="mb-2 px-1 text-[1.25rem] font-bold tracking-[-0.015em] text-zinc-50">
              Recent Activity
            </h2>
            <ul class="hf-card hf-list">
              {#each activity as entry (entry.id)}
                <li>
                  <a href={entry.href} class="hf-list-row">
                    <svelte:component this={activityIcon[entry.kind]} size={15} class="shrink-0 text-zinc-500" aria-hidden="true" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[0.8125rem] text-zinc-100">{entry.title}</span>
                      <span class="block truncate text-xs text-zinc-500">{entry.detail}</span>
                    </span>
                    <time class="shrink-0 text-xs text-zinc-500" datetime={new Date(entry.at).toISOString()}>
                      {formatRelativeDate(entry.at)}
                    </time>
                  </a>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>
    </div>
  </div>
</main>
