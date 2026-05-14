<script lang="ts">
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { noteStore, sessionStore, targetStore, timerStore } from '$lib/stores';
  import type { Note, Session, Target } from '$lib/types';
  import { formatDate, formatDuration, formatTimer, platformLabels, statusTone } from '$lib/utils/workspace';
  import { Clock, FileText, Plus, ShieldAlert, Timer } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let loaded = false;
  let quickNote = '';

  onMount(async () => {
    await Promise.all([sessionStore.load(), targetStore.load(), noteStore.load()]);
    loaded = true;
  });

  function programFor(id: string): Target | undefined {
    return $targetStore.find((program) => program.id === id);
  }

  async function saveQuickNote(): Promise<void> {
    if (!activeSession || !quickNote.trim()) return;
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: `Session note - ${programFor(activeSession.targetId)?.name ?? 'Hunt session'}`,
      content: quickNote.trim(),
      targetId: activeSession.targetId,
      sessionId: activeSession.id,
      tags: ['session'],
      createdAt: now,
      updatedAt: now
    };
    await noteStore.put(note);
    await noteStore.persistNow();
    quickNote = '';
  }

  function completeActiveSession(): void {
    timerStore.complete();
  }

  $: completedSessions = $sessionStore.filter((session) => session.status === 'completed');
  $: activeSession = $timerStore.sessionId
    ? $sessionStore.find((session) => session.id === $timerStore.sessionId)
    : $sessionStore.find((session) => session.status === 'running' || session.status === 'paused');
  $: activeProgram = activeSession ? programFor(activeSession.targetId) : undefined;
  $: totalSeconds = completedSessions.reduce((sum, session) => sum + session.durationActual, 0);
  $: todayStart = new Date().setHours(0, 0, 0, 0);
  $: todaySessions = completedSessions.filter((session) => session.startedAt >= todayStart);
  $: recentSessions = [...$sessionStore].sort((a, b) => b.startedAt - a.startedAt);
  $: sessionNotes = activeSession ? $noteStore.filter((note) => note.sessionId === activeSession?.id) : [];
</script>

<svelte:head>
  <title>Sessions | HuntFlow bug bounty command center</title>
  <meta name="description" content="Timed bug bounty hunt sessions with goals, quick notes, evidence links, and outcomes." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Sessions</p>
        <h1 class="hf-title">Focused hunt sessions</h1>
        <p class="hf-description">
          Start a clean block, capture notes while testing, and review what worked when the session ends.
        </p>
      </div>
      <a href="/timer" class="hf-button-primary">
        <Plus size={17} aria-hidden="true" />
        New Session
      </a>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={Timer} label="Total sessions" value={String($sessionStore.length)} detail="All local sessions" />
      <MetricCard icon={Clock} label="Completed" value={String(completedSessions.length)} detail={formatDuration(totalSeconds)} />
      <MetricCard icon={Clock} label="Today" value={String(todaySessions.length)} detail={formatDuration(todaySessions.reduce((sum, session) => sum + session.durationActual, 0))} />
      <MetricCard icon={FileText} label="Session notes" value={String($noteStore.filter((note) => note.sessionId).length)} detail="Linked to timed work" />
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <article class="hf-card p-6">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="hf-eyebrow">Active session</p>
            <h2 class="mt-2 text-2xl font-semibold text-zinc-50">
              {activeProgram?.name ?? 'No active session'}
            </h2>
            <p class="mt-2 text-sm text-zinc-500">
              {activeProgram ? `${platformLabels[activeProgram.platform]} · ${activeSession?.status}` : 'Start a focused session from the timer.'}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-right">
            <p class="text-xs text-zinc-500">Timer</p>
            <p class="mt-1 font-mono text-4xl font-semibold text-zinc-50">
              {$timerStore.status === 'running' || $timerStore.status === 'paused' ? formatTimer($timerStore.remainingMs) : '00:00'}
            </p>
          </div>
        </div>

        {#if activeSession}
          <div class="mt-6 grid gap-4 lg:grid-cols-3">
            <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p class="hf-label">Current target</p>
              <p class="mt-2 text-sm text-zinc-200">{activeProgram?.name ?? 'Missing program'}</p>
            </div>
            <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p class="hf-label">Goal</p>
              <p class="mt-2 text-sm text-zinc-500">{activeSession.quickNote ?? 'Capture a goal in quick notes or the completion summary.'}</p>
            </div>
            <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p class="hf-label">Notes created</p>
              <p class="mt-2 font-mono text-lg text-zinc-100">{sessionNotes.length}</p>
            </div>
          </div>

          <div class="mt-5 grid gap-3">
            <label>
              <span class="hf-label">Quick note input</span>
              <textarea bind:value={quickNote} class="hf-input mt-2 min-h-[110px]" placeholder="Observation, payload result, evidence reminder, next action..." />
            </label>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="hf-button-secondary" on:click={saveQuickNote}>Save quick note</button>
              <a href={`/assets?target=${activeSession.targetId}&session=${activeSession.id}`} class="hf-button-secondary">Add evidence</a>
              <a href={`/findings?target=${activeSession.targetId}&new=1`} class="hf-button-secondary">
                <ShieldAlert size={16} aria-hidden="true" />
                Add finding
              </a>
              <button type="button" class="hf-button-primary" on:click={completeActiveSession}>End session</button>
            </div>
          </div>
        {:else}
          <div class="mt-6 rounded-xl border border-dashed border-zinc-800 p-8 text-center">
            <p class="text-sm font-medium text-zinc-300">No active timer</p>
            <p class="mt-1 text-sm text-zinc-500">Start a session when you begin testing a target.</p>
            <a href="/timer" class="hf-button-primary mt-5">Open Timer</a>
          </div>
        {/if}
      </article>

      <aside class="hf-card p-5">
        <h2 class="text-base font-semibold text-zinc-100">Session timeline</h2>
        {#if recentSessions.length > 0}
          <div class="mt-4 space-y-3">
            {#each recentSessions.slice(0, 8) as session}
              {@const program = programFor(session.targetId)}
              <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-zinc-100">{program?.name ?? 'Missing program'}</p>
                    <p class="mt-1 text-xs text-zinc-500">{formatDate(session.startedAt)} · {formatDuration(session.durationActual)}</p>
                  </div>
                  <StatusBadge label={session.status} tone={statusTone(session.status)} />
                </div>
                {#if session.quickNote}
                  <p class="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{session.quickNote}</p>
                {/if}
              </div>
            {/each}
          </div>
        {:else if loaded}
          <p class="mt-4 rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No hunt sessions yet.</p>
        {/if}
      </aside>
    </section>

    {#if loaded && recentSessions.length === 0}
      <EmptyState
        icon={Timer}
        title="No hunt sessions yet"
        description="Start a focused session when you begin testing a target."
        actionLabel="Start Session"
        href="/timer"
      />
    {/if}
  </div>
</main>
