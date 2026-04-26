<script lang="ts">
  import { page } from '$app/stores';
  import PlatformIcon from '$lib/components/targets/PlatformIcon.svelte';
  import PriorityBadge from '$lib/components/targets/PriorityBadge.svelte';
  import TargetForm from '$lib/components/targets/TargetForm.svelte';
  import TargetStatusBadge from '$lib/components/targets/TargetStatusBadge.svelte';
  import { evidenceAssetStore, sessionStore, targetStore } from '$lib/stores';
  import type { Session, Target, TargetStatus } from '$lib/types';
  import { Archive, ArrowLeft, ExternalLink, Network, Play, Trash2 } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const statusPipeline: TargetStatus[] = ['recon', 'testing', 'reported', 'paid', 'closed', 'archived'];
  const statusLabels: Record<TargetStatus, string> = {
    recon: 'Recon',
    testing: 'Testing',
    reported: 'Reported',
    paid: 'Paid',
    closed: 'Closed',
    archived: 'Archived'
  };

  let loaded = false;

  onMount(async () => {
    await Promise.all([targetStore.load(), sessionStore.load(), evidenceAssetStore.load()]);
    loaded = true;
  });

  $: targetId = $page.params.id;
  $: target = $targetStore.find((candidate) => candidate.id === targetId);
  $: targetSessions = $sessionStore
    .filter((session) => session.targetId === targetId)
    .sort((a, b) => b.startedAt - a.startedAt);
  $: completedSessions = targetSessions.filter((session) => session.status === 'completed');
  $: totalSeconds = completedSessions.reduce((sum, session) => sum + session.durationActual, 0);
  $: targetAssets = $evidenceAssetStore
    .filter((asset) => asset.targetId === targetId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function formatDate(timestamp?: number): string {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(timestamp));
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async function saveTarget(event: CustomEvent<{ target: Target }>) {
    await targetStore.put({
      ...event.detail.target,
      status: target?.status ?? event.detail.target.status,
      lastSessionAt: target?.lastSessionAt,
      sessionCount: target?.sessionCount ?? 0
    });
  }

  async function setStatus(status: TargetStatus) {
    if (!target) return;
    await targetStore.put({ ...target, status, updatedAt: Date.now() });
  }

  async function archiveTarget() {
    await setStatus('archived');
  }

  async function deleteTarget() {
    if (!target) return;
    if (!confirm('Delete this target and all related sessions and notes?')) return;
    await targetStore.delete(target.id);
    await goto('/targets');
  }

  function sessionStatusClass(session: Session): string {
    return session.status === 'completed'
      ? 'border-green-500/30 bg-green-500/10 text-green-400'
      : session.status === 'abandoned'
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : session.status === 'paused'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-400';
  }
</script>

<svelte:head>
  <title>{target?.name ?? 'Target'} | HuntFlow</title>
  <meta name="description" content="View and edit bug bounty target details." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-6xl">
    <a
      href="/targets"
      class="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      Back to targets
    </a>

    {#if target}
      <header class="hf-card p-4">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-3xl font-bold leading-tight text-slate-100">{target.name}</h1>
              <PriorityBadge priority={target.priority} />
              <TargetStatusBadge status={target.status} />
            </div>
            <PlatformIcon platform={target.platform} />
            <div class="flex flex-wrap gap-4 text-sm text-slate-400">
              <span>Last session: {formatDate(target.lastSessionAt)}</span>
              <span>{target.sessionCount} completed sessions</span>
              <span>{formatDuration(totalSeconds)} hunted</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <a
              href={`/timer?target=${target.id}`}
              class="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
            >
              <Play size={20} aria-hidden="true" />
              Start Session
            </a>
            {#if target.programUrl}
              <a
                href={target.programUrl}
                target="_blank"
                rel="noreferrer"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
              >
                <ExternalLink size={18} aria-hidden="true" />
                Program
              </a>
            {/if}
          </div>
        </div>
      </header>

      <section class="hf-card p-4">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-100">Status Pipeline</h2>
            <p class="mt-1 text-sm text-slate-400">Move the target through its current hunting state.</p>
          </div>
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
            on:click={archiveTarget}
          >
            <Archive size={18} aria-hidden="true" />
            Archive
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          {#each statusPipeline as status}
            <button
              type="button"
              class="min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium transition {target.status ===
              status
                ? 'border-primary-500/30 bg-primary-500/20 text-primary-400'
                : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'}"
              on:click={() => setStatus(status)}
            >
              {statusLabels[status]}
            </button>
          {/each}
        </div>
      </section>

      <section class="hf-card p-4">
        <h2 class="mb-4 text-lg font-semibold text-slate-100">Target Details</h2>
        <TargetForm {target} submitLabel="Save Changes" on:submit={saveTarget} on:cancel={() => goto('/targets')} />
      </section>

      <section class="hf-card p-4">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-100">Evidence Assets</h2>
            <p class="mt-1 text-sm text-slate-400">Proof files, URLs, and snippets attached to this target.</p>
          </div>
          <a href={`/assets?target=${target.id}`} class="hf-button-secondary">
            <Network size={18} aria-hidden="true" />
            Manage evidence
          </a>
        </div>

        {#if targetAssets.length > 0}
          <div class="grid gap-3 sm:grid-cols-2">
            {#each targetAssets.slice(0, 4) as asset (asset.id)}
              <a href={`/assets?target=${target.id}`} class="rounded-[14px] border border-border/70 bg-background/40 p-3 transition hover:border-primary/40 hover:bg-muted/40">
                <p class="truncate text-sm font-semibold text-foreground">{asset.title}</p>
                <p class="mt-1 text-xs text-muted-foreground">{asset.kind} · {asset.syncState}</p>
              </a>
            {/each}
          </div>
        {:else}
          <div class="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-6 text-center">
            <p class="text-sm font-medium text-slate-300">No evidence attached</p>
            <p class="mt-1 text-sm text-slate-500">Capture proof from the Evidence workspace with this target selected.</p>
          </div>
        {/if}
      </section>

      <section class="hf-card p-4">
        <div class="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-100">Sessions</h2>
            <p class="mt-1 text-sm text-slate-400">Newest first for this target.</p>
          </div>
        </div>

        {#if targetSessions.length > 0}
          <div class="divide-y divide-slate-700">
            {#each targetSessions as session (session.id)}
              <article class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm font-medium text-slate-100">{formatDate(session.startedAt)}</p>
                  <p class="text-xs text-slate-500">
                    Planned {formatDuration(session.durationPlanned)} | Actual {formatDuration(session.durationActual)}
                  </p>
                </div>
                <span
                  class="inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium {sessionStatusClass(
                    session
                  )}"
                >
                  {session.status}
                </span>
              </article>
            {/each}
          </div>
        {:else}
          <div class="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-6 text-center">
            <p class="text-sm font-medium text-slate-300">No sessions for this target</p>
            <p class="mt-1 text-sm text-slate-500">Start a session to populate target history.</p>
          </div>
        {/if}
      </section>

      <section class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-red-400">Danger Zone</h2>
            <p class="mt-1 text-sm text-red-300/80">Deleting cascades to related sessions and notes.</p>
          </div>
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
            on:click={deleteTarget}
          >
            <Trash2 size={18} aria-hidden="true" />
            Delete Target
          </button>
        </div>
      </section>
    {:else if loaded}
      <section class="hf-card p-8 text-center">
        <h1 class="text-lg font-semibold text-slate-300">Target not found</h1>
        <p class="mt-2 text-sm text-slate-500">The target may have been deleted or archived elsewhere.</p>
        <a
          href="/targets"
          class="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
        >
          Back to targets
        </a>
      </section>
    {/if}
  </div>
</main>
