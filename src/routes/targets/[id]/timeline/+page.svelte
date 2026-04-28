<script lang="ts">
  import { page } from '$app/stores';
  import {
    evidenceAssetStore,
    noteStore,
    sessionStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import type { EvidenceAsset, Note, Session, Submission } from '$lib/types';
  import { severityColorClass } from '$lib/utils/cvss';
  import {
    ArrowLeft,
    Camera,
    FileText,
    Filter,
    History,
    Image as ImageIcon,
    Link as LinkIcon,
    Network,
    NotebookPen,
    Send,
    ShieldAlert,
    Timer as TimerIcon
  } from 'lucide-svelte';
  import { onMount } from 'svelte';

  /**
   * Per-target Session Timeline.
   *
   * Stitches every artifact captured against this target into one
   * chronological feed so a hunter (or their future self) can scrub
   * through a hunt and see exactly what happened, in order:
   *
   *   - Session start / end markers (with focus duration)
   *   - Notes touched during the session
   *   - Evidence captured (screenshots, requests, exchanges, URLs)
   *   - Submissions promoted from notes
   *
   * Each entry carries an icon-coded type chip, a relative timestamp,
   * and click-through to the underlying record. The "Group by session"
   * mode collapses everything that happened during a session into a
   * single expandable card — closer to how the hunter actually thinks
   * about the work ("the 90 minutes I spent on the IDOR last Tuesday").
   */

  type TimelineKind = 'session' | 'note' | 'evidence' | 'submission';
  type SessionPhase = 'started' | 'completed';

  interface BaseEntry {
    id: string;
    at: number;
    kind: TimelineKind;
  }

  interface SessionEntry extends BaseEntry {
    kind: 'session';
    phase: SessionPhase;
    session: Session;
  }

  interface NoteEntry extends BaseEntry {
    kind: 'note';
    note: Note;
  }

  interface EvidenceEntry extends BaseEntry {
    kind: 'evidence';
    asset: EvidenceAsset;
  }

  interface SubmissionEntry extends BaseEntry {
    kind: 'submission';
    submission: Submission;
  }

  type TimelineEntry = SessionEntry | NoteEntry | EvidenceEntry | SubmissionEntry;

  interface SessionGroup {
    session: Session | null;
    entries: TimelineEntry[];
    startedAt: number;
    endedAt: number;
  }

  let loaded = false;
  let view: 'flat' | 'sessions' = 'flat';
  let filterKind: TimelineKind | 'all' = 'all';

  onMount(async () => {
    await Promise.all([
      targetStore.load(),
      sessionStore.load(),
      noteStore.load(),
      evidenceAssetStore.load(),
      submissionStore.load()
    ]);
    loaded = true;
  });

  $: targetId = $page.params.id;
  $: target = $targetStore.find((candidate) => candidate.id === targetId);

  $: targetSessions = $sessionStore.filter((session) => session.targetId === targetId);
  $: targetNotes = $noteStore.filter((note) => note.targetId === targetId);
  $: targetAssets = $evidenceAssetStore.filter((asset) => asset.targetId === targetId);
  $: targetSubmissions = $submissionStore.filter((submission) => submission.targetId === targetId);

  $: entries = buildEntries(targetSessions, targetNotes, targetAssets, targetSubmissions);
  $: filtered = filterKind === 'all' ? entries : entries.filter((entry) => entry.kind === filterKind);
  $: dayGroups = groupByDay(filtered);
  $: sessionGroups = groupBySession(entries, targetSessions);

  /**
   * Fold every artifact into a single sorted feed. We deliberately
   * emit two markers per session (started / completed) so the user
   * sees both the open and close as standalone events when scrubbing.
   * Notes are pinned at their `updatedAt` rather than `createdAt`
   * because that's where the actual work happened — empty notes from
   * 4 days ago aren't interesting; the version that got the IDOR
   * payload added is.
   */
  function buildEntries(
    sessions: Session[],
    notes: Note[],
    assets: EvidenceAsset[],
    submissions: Submission[]
  ): TimelineEntry[] {
    const out: TimelineEntry[] = [];

    for (const session of sessions) {
      out.push({ id: `${session.id}:start`, kind: 'session', phase: 'started', at: session.startedAt, session });
      if (session.status === 'completed' && session.endedAt) {
        out.push({ id: `${session.id}:end`, kind: 'session', phase: 'completed', at: session.endedAt, session });
      }
    }

    for (const note of notes) {
      out.push({ id: `note:${note.id}`, kind: 'note', at: note.updatedAt, note });
    }

    for (const asset of assets) {
      out.push({ id: `asset:${asset.id}`, kind: 'evidence', at: asset.createdAt ?? asset.updatedAt, asset });
    }

    for (const submission of submissions) {
      const at = submission.submittedAt ?? submission.createdAt;
      out.push({ id: `submission:${submission.id}`, kind: 'submission', at, submission });
    }

    return out.sort((a, b) => b.at - a.at);
  }

  function groupByDay(items: TimelineEntry[]): { dayKey: string; label: string; entries: TimelineEntry[] }[] {
    const map = new Map<string, TimelineEntry[]>();
    for (const entry of items) {
      const date = new Date(entry.at);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return Array.from(map.entries()).map(([dayKey, dayEntries]) => ({
      dayKey,
      label: formatDayLabel(dayEntries[0].at),
      entries: dayEntries
    }));
  }

  /**
   * Group every entry by which session it belongs to. Notes / evidence
   * with an explicit `sessionId` get attached to that session; anything
   * without falls into a synthetic "Outside sessions" bucket so it's
   * not silently dropped.
   */
  function groupBySession(items: TimelineEntry[], sessions: Session[]): SessionGroup[] {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const buckets = new Map<string, SessionGroup>();
    const stray: TimelineEntry[] = [];

    function bucket(sessionId: string): SessionGroup {
      const session = sessionById.get(sessionId);
      const existing = buckets.get(sessionId);
      if (existing) return existing;
      const group: SessionGroup = {
        session: session ?? null,
        entries: [],
        startedAt: session?.startedAt ?? 0,
        endedAt: session?.endedAt ?? session?.startedAt ?? 0
      };
      buckets.set(sessionId, group);
      return group;
    }

    for (const entry of items) {
      let sessionId: string | undefined;
      if (entry.kind === 'session') sessionId = entry.session.id;
      else if (entry.kind === 'note') sessionId = entry.note.sessionId;
      else if (entry.kind === 'evidence') sessionId = entry.asset.sessionId;

      if (sessionId && sessionById.has(sessionId)) {
        bucket(sessionId).entries.push(entry);
      } else {
        stray.push(entry);
      }
    }

    const groups = Array.from(buckets.values()).sort((a, b) => b.startedAt - a.startedAt);
    if (stray.length > 0) {
      groups.push({
        session: null,
        entries: stray,
        startedAt: stray[0]?.at ?? 0,
        endedAt: stray[stray.length - 1]?.at ?? 0
      });
    }
    return groups;
  }

  function formatTime(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  }

  function formatDayLabel(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
    }).format(date);
  }

  function sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function entryColor(kind: TimelineKind): string {
    if (kind === 'session') return 'border-primary-500/40 bg-primary-500/10 text-primary-200';
    if (kind === 'note') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    if (kind === 'evidence') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  }

  function evidenceIcon(asset: EvidenceAsset) {
    if (asset.kind === 'image') return ImageIcon;
    if (asset.kind === 'http-exchange' || asset.kind === 'request' || asset.kind === 'response') return Network;
    if (asset.kind === 'url') return LinkIcon;
    return FileText;
  }

  function counts(): Record<TimelineKind, number> {
    return entries.reduce(
      (acc, entry) => {
        acc[entry.kind] += 1;
        return acc;
      },
      { session: 0, note: 0, evidence: 0, submission: 0 } as Record<TimelineKind, number>
    );
  }

  $: totals = counts();
</script>

<svelte:head>
  <title>{target ? `${target.name} timeline` : 'Timeline'} | HuntFlow</title>
  <meta name="description" content="Stitched chronological view of every session, note, evidence asset, and submission against this target." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner space-y-6">
    <a
      href={target ? `/targets/${target.id}` : '/targets'}
      class="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-slate-100"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to target
    </a>

    {#if !loaded}
      <p class="text-sm text-slate-400">Loading timeline…</p>
    {:else if !target}
      <section class="hf-card p-6">
        <h1 class="text-lg font-semibold text-slate-100">Target not found</h1>
        <p class="mt-2 text-sm text-slate-400">It may have been deleted. <a href="/targets" class="text-primary-300 hover:text-primary-200">Return to targets</a>.</p>
      </section>
    {:else}
      <header class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="hf-eyebrow flex items-center gap-2">
            <History size={14} aria-hidden="true" /> Timeline
          </p>
          <h1 class="hf-title">{target.name}</h1>
          <p class="hf-description">
            {entries.length} event{entries.length === 1 ? '' : 's'} ·
            {totals.session} session marker{totals.session === 1 ? '' : 's'} ·
            {totals.note} note{totals.note === 1 ? '' : 's'} ·
            {totals.evidence} evidence ·
            {totals.submission} submission{totals.submission === 1 ? '' : 's'}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 p-0.5 text-xs">
            <button
              type="button"
              class="rounded-[5px] px-3 py-1.5 font-medium transition {view === 'flat' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}"
              on:click={() => (view = 'flat')}
            >
              Chronological
            </button>
            <button
              type="button"
              class="rounded-[5px] px-3 py-1.5 font-medium transition {view === 'sessions' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}"
              on:click={() => (view = 'sessions')}
            >
              By session
            </button>
          </div>

          <label class="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
            <Filter size={14} aria-hidden="true" />
            <select bind:value={filterKind} class="bg-transparent text-xs font-medium focus:outline-none">
              <option value="all">All types</option>
              <option value="session">Sessions</option>
              <option value="note">Notes</option>
              <option value="evidence">Evidence</option>
              <option value="submission">Submissions</option>
            </select>
          </label>
        </div>
      </header>

      {#if entries.length === 0}
        <section class="hf-card p-8 text-center">
          <p class="text-sm text-slate-400">
            Nothing to show yet. Start a session, capture a screenshot, or jot a note —
            it all lands here in order.
          </p>
        </section>
      {:else if view === 'flat'}
        <section class="space-y-6">
          {#each dayGroups as day (day.dayKey)}
            <article class="hf-card p-4 sm:p-6">
              <header class="mb-4 flex items-baseline justify-between gap-2 border-b border-slate-700 pb-2">
                <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">{day.label}</h2>
                <span class="text-xs text-slate-500">{day.entries.length} event{day.entries.length === 1 ? '' : 's'}</span>
              </header>

              <ol class="relative space-y-3 border-l border-slate-700 pl-5">
                {#each day.entries as entry (entry.id)}
                  <li class="relative">
                    <span
                      class="absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full border bg-slate-900 {entryColor(entry.kind)}"
                      aria-hidden="true"
                    >
                      {#if entry.kind === 'session'}
                        <TimerIcon size={11} />
                      {:else if entry.kind === 'note'}
                        <NotebookPen size={11} />
                      {:else if entry.kind === 'evidence'}
                        {#if entry.asset.kind === 'image'}
                          <Camera size={11} />
                        {:else if entry.asset.kind === 'http-exchange' || entry.asset.kind === 'request' || entry.asset.kind === 'response'}
                          <Network size={11} />
                        {:else if entry.asset.kind === 'url'}
                          <LinkIcon size={11} />
                        {:else}
                          <FileText size={11} />
                        {/if}
                      {:else}
                        <Send size={11} />
                      {/if}
                    </span>

                    {#if entry.kind === 'session'}
                      <div class="flex flex-wrap items-center gap-2 text-sm">
                        <span class="text-xs font-mono text-slate-500">{formatTime(entry.at)}</span>
                        <span class="rounded-md border border-primary-500/30 bg-primary-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary-200">
                          Session {entry.phase}
                        </span>
                        {#if entry.phase === 'completed'}
                          <span class="text-xs text-slate-400">
                            Focused {formatDuration(entry.session.durationActual)}
                          </span>
                        {:else}
                          <span class="text-xs text-slate-400">
                            Planned {Math.round(entry.session.durationPlanned / 60)}m
                          </span>
                        {/if}
                        {#if entry.session.quickNote}
                          <span class="ml-2 text-xs italic text-slate-500">"{entry.session.quickNote}"</span>
                        {/if}
                      </div>
                    {:else if entry.kind === 'note'}
                      <a href={`/notes/${entry.note.id}`} class="block rounded-md border border-transparent px-2 py-1.5 transition hover:border-slate-700 hover:bg-slate-800/60">
                        <div class="flex flex-wrap items-center gap-2 text-sm">
                          <span class="text-xs font-mono text-slate-500">{formatTime(entry.at)}</span>
                          <span class="font-medium text-slate-100">{entry.note.title || 'Untitled note'}</span>
                          {#if entry.note.severity}
                            <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium {severityColorClass(entry.note.severity)}">
                              <ShieldAlert size={11} aria-hidden="true" />
                              <span class="capitalize">{entry.note.severity}</span>
                              {#if typeof entry.note.cvssScore === 'number'}
                                <span class="font-mono opacity-80">· {entry.note.cvssScore.toFixed(1)}</span>
                              {/if}
                            </span>
                          {/if}
                          {#each entry.note.tags.slice(0, 3) as tag (tag)}
                            <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">#{tag}</span>
                          {/each}
                        </div>
                      </a>
                    {:else if entry.kind === 'evidence'}
                      <a href={`/assets?asset=${entry.asset.id}`} class="block rounded-md border border-transparent px-2 py-1.5 transition hover:border-slate-700 hover:bg-slate-800/60">
                        <div class="flex flex-wrap items-center gap-2 text-sm">
                          <span class="text-xs font-mono text-slate-500">{formatTime(entry.at)}</span>
                          <span class="font-medium text-slate-100 truncate max-w-[24rem]">{entry.asset.title}</span>
                          <span class="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                            {entry.asset.kind.replace('-', ' ')}
                          </span>
                          {#each entry.asset.tags.slice(0, 3) as tag (tag)}
                            <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">#{tag}</span>
                          {/each}
                        </div>
                      </a>
                    {:else}
                      <a href={`/submissions?target=${entry.submission.targetId}`} class="block rounded-md border border-transparent px-2 py-1.5 transition hover:border-slate-700 hover:bg-slate-800/60">
                        <div class="flex flex-wrap items-center gap-2 text-sm">
                          <span class="text-xs font-mono text-slate-500">{formatTime(entry.at)}</span>
                          <span class="font-medium text-slate-100">{entry.submission.title}</span>
                          <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium {severityColorClass(entry.submission.severity)}">
                            <span class="capitalize">{entry.submission.severity}</span>
                            {#if typeof entry.submission.cvssScore === 'number'}
                              <span class="font-mono opacity-80">· {entry.submission.cvssScore.toFixed(1)}</span>
                            {/if}
                          </span>
                          <span class="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-sky-200">
                            {entry.submission.status}
                          </span>
                        </div>
                      </a>
                    {/if}
                  </li>
                {/each}
              </ol>
            </article>
          {/each}
        </section>
      {:else}
        <section class="space-y-4">
          {#each sessionGroups as group (group.session?.id ?? 'stray')}
            <article class="hf-card p-4 sm:p-6">
              <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
                {#if group.session}
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Session</p>
                    <h2 class="text-base font-semibold text-slate-100">
                      {formatDayLabel(group.session.startedAt)} · {formatTime(group.session.startedAt)}
                    </h2>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-slate-400">
                    <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 capitalize">
                      {group.session.status}
                    </span>
                    {#if group.session.status === 'completed'}
                      <span>Focused {formatDuration(group.session.durationActual)}</span>
                    {/if}
                  </div>
                {:else}
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Outside sessions</p>
                    <h2 class="text-base font-semibold text-slate-100">
                      Captures without a focus session
                    </h2>
                  </div>
                  <span class="text-xs text-slate-500">{group.entries.length} item{group.entries.length === 1 ? '' : 's'}</span>
                {/if}
              </header>

              {#if group.entries.length === 0}
                <p class="text-sm text-slate-500">Empty session — nothing was captured.</p>
              {:else}
                <ul class="space-y-1.5">
                  {#each group.entries as entry (entry.id)}
                    <li class="flex flex-wrap items-center gap-2 text-sm">
                      <span class="grid h-5 w-5 place-items-center rounded border {entryColor(entry.kind)}" aria-hidden="true">
                        {#if entry.kind === 'session'}
                          <TimerIcon size={11} />
                        {:else if entry.kind === 'note'}
                          <NotebookPen size={11} />
                        {:else if entry.kind === 'evidence'}
                          <svelte:component this={evidenceIcon(entry.asset)} size={11} />
                        {:else}
                          <Send size={11} />
                        {/if}
                      </span>
                      <span class="text-xs font-mono text-slate-500">{formatTime(entry.at)}</span>
                      {#if entry.kind === 'session'}
                        <span class="text-slate-300">Session {entry.phase}</span>
                      {:else if entry.kind === 'note'}
                        <a href={`/notes/${entry.note.id}`} class="font-medium text-slate-100 hover:text-primary-300">
                          {entry.note.title || 'Untitled note'}
                        </a>
                        {#if entry.note.severity}
                          <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium {severityColorClass(entry.note.severity)}">
                            <span class="capitalize">{entry.note.severity}</span>
                          </span>
                        {/if}
                      {:else if entry.kind === 'evidence'}
                        <a href={`/assets?asset=${entry.asset.id}`} class="truncate font-medium text-slate-100 hover:text-primary-300">
                          {entry.asset.name}
                        </a>
                        <span class="text-[11px] uppercase tracking-wide text-slate-500">{entry.asset.kind.replace('-', ' ')}</span>
                      {:else}
                        <a href={`/submissions?target=${entry.submission.targetId}`} class="font-medium text-slate-100 hover:text-primary-300">
                          {entry.submission.title}
                        </a>
                        <span class="text-[11px] uppercase tracking-wide text-slate-500">{entry.submission.status}</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </article>
          {/each}
        </section>
      {/if}
    {/if}
  </div>
</main>
