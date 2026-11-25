<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import SessionCompleteModal from '$lib/components/timer/SessionCompleteModal.svelte';
  import TargetSelector from '$lib/components/timer/TargetSelector.svelte';
  import TemplateSelector from '$lib/components/timer/TemplateSelector.svelte';
  import TimerControls from '$lib/components/timer/TimerControls.svelte';
  import TimerRing from '$lib/components/timer/TimerRing.svelte';
  import { templateDB } from '$lib/db/templates';
  import {
    bestStreakStore,
    sessionStore,
    streakStore,
    targetStore,
    timerStore
  } from '$lib/stores';
  import type { NoteTemplate, Session, SessionTag, Target } from '$lib/types';
  import { onDestroy, onMount } from 'svelte';

  const durationOptions = [
    { label: '15m', value: 15 },
    { label: '25m', value: 25 },
    { label: '45m', value: 45 },
    { label: '60m', value: 60 },
    { label: 'Custom', value: 0 }
  ];

  let selectedTargetId = '';
  let selectedTemplateId = '';
  let selectedDuration = 25;
  let customMinutes = 30;
  let templates: NoteTemplate[] = [];
  let error = '';
  let completionModalOpen = false;
  let completionSessionId = '';
  let completionRemainingMs = 0;
  /**
   * When the user manually stops via `completeSession()`, we capture the
   * timer's remaining time *before* `timerStore.complete()` zeroes it.
   * The reactive completion block reads this so it doesn't record the full
   * planned duration for an early stop. `null` means "natural tick to 0".
   */
  let pendingCompletionRemainingMs: number | null = null;
  let soundPlayedForSessionId = '';
  let unsubscribers: Array<() => void> = [];

  $: activeSession = $timerStore.sessionId
    ? $sessionStore.find((session) => session.id === $timerStore.sessionId)
    : undefined;
  $: selectedTarget = selectedTargetId
    ? $targetStore.find((target) => target.id === selectedTargetId)
    : undefined;
  $: activeTarget = activeSession
    ? $targetStore.find((target) => target.id === activeSession?.targetId)
    : selectedTarget;
  $: activeTemplateId = activeSession?.templateId ?? selectedTemplateId;
  $: activeTemplate = activeTemplateId
    ? templates.find((template) => template.id === activeTemplateId)
    : undefined;
  $: durationMinutes = selectedDuration === 0 ? customMinutes : selectedDuration;
  $: canEditSetup = $timerStore.status === 'idle';
  $: completedCount = $sessionStore.filter((session) => session.status === 'completed').length;
  $: totalSessionCount = $sessionStore.length;

  $: if (activeSession && !selectedTargetId) {
    selectedTargetId = activeSession.targetId;
  }

  $: if (activeSession?.templateId && !selectedTemplateId) {
    selectedTemplateId = activeSession.templateId;
  }

  $: if (
    browser &&
    $timerStore.status === 'completed' &&
    $timerStore.sessionId &&
    completionSessionId !== $timerStore.sessionId
  ) {
    completionSessionId = $timerStore.sessionId;
    // Prefer the value captured by `completeSession()` BEFORE it zeroed the
    // timer; fall back to the live store value (which is correct for natural
    // tick-down completion).
    completionRemainingMs = pendingCompletionRemainingMs ?? $timerStore.remainingMs;
    pendingCompletionRemainingMs = null;
    completionModalOpen = true;
    // Persist the session as completed up-front so a tab close before the
    // user fills in the Save modal still records the run. The modal then
    // enriches the row with quickNote + tags rather than being the only
    // path to mark it complete.
    void persistCompletionEarly($timerStore.sessionId, completionRemainingMs);
    if (soundPlayedForSessionId !== $timerStore.sessionId) {
      soundPlayedForSessionId = $timerStore.sessionId;
      playCompleteSound();
    }
  }

  onMount(async () => {
    templates = await templateDB.getAll();
    await Promise.all([targetStore.load(), sessionStore.load()]);
    const targetFromUrl = $page.url.searchParams.get('target');
    if (targetFromUrl && targetStore.getById(targetFromUrl)) {
      selectedTargetId = targetFromUrl;
    }

    unsubscribers = [
      timerStore.subscribe((state) => {
        if (state.status === 'running' && state.sessionId) {
          const session = sessionStore.getById(state.sessionId);
          if (session && session.status === 'paused') {
            void sessionStore.put({ ...session, status: 'running' });
          }
        }
      })
    ];
  });

  onDestroy(() => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  });

  function durationSeconds(): number {
    return Math.max(1, Math.round(durationMinutes * 60));
  }

  /**
   * Compute the *focused* time spent on a session — i.e. what the timer has
   * actually counted down — as opposed to the wall-clock duration since
   * `startedAt`. This excludes time the user spent paused, which is what
   * we want stored as `durationActual`.
   *
   * Uses the live `endTime` when running (so it's always exact) and the
   * stored `remainingMs` when paused (which the timer freezes on pause).
   */
  function actualSecondsFromTimer(session: Session): number {
    const state = $timerStore;
    const remainingMs =
      state.status === 'running' && state.endTime
        ? Math.max(state.endTime - Date.now(), 0)
        : Math.max(state.remainingMs, 0);
    const elapsed = Math.max(0, session.durationPlanned - Math.ceil(remainingMs / 1000));
    return Math.min(elapsed, session.durationPlanned);
  }

  async function startSession() {
    error = '';

    if (!selectedTargetId) {
      error = 'Select or add a target before starting.';
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      error = 'Session duration must be greater than zero.';
      return;
    }

    const plannedSeconds = durationSeconds();
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      targetId: selectedTargetId,
      templateId: selectedTemplateId || undefined,
      durationPlanned: plannedSeconds,
      durationActual: 0,
      startedAt: now,
      status: 'running',
      tags: []
    };

    await sessionStore.put(session);
    timerStore.start(plannedSeconds * 1000, session.id);
  }

  async function pauseSession() {
    if (activeSession) {
      await sessionStore.put({
        ...activeSession,
        status: 'paused',
        // Use timer countdown — wall-clock elapsed includes prior pause
        // intervals and would over-report focused time on a 2nd pause.
        durationActual: actualSecondsFromTimer(activeSession)
      });
    }
    timerStore.pause();
  }

  async function resumeSession() {
    if (activeSession) {
      await sessionStore.put({ ...activeSession, status: 'running' });
    }
    timerStore.resume();
  }

  function completeSession() {
    // Capture the live timer remainder BEFORE `timerStore.complete()` zeroes
    // it, so a manual early stop records the right `durationActual` instead
    // of always recording the full planned duration.
    pendingCompletionRemainingMs = $timerStore.remainingMs;
    timerStore.complete();
  }

  // Mark the session as `completed` in IndexedDB the moment the timer rings,
  // before the user interacts with the Save modal. Idempotent: skips if the
  // session is already saved as completed/abandoned. Survives tab close.
  async function persistCompletionEarly(sessionId: string, remainingMs: number): Promise<void> {
    const session = sessionStore.getById(sessionId);
    if (!session) return;
    if (session.status === 'completed' || session.status === 'abandoned') return;

    const actualSeconds =
      remainingMs > 0
        ? Math.max(1, session.durationPlanned - Math.ceil(remainingMs / 1000))
        : session.durationPlanned;

    await sessionStore.put({
      ...session,
      status: 'completed',
      durationActual: Math.min(actualSeconds, session.durationPlanned),
      endedAt: Date.now()
    });
    await sessionStore.persistNow();
    await updateTargetAfterCompletion(session.targetId, session.startedAt);
  }

  async function abandonSession() {
    if (!activeSession) {
      timerStore.reset(durationSeconds() * 1000);
      return;
    }

    const focused = actualSecondsFromTimer(activeSession);
    if (focused > 300 && !confirm('Abandon this session? It will not count toward stats.')) {
      return;
    }

    await sessionStore.put({
      ...activeSession,
      status: 'abandoned',
      durationActual: focused,
      endedAt: Date.now()
    });
    await sessionStore.persistNow();
    timerStore.reset(durationSeconds() * 1000);
    completionModalOpen = false;
    completionSessionId = '';
  }

  async function saveCompletedSession(event: CustomEvent<{ quickNote?: string; tags: SessionTag[] }>) {
    if (!activeSession) return;

    const wasAlreadyCompleted = activeSession.status === 'completed';

    const actualSeconds =
      completionRemainingMs > 0
        ? Math.max(1, activeSession.durationPlanned - Math.ceil(completionRemainingMs / 1000))
        : activeSession.durationPlanned;

    const completedSession: Session = {
      ...activeSession,
      status: 'completed',
      durationActual: Math.min(actualSeconds, activeSession.durationPlanned),
      endedAt: activeSession.endedAt ?? Date.now(),
      quickNote: event.detail.quickNote,
      tags: event.detail.tags
    };

    await sessionStore.put(completedSession);
    await sessionStore.persistNow();
    // Only bump the target's sessionCount if `persistCompletionEarly` didn't
    // already do it. Otherwise saving via the modal would double-count.
    if (!wasAlreadyCompleted) {
      await updateTargetAfterCompletion(completedSession.targetId, completedSession.startedAt);
    }
    timerStore.reset(durationSeconds() * 1000);
    completionModalOpen = false;
    completionSessionId = '';
    completionRemainingMs = 0;
  }

  async function updateTargetAfterCompletion(targetId: string, sessionStartedAt: number) {
    const target = targetStore.getById(targetId);
    if (!target) return;

    const nextTarget: Target = {
      ...target,
      status: target.status === 'recon' ? 'testing' : target.status,
      lastSessionAt: sessionStartedAt,
      sessionCount: target.sessionCount + 1,
      updatedAt: Date.now()
    };

    await targetStore.put(nextTarget);
  }

  function dismissCompleteModal() {
    completionModalOpen = false;
  }

  function resetTimer() {
    completionModalOpen = false;
    completionSessionId = '';
    completionRemainingMs = 0;
    pendingCompletionRemainingMs = null;
    timerStore.reset(durationSeconds() * 1000);
  }

  function playCompleteSound() {
    try {
      type AudioContextConstructor = new (contextOptions?: AudioContextOptions) => AudioContext;
      const audioWindow = window as Window & { webkitAudioContext?: AudioContextConstructor };
      const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.22);
      oscillator.addEventListener('ended', () => void context.close());
    } catch {
      // Sound is optional and may be blocked by browser autoplay policy.
    }
  }
</script>

<svelte:head>
  <title>Focus Timer | HuntFlow</title>
  <meta name="description" content="Start a focused bug bounty hunting session." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-5xl">
    <header class="hf-page-header">
      <div>
        <h1 class="hf-title">Timer</h1>
        <p class="hf-description">Time-box your testing. Completed sessions feed your streak and analytics.</p>
      </div>
      <nav class="hf-segmented" aria-label="Sessions">
        <a href="/timer" class="hf-segment hf-segment-active px-4" aria-current="page">Timer</a>
        <a href="/sessions" class="hf-segment px-4">History</a>
      </nav>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section class="hf-card flex flex-col items-center px-4 py-8 sm:px-8">
        <TimerRing remainingMs={$timerStore.remainingMs} totalMs={$timerStore.totalMs} status={$timerStore.status} />

        <p class="mt-5 text-[0.9375rem] font-semibold text-zinc-100">
          {activeTarget?.name ?? 'Choose a program to start'}
        </p>
        <p class="mt-0.5 text-xs text-zinc-500">
          {activeTemplate?.name ? `${activeTemplate.name} · ` : ''}Session #{totalSessionCount +
            ($timerStore.status === 'idle' ? 1 : 0)} · {completedCount} completed · {$streakStore}-day streak (best {$bestStreakStore})
        </p>

        {#if canEditSetup}
          <fieldset class="mt-6 w-full max-w-md" disabled={!canEditSetup}>
            <legend class="sr-only">Duration</legend>
            <div class="flex flex-wrap items-center justify-center gap-2">
              {#each durationOptions as option}
                <button
                  type="button"
                  class="h-9 min-w-[3.5rem] rounded-full px-3.5 text-[0.8125rem] font-semibold tabular-nums transition {selectedDuration ===
                  option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-zinc-300 hover:text-zinc-100'}"
                  style={selectedDuration === option.value ? '' : 'background: var(--hf-fill)'}
                  aria-pressed={selectedDuration === option.value}
                  on:click={() => (selectedDuration = option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
            {#if selectedDuration === 0}
              <label class="mx-auto mt-3 flex max-w-[12rem] items-center gap-2">
                <span class="text-xs font-medium text-zinc-500">Minutes</span>
                <input bind:value={customMinutes} type="number" min="1" max="240" class="hf-input text-center" />
              </label>
            {/if}
          </fieldset>
        {/if}

        <div class="mt-7">
          <TimerControls
            status={$timerStore.status}
            canStart={Boolean(selectedTargetId)}
            on:start={startSession}
            on:pause={pauseSession}
            on:resume={resumeSession}
            on:abandon={abandonSession}
            on:complete={completeSession}
            on:reset={resetTimer}
          />
        </div>

        {#if error}
          <p class="mt-4 rounded-lg bg-red-500/[0.12] px-3 py-2 text-[0.8125rem] text-red-400" role="alert">{error}</p>
        {/if}
      </section>

      <aside class="hf-card space-y-4 self-start p-4" aria-label="Session setup">
        <h2 class="hf-section-title">Setup</h2>
        <TargetSelector bind:selectedTargetId disabled={!canEditSetup} />
        <TemplateSelector bind:selectedTemplateId disabled={!canEditSetup} />
        {#if !canEditSetup}
          <p class="text-xs text-zinc-500">Setup is locked while a session is running.</p>
        {/if}
      </aside>
    </div>
  </div>
</main>

<SessionCompleteModal
  open={completionModalOpen}
  targetName={activeTarget?.name ?? ''}
  on:save={saveCompletedSession}
  on:dismiss={dismissCompleteModal}
/>
