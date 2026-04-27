<script lang="ts">
  import { browser } from '$app/environment';
  import {
    noteStore,
    payoutStore,
    reconAssetStore,
    sessionStore,
    submissionStore,
    targetStore,
    timerStore,
    todayMinutesStore
  } from '$lib/stores';
  import type { Note, Platform, Session, Target } from '$lib/types';
  import {
    ArrowRight,
    Cloud,
    DollarSign,
    FileText,
    Play,
    Target as TargetIcon,
    Timer
  } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type WorkflowState = 'done' | 'active' | 'pending';

  interface WorkflowStep {
    number: number;
    title: string;
    detail: string;
    state: WorkflowState;
    meta: string;
  }

  const platformLabels: Record<Platform, string> = {
    hackerone: 'HackerOne',
    bugcrowd: 'Bugcrowd',
    intigriti: 'Intigriti',
    synack: 'Synack',
    yeswehack: 'YesWeHack',
    'self-hosted': 'Self-hosted',
    other: 'Other'
  };
  const LAST_SYNC_KEY = 'huntflow-cloud-last-sync-at';

  let lastSyncAt: number | null = null;
  let selectedWorkflow = 3;
  let workflow: WorkflowStep[] = [];

  function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function sessionDateKey(timestamp: number): string {
    return localDateKey(new Date(timestamp));
  }

  function formatClock(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  }

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }

  function formatMoney(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatTime(timestamp?: number): string {
    if (!timestamp) return '--:--';
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  }

  function formatShortDate(timestamp?: number | null): string {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
      new Date(timestamp)
    );
  }

  function noteExcerpt(note: Note): string {
    return note.content
      .replace(/```[\s\S]*?```/g, ' code ')
      .replace(/[#>*_`[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72);
  }

  function riskLabel(target: Target | undefined): string {
    if (!target) return 'standby';
    if (target.priority <= 1) return 'high';
    if (target.priority === 2) return 'medium';
    return 'low';
  }

  function stepClass(state: WorkflowState, active: boolean): string {
    if (active) return '-mx-3 rounded-[14px] bg-primary/10 px-3 text-primary';
    if (state === 'done') return 'text-primary';
    return 'text-muted-foreground hover:text-foreground';
  }

  function statusText(state: WorkflowState): string {
    if (state === 'done') return 'Done';
    if (state === 'active') return 'In progress';
    return 'Pending';
  }

  function timelineLabel(index: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(Date.now() - (4 - index) * 18 * 60 * 1000)
    );
  }

  function getLastSyncAt(): number | null {
    if (!browser) return null;
    const value = Number(localStorage.getItem(LAST_SYNC_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  onMount(async () => {
    await Promise.all([
      sessionStore.load(),
      targetStore.load(),
      noteStore.load(),
      payoutStore.load(),
      submissionStore.load(),
      reconAssetStore.load()
    ]);
    lastSyncAt = getLastSyncAt();
  });

  $: todayKey = localDateKey(new Date());
  $: completedSessions = $sessionStore
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
  $: todaySessions = completedSessions.filter((session) => sessionDateKey(session.startedAt) === todayKey);
  $: activeTargets = $targetStore
    .filter((target) => target.status !== 'archived' && target.status !== 'closed')
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (b.lastSessionAt ?? b.updatedAt) - (a.lastSessionAt ?? a.updatedAt);
    });
  $: activeSession = $timerStore.sessionId ? $sessionStore.find((session) => session.id === $timerStore.sessionId) : undefined;
  // Resolution order: the live timer's target → the highest-priority active
  // target → undefined. Previously this fell through to `$targetStore[0]`,
  // which happily surfaced an archived/closed target on the dashboard when
  // the user had no active programs left.
  $: activeTarget =
    (activeSession ? $targetStore.find((target) => target.id === activeSession.targetId) : undefined) ??
    activeTargets[0];
  $: targetNotes = activeTarget ? $noteStore.filter((note) => note.targetId === activeTarget.id) : $noteStore;
  $: targetReconAssets = activeTarget
    ? $reconAssetStore.filter((asset) => asset.targetId === activeTarget.id)
    : [];
  $: targetReconCount = targetReconAssets.length;
  $: targetReconVulnerable = targetReconAssets.filter((asset) => asset.status === 'vulnerable').length;
  $: recentNotes = [...$noteStore].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  $: activeTargetNotes = [...targetNotes].sort((a, b) => b.updatedAt - a.updatedAt);
  $: needsReport = targetNotes.some((note) => note.tags.includes('needs-report'));
  $: reportReady = needsReport || targetNotes.length > 1;
  $: paidTotal = $payoutStore.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amount, 0);
  $: pendingTotal = $payoutStore
    .filter((payout) => payout.status !== 'paid')
    .reduce((sum, payout) => sum + payout.amount, 0);
  $: timerActive = $timerStore.status === 'running' || $timerStore.status === 'paused' || $timerStore.status === 'completed';
  $: displayTime = timerActive ? formatClock(Math.ceil($timerStore.remainingMs / 1000)) : formatClock($todayMinutesStore * 60);
  $: workflow = [
    {
      number: 1,
      title: 'Recon & discovery',
      detail:
        activeTarget && targetReconCount > 0
          ? `${targetReconCount} asset${targetReconCount === 1 ? '' : 's'} mapped${targetReconVulnerable > 0 ? ` · ${targetReconVulnerable} flagged` : ''}`
          : activeTarget
            ? `${platformLabels[activeTarget.platform]} scope queued — import recon assets`
            : 'Add a target to start the chain',
      state: activeTarget && targetReconCount > 0 ? 'done' : 'active',
      meta:
        activeTarget && targetReconCount > 0
          ? 'Recon mapped'
          : activeTarget
            ? 'Recon pending'
            : 'Missing target'
    },
    {
      number: 2,
      title: 'Vulnerability signal',
      detail: targetNotes.length > 0 ? `${targetNotes.length} evidence note${targetNotes.length === 1 ? '' : 's'} attached` : 'Capture first payload or behavior',
      state: targetNotes.length > 0 ? 'done' : activeTarget ? 'active' : 'pending',
      meta: targetNotes.length > 0 ? 'Evidence' : 'Waiting'
    },
    {
      number: 3,
      title: 'Exploit & validate',
      detail: activeTargetNotes[0] ? noteExcerpt(activeTargetNotes[0]) || activeTargetNotes[0].title : 'Confirm impact and data access',
      state: targetNotes.length > 0 && !reportReady ? 'active' : reportReady ? 'done' : 'pending',
      meta: targetNotes.some((note) => note.tags.includes('critical') || note.tags.includes('high')) ? 'Elevated' : 'Analysis'
    },
    {
      number: 4,
      title: 'Document & report',
      detail: reportReady ? 'Report builder has enough source material' : 'Create clear reproduction steps',
      state: reportReady ? 'active' : 'pending',
      meta: reportReady ? 'Ready' : 'Pending'
    },
    {
      number: 5,
      title: 'Submit & track',
      detail:
        $submissionStore.length > 0
          ? `${$submissionStore.length} report${$submissionStore.length === 1 ? '' : 's'} · ${$submissionStore.filter((s) => ['submitted', 'triaged', 'accepted'].includes(s.status)).length} in triage`
          : $payoutStore.length > 0
            ? `${$payoutStore.length} legacy payout record${$payoutStore.length === 1 ? '' : 's'}`
            : 'Monitor triage, severity, and bounty pipeline',
      state: ($submissionStore.length > 0 || $payoutStore.length > 0) ? 'done' : 'pending',
      meta: $submissionStore.length > 0 ? 'Tracked' : 'Pending'
    }
  ];
  $: selectedStep = workflow.find((step) => step.number === selectedWorkflow) ?? workflow[2];
  $: timelineSessions = todaySessions.slice(0, 4);
  $: timelineEvents =
    timelineSessions.length > 0
      ? timelineSessions.map((session) => ({
          label: formatTime(session.startedAt),
          title: $targetStore.find((target) => target.id === session.targetId)?.name ?? 'Session capture'
        }))
      : [
          { label: timelineLabel(1), title: 'Ready state' },
          { label: timelineLabel(2), title: activeTarget ? 'Target selected' : 'Add target' },
          { label: timelineLabel(3), title: targetNotes.length > 0 ? 'Evidence available' : 'Capture evidence' },
          { label: timelineLabel(4), title: reportReady ? 'Report ready' : 'Validate impact' }
        ];
</script>

<svelte:head>
  <title>Bug bounty workspace | HuntFlow</title>
  <meta
    name="description"
    content="HuntFlow is a focused bug bounty workspace for targets, timed hunt rooms, evidence notes, report prep, cloud sync, and payouts."
  />
</svelte:head>

<main class="hf-page overflow-hidden">
  <div class="mx-auto max-w-[1500px] space-y-6">
    <header class="op-panel rounded-[24px] px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
      <div class="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-center">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Local vault · Pro sync ready
          </div>
          <h1 class="mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            Bug bounty work,
            <span class="text-primary">without the lost proof.</span>
          </h1>
          <p class="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            HuntFlow keeps targets, timed rooms, evidence, reports, payouts, and cloud sync in one focused workspace for researchers who ship clear findings.
          </p>

          <div class="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span class="inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full border border-primary bg-primary/30"></span>Encrypted local-first notes</span>
            <span class="inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full border border-primary bg-primary/30"></span>Coordinated report prep</span>
            <span class="inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full border border-primary bg-primary/30"></span>Payout tracking</span>
          </div>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="/timer" class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]">
              <Play size={18} aria-hidden="true" />
              Start hunt room
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a href="/notes/new" class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] border border-border bg-background/40 px-5 text-sm font-medium text-foreground transition hover:bg-muted">
              Capture evidence
            </a>
          </div>
        </div>

        <div class="rounded-[24px] border border-border/80 bg-black/45 p-4 shadow-dark-lg">
          <div class="flex items-center justify-between border-b border-border/70 pb-3">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-red-400"></span>
              <span class="h-2 w-2 rounded-full bg-amber-300"></span>
              <span class="h-2 w-2 rounded-full bg-primary"></span>
              <span class="op-mono ml-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">hunt-room · {activeTarget?.name ?? 'unassigned'}</span>
            </div>
            <span class="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">
              {timerActive ? 'Live' : 'Standby'}
            </span>
          </div>
          <div class="op-mono space-y-3 py-4 text-xs leading-6">
            <p class="text-muted-foreground">$ recon target={activeTarget?.scope || activeTarget?.name || 'select-target'}</p>
            <p class="text-primary">[+] {activeTarget ? `${platformLabels[activeTarget.platform]} scope loaded` : 'add a program to begin'}</p>
            <p class="text-primary">[+] {targetNotes.length} evidence note{targetNotes.length === 1 ? '' : 's'} attached</p>
            <p class="text-muted-foreground">@hunter0x · timer {timerActive ? $timerStore.status : 'ready'} · {displayTime}</p>
            <p class="text-amber-300">POST /report/draft → {reportReady ? 'ready' : 'waiting-for-proof'}</p>
            <p class="text-primary">[$] paid {formatMoney(paidTotal)} · pending {formatMoney(pendingTotal)}</p>
          </div>
          <div class="flex flex-wrap gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1"><Cloud size={14} aria-hidden="true" /> sync {formatShortDate(lastSyncAt)}</span>
            <span>{activeTargets.length} active target{activeTargets.length === 1 ? '' : 's'}</span>
            <span>{formatMinutes($todayMinutesStore)} today</span>
          </div>
        </div>
      </div>
    </header>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="op-panel p-5">
        <p class="op-kicker">Today</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">{formatMinutes($todayMinutesStore)}</p>
        <p class="mt-1 text-sm text-muted-foreground">{todaySessions.length} completed session{todaySessions.length === 1 ? '' : 's'}</p>
      </article>
      <article class="op-panel p-5">
        <p class="op-kicker">Targets</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">{activeTargets.length}</p>
        <p class="mt-1 truncate text-sm text-muted-foreground">{activeTarget?.name ?? 'No active target selected'}</p>
      </article>
      <article class="op-panel p-5">
        <p class="op-kicker">Evidence</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">{targetNotes.length}</p>
        <p class="mt-1 text-sm text-muted-foreground">{reportReady ? 'Report path has source material' : 'Capture proof before drafting'}</p>
      </article>
      <article class="op-panel p-5">
        <p class="op-kicker">Payouts</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">{formatMoney(paidTotal)}</p>
        <p class="mt-1 text-sm text-muted-foreground">{formatMoney(pendingTotal)} pending</p>
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(360px,0.92fr)_minmax(460px,1.08fr)_320px]">
      <section class="op-panel p-5 sm:p-6">
        <div class="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p class="op-kicker">Live hunt room</p>
            <h2 class="mt-2 text-2xl font-semibold text-foreground">{activeTarget?.name ?? 'No target selected'}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{activeTarget ? platformLabels[activeTarget.platform] : 'Add a program to attach sessions and proof.'}</p>
          </div>
          <span class="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase text-amber-200">
            {riskLabel(activeTarget)}
          </span>
        </div>

        <div class="op-radar mt-6 flex min-h-[280px] items-center justify-center p-6">
          <div class="relative z-10 w-full">
            <p class="text-sm font-medium text-muted-foreground">{timerActive ? 'Timer remaining' : 'Time logged today'}</p>
            <p class="op-mono mt-3 text-5xl font-semibold text-primary sm:text-6xl">{displayTime}</p>
            <div class="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p class="text-muted-foreground">Scope</p>
                <p class="mt-1 truncate text-foreground">{activeTarget?.scope || 'Define scope'}</p>
              </div>
              <div>
                <p class="text-muted-foreground">Started</p>
                <p class="mt-1 text-foreground">{formatTime(activeSession?.startedAt ?? todaySessions[0]?.startedAt)}</p>
              </div>
              <div>
                <p class="text-muted-foreground">Status</p>
                <p class="mt-1 capitalize text-foreground">{timerActive ? $timerStore.status : 'ready'}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="relative z-10 mt-6 border-t border-border/70 pt-5">
          <p class="op-kicker">Room objective</p>
          <p class="mt-3 text-sm leading-6 text-muted-foreground">
            {activeTarget
              ? `Validate the strongest signal for ${activeTarget.name}, capture proof, and move the report package forward.`
              : 'Create or select a target, then start a focused hunt room.'}
          </p>
        </div>
      </section>

      <section class="op-panel p-5 sm:p-6">
        <div class="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p class="op-kicker">Evidence workflow</p>
            <h2 class="mt-2 text-2xl font-semibold text-foreground">Exploit chain status</h2>
          </div>
          <a href="/notes/new" class="rounded-[14px] border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20">
            New note
          </a>
        </div>

        <div class="relative z-10 mt-6 divide-y divide-border/70 border-y border-border/70">
          {#each workflow as step}
            <button
              type="button"
              class="group grid w-full grid-cols-[42px_1fr_auto] items-start gap-3 py-4 text-left transition {stepClass(
                step.state,
                selectedWorkflow === step.number
              )}"
              on:click={() => (selectedWorkflow = step.number)}
            >
              <span class="flex h-8 min-h-[32px] w-8 items-center justify-center rounded-[8px] border border-current/35 bg-background/40 text-sm font-semibold">
                {step.number}
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-foreground">{step.title}</span>
                <span class="mt-1 block truncate text-sm text-muted-foreground">{step.detail}</span>
              </span>
              <span class="hidden rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:block">
                {statusText(step.state)}
              </span>
            </button>
          {/each}
        </div>

        <div class="relative z-10 mt-6 grid gap-5 border-b border-border/70 pb-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p class="op-kicker op-kicker-amber">{selectedStep.meta}</p>
            <h3 class="mt-2 text-xl font-semibold text-foreground">{selectedStep.title}</h3>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">{selectedStep.detail}</p>
          </div>
          <a href={selectedStep.number >= 4 ? '/notes' : '/timer'} class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] border border-border bg-muted/50 px-4 text-sm text-foreground transition hover:bg-muted">
            Open
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <div class="relative z-10 mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-muted-foreground">Evidence</p>
            <p class="mt-1 text-2xl font-semibold text-primary">{targetNotes.length}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Sessions</p>
            <p class="mt-1 text-2xl font-semibold text-foreground">{todaySessions.length}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Last capture</p>
            <p class="mt-2 truncate text-foreground">{formatTime(activeTargetNotes[0]?.updatedAt)}</p>
          </div>
        </div>
      </section>

      <aside class="grid gap-4">
        <section class="op-panel p-5">
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <p class="op-kicker">Cloud sync</p>
              <p class="mt-3 text-sm text-muted-foreground">Last sync</p>
              <p class="mt-1 text-lg font-semibold text-primary">{formatShortDate(lastSyncAt)}</p>
            </div>
            <Cloud class="text-primary" size={28} aria-hidden="true" />
          </div>
          <a href="/settings" class="relative z-10 mt-5 flex min-h-[44px] items-center justify-between border-t border-border/70 pt-3 text-sm text-foreground transition hover:text-primary">
            View sync settings
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>

        <section class="op-panel p-5">
          <div class="relative z-10">
            <p class="op-kicker">Bounty desk</p>
            <div class="mt-4 flex items-end justify-between gap-4">
              <div>
                <p class="text-sm text-muted-foreground">Paid</p>
                <p class="mt-1 text-3xl font-semibold text-primary">{formatMoney(paidTotal)}</p>
              </div>
              <DollarSign class="text-primary/70" size={28} aria-hidden="true" />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm">
              <div>
                <p class="text-muted-foreground">Pending</p>
                <p class="text-foreground">{formatMoney(pendingTotal)}</p>
              </div>
              <div>
                <p class="text-muted-foreground">Records</p>
                <p class="text-foreground">{$payoutStore.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="op-panel op-panel-amber p-5">
          <div class="relative z-10">
            <p class="op-kicker op-kicker-amber">Next action</p>
            <h2 class="mt-3 text-xl font-semibold text-foreground">
              {reportReady ? 'Draft the report package' : activeTarget ? 'Validate current signal' : 'Add a target'}
            </h2>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              {reportReady
                ? 'Turn captured notes into reproduction steps and impact language.'
                : activeTarget
                  ? `Continue against ${activeTarget.name} and capture proof.`
                  : 'Create a target so sessions and evidence have a home.'}
            </p>
            <a href={reportReady ? '/notes' : activeTarget ? '/timer' : '/targets'} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/15">
              Open path
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      </aside>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section class="op-panel p-5 sm:p-6">
        <div class="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <p class="op-kicker">Session timeline</p>
            <div class="mt-6 pb-2">
              <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {#each timelineEvents as event, index}
                  <div class="relative">
                    <div class="absolute left-4 right-[-16px] top-4 hidden h-px bg-border sm:block {index === timelineEvents.length - 1 ? 'sm:hidden' : ''}"></div>
                    <div class="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <span class="h-2 w-2 rounded-full bg-primary"></span>
                    </div>
                    <p class="op-mono mt-3 text-xs text-muted-foreground">{event.label}</p>
                    <p class="mt-1 text-sm leading-5 text-foreground">{event.title}</p>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <div class="border-t border-border/70 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div class="flex items-center justify-between gap-3">
              <p class="op-kicker">Recent captures</p>
              <a href="/notes" class="text-sm text-muted-foreground transition hover:text-primary">Open vault</a>
            </div>
            <div class="mt-4 divide-y divide-border/70 border-y border-border/70">
              {#each recentNotes as note}
                <a href={`/notes/${note.id}`} class="flex min-h-[64px] items-center gap-3 py-3 text-sm transition hover:text-primary">
                  <FileText class="shrink-0 text-primary" size={18} aria-hidden="true" />
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-foreground">{note.title}</span>
                    <span class="mt-1 block text-xs text-muted-foreground">{formatTime(note.updatedAt)}</span>
                  </span>
                </a>
              {:else}
                <a href="/notes/new" class="flex min-h-[64px] items-center text-sm text-muted-foreground transition hover:text-primary">
                  Capture the first evidence item
                </a>
              {/each}
            </div>
          </div>
        </div>
      </section>

      <section class="op-panel p-5">
        <div class="relative z-10">
          <p class="op-kicker">Quick links</p>
          <div class="mt-4 divide-y divide-border/70 border-y border-border/70">
            <a href="/notes/new" class="flex min-h-[48px] items-center justify-between text-sm text-foreground transition hover:text-primary">
              <span class="flex items-center gap-2"><FileText size={16} aria-hidden="true" /> New note</span>
              <span class="op-mono text-xs text-muted-foreground">N</span>
            </a>
            <a href="/timer" class="flex min-h-[48px] items-center justify-between text-sm text-foreground transition hover:text-primary">
              <span class="flex items-center gap-2"><Timer size={16} aria-hidden="true" /> Start timer</span>
              <span class="op-mono text-xs text-muted-foreground">Space</span>
            </a>
            <a href="/targets" class="flex min-h-[48px] items-center justify-between text-sm text-foreground transition hover:text-primary">
              <span class="flex items-center gap-2"><TargetIcon size={16} aria-hidden="true" /> Add target</span>
              <span class="op-mono text-xs text-muted-foreground">T</span>
            </a>
            <a href="/income" class="flex min-h-[48px] items-center justify-between text-sm text-foreground transition hover:text-primary">
              <span class="flex items-center gap-2"><DollarSign size={16} aria-hidden="true" /> Log payout</span>
              <span class="op-mono text-xs text-muted-foreground">P</span>
            </a>
          </div>
        </div>
      </section>
    </section>
  </div>
</main>
