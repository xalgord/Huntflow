<script lang="ts">
  import { clerkAuthStore, initClerk, signOutFromClerk } from '$lib/cloud/clerk';
  import { cloudConfigured } from '$lib/cloud/convex';
  import {
    clearCloudData,
    getLastCloudSyncAt,
    ProRequiredError,
    syncNow,
    type CloudSyncResult
  } from '$lib/cloud/sync';
  import { Cloud, Lock, LogIn, LogOut, RefreshCw, Sparkles, Trash2, UserPlus } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let syncing = false;
  let clearing = false;
  let status = '';
  let error = '';
  let lastSyncAt: number | null = null;

  $: configured = $clerkAuthStore.configured && cloudConfigured;
  $: canSync =
    configured &&
    $clerkAuthStore.signedIn &&
    $clerkAuthStore.isPro &&
    !syncing &&
    !clearing;

  function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  }

  function resultText(result: CloudSyncResult): string {
    return `Synced ${result.merged} records. Pulled ${result.pulled}, pushed ${result.pushed}.`;
  }

  async function handleSync(): Promise<void> {
    syncing = true;
    status = '';
    error = '';

    try {
      const result = await syncNow();
      lastSyncAt = result.syncedAt;
      status = resultText(result);
    } catch (caught) {
      // Pro gate is shown as a paywall below, not a red error. Suppress the
      // generic error toast so users don't see a misleading "sync failed" line.
      if (caught instanceof ProRequiredError) {
        error = '';
      } else {
        error = caught instanceof Error ? caught.message : 'Cloud sync failed.';
      }
    } finally {
      syncing = false;
    }
  }

  async function handleClearCloud(): Promise<void> {
    if (!confirm('Clear all cloud data for this Clerk user? Local data stays on this device.')) return;

    clearing = true;
    status = '';
    error = '';

    try {
      const deleted = await clearCloudData();
      status = `Cleared ${deleted} cloud records.`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Cloud clear failed.';
    } finally {
      clearing = false;
    }
  }

  onMount(() => {
    lastSyncAt = getLastCloudSyncAt();
    void initClerk();
  });
</script>

<section class="hf-card p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <div class="flex items-center gap-2">
        <Cloud size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold text-foreground">Cloud Sync</h2>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        Sync targets, sessions, notes, and payouts through Convex using Clerk authentication.
      </p>
    </div>

    <div class="rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground shadow-inner-line">
      Last sync: <span class="text-foreground">{formatDate(lastSyncAt)}</span>
    </div>
  </div>

  {#if !configured}
    <div class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      Add <span class="font-mono text-amber-200">VITE_CLERK_PUBLISHABLE_KEY</span>,
      <span class="font-mono text-amber-200">VITE_CONVEX_URL</span>, and Convex
      <span class="font-mono text-amber-200">CLERK_JWT_ISSUER_DOMAIN</span> configuration to enable cloud sync.
    </div>
  {:else if $clerkAuthStore.loading}
    <div class="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      Initializing Clerk...
    </div>
  {:else if $clerkAuthStore.error}
    <div class="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-red-300">
      {$clerkAuthStore.error}
    </div>
  {:else if !$clerkAuthStore.signedIn}
    <div class="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-muted-foreground">Sign in to connect this device to your HuntFlow cloud data. Pro is required for sync.</p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <a
          href="/sign-up"
          class="hf-button-secondary"
        >
          <UserPlus size={18} aria-hidden="true" />
          Sign Up
        </a>
        <a
          href="/sign-in"
          class="hf-button-primary"
        >
          <LogIn size={18} aria-hidden="true" />
          Sign In
        </a>
      </div>
    </div>
  {:else if !$clerkAuthStore.isPro}
    <!-- Signed in but not on Pro: show a paywall with upgrade CTA. The
         non-Pro user keeps their local data — only sync is gated. -->
    <div class="mt-4 rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
      <div class="flex items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-200">
          <Lock size={20} aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-foreground">Cloud sync is a Pro feature</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Real-time, Notion-style sync across every device is available with HuntFlow Pro. Your local data stays
            fully usable on the free plan.
          </p>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href="/pricing"
              class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Sparkles size={14} aria-hidden="true" />
              Upgrade to Pro
            </a>
            <button
              type="button"
              class="hf-button-ghost border border-border"
              on:click={signOutFromClerk}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div class="rounded-lg border border-border bg-muted/40 p-4 shadow-inner-line">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Signed in &middot; Pro</p>
        <p class="mt-1 text-sm font-medium text-foreground">{$clerkAuthStore.userLabel}</p>
        <p class="mt-1 text-xs text-muted-foreground">
          Convex auth: {$clerkAuthStore.convexAuthenticated ? 'ready' : 'waiting for token'}
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="hf-button-secondary disabled:cursor-not-allowed"
          disabled={!canSync}
          on:click={handleSync}
        >
          <RefreshCw size={18} class={syncing ? 'animate-spin' : ''} aria-hidden="true" />
          Sync Now
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSync}
          on:click={handleClearCloud}
        >
          <Trash2 size={18} aria-hidden="true" />
          Clear Cloud
        </button>
        <button
          type="button"
          class="hf-button-ghost border border-border"
          on:click={signOutFromClerk}
        >
          <LogOut size={18} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </div>
  {/if}

  {#if status}
    <p class="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{status}</p>
  {/if}
  {#if error}
    <p class="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
  {/if}
</section>
