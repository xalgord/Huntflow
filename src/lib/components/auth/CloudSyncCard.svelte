<script lang="ts">
  /**
   * CloudSyncCard — live status of cross-device sync for Pro users on
   * the Account page: a status dot, a plain-language label, when the
   * last round trip finished, and a "Sync now" action that re-uploads
   * anything the cloud may be missing and retries failed evidence
   * uploads.
   */
  import { onDestroy, onMount } from 'svelte';
  import { CloudOff, Loader2, RefreshCw } from 'lucide-svelte';
  import { realtimeSyncStore, syncNow } from '$lib/cloud/realtimeSync';

  let busy = false;
  let now = Date.now();
  let ticker: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    ticker = setInterval(() => (now = Date.now()), 15_000);
  });
  onDestroy(() => {
    if (ticker) clearInterval(ticker);
  });

  $: state = $realtimeSyncStore;
  $: tone = !state.active
    ? 'idle'
    : state.error
      ? state.statusLabel === 'Offline'
        ? 'offline'
        : 'error'
      : state.statusLabel === 'Synced'
        ? 'ok'
        : 'busy';
  $: label =
    tone === 'idle'
      ? 'Starting…'
      : tone === 'offline'
        ? 'Offline — changes will sync when you reconnect'
        : tone === 'error'
          ? 'Sync paused'
          : tone === 'busy'
            ? 'Syncing…'
            : 'Up to date';

  function relative(at: number | null, reference: number): string {
    if (!at) return 'Not synced on this device yet';
    const seconds = Math.max(0, Math.round((reference - at) / 1000));
    if (seconds < 45) return 'Last synced just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `Last synced ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Last synced ${hours} h ago`;
    return `Last synced ${new Date(at).toLocaleDateString()}`;
  }

  async function handleSyncNow(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await syncNow();
      now = Date.now();
    } finally {
      busy = false;
    }
  }
</script>

<section class="sync-card" aria-labelledby="account-sync-heading" data-testid="cloud-sync-card">
  <header class="sync-card__header">
    <h2 id="account-sync-heading" class="sync-card__title">Cloud sync</h2>
    <p class="sync-card__subtitle">
      Your workspace stays on this device and syncs to your other signed-in devices within seconds
      while HuntFlow is open. Evidence files are backed up too (up to 1 GB).
    </p>
  </header>

  <div class="sync-card__status" role="status" aria-live="polite">
    {#if tone === 'offline'}
      <CloudOff size={16} class="shrink-0 text-muted-foreground" aria-hidden="true" />
    {:else}
      <span class="dot dot--{tone}" aria-hidden="true"></span>
    {/if}
    <div class="min-w-0">
      <p class="sync-card__label">{label}</p>
      <p class="sync-card__meta">{relative(state.lastSyncAt, now)}</p>
      {#if tone === 'error' && state.error}
        <p class="sync-card__error">{state.error}</p>
      {/if}
    </div>
  </div>

  <div>
    <button
      type="button"
      class="secondary-btn"
      on:click={handleSyncNow}
      disabled={busy || !state.active}
      data-testid="cloud-sync-now"
    >
      {#if busy}
        <Loader2 size={16} class="animate-spin" aria-hidden="true" />
        <span>Syncing…</span>
      {:else}
        <RefreshCw size={16} aria-hidden="true" />
        <span>Sync now</span>
      {/if}
    </button>
  </div>
</section>

<style>
  .sync-card {
    border-radius: 0.875rem;
    border: 1px solid var(--hf-hairline-strong);
    background-color: var(--hf-surface);
    padding: 1.25rem;
    color: hsl(var(--foreground));
    box-shadow: inset 0 1px 0 var(--hf-hairline);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sync-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .sync-card__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0.005em;
  }

  .sync-card__subtitle,
  .sync-card__meta {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: hsl(var(--muted-foreground));
  }

  .sync-card__status {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border-radius: 0.625rem;
    background-color: var(--hf-window);
    border: 1px solid var(--hf-hairline);
  }

  .sync-card__label {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .sync-card__error {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: var(--hf-text-red);
  }

  .dot {
    margin-top: 0.375rem;
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: 9999px;
    background-color: hsl(var(--muted-foreground));
  }

  .dot--ok {
    background-color: var(--hf-text-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--hf-text-green) 22%, transparent);
  }

  .dot--busy {
    background-color: var(--hf-text-amber);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .dot--error {
    background-color: var(--hf-text-red);
  }

  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot--busy {
      animation: none;
    }
  }

  .secondary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 40px;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--hf-hairline-strong);
    background-color: var(--hf-window);
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 150ms ease, transform 150ms ease;
  }

  .secondary-btn:hover:not(:disabled) {
    background-color: var(--hf-hairline);
  }

  .secondary-btn:active:not(:disabled) {
    transform: scale(0.985);
  }

  .secondary-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.5);
  }

  .secondary-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  @media (max-width: 480px) {
    .secondary-btn {
      width: 100%;
    }
  }
</style>
