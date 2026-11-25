<script lang="ts">
  import {
    diskBackupState,
    estimateStorage,
    fetchDiskBackup,
    listDiskBackups,
    refreshDiskBackupStatus,
    requestPersistentStorage,
    saveDiskBackupNow,
    storagePersistence,
    type LocalBackupEntry
  } from '$lib/db/autoBackup';
  import { restoreBackupPayload } from '$lib/db/backupBundle';
  import { storageHealth } from '$lib/db/health';
  import { settingsStore } from '$lib/stores';
  import { isBackup } from '$lib/utils/cryptoBackup';
  import { formatRelativeDate } from '$lib/utils/workspace';
  import { CheckCircle2, HardDrive, Loader2, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let usage: { usage: number; quota: number } | null = null;
  let backups: LocalBackupEntry[] = [];
  let showBackups = false;
  let message = '';
  let errorMessage = '';
  let restoring = '';

  onMount(async () => {
    usage = await estimateStorage();
    const status = await refreshDiskBackupStatus();
    if (status.available) backups = await listDiskBackups();
  });

  function bytes(value: number): string {
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
  }

  async function protect(): Promise<void> {
    const state = await requestPersistentStorage();
    message =
      state === 'persisted'
        ? 'Your browser will keep HuntFlow data even when space runs low.'
        : 'The browser declined for now. Installing HuntFlow as an app or using it regularly usually unlocks this.';
  }

  async function backUpNow(): Promise<void> {
    errorMessage = '';
    message = '';
    try {
      await saveDiskBackupNow();
      backups = await listDiskBackups();
      message = 'Backup written to disk.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Backup failed.';
    }
  }

  async function restore(entry: LocalBackupEntry): Promise<void> {
    errorMessage = '';
    message = '';
    if (!confirm(`Replace everything in this browser with the backup from ${new Date(entry.createdAt).toLocaleString()}?`)) return;
    restoring = entry.name;
    try {
      const bundle = await fetchDiskBackup(entry.name);
      if (!isBackup(bundle) || bundle.encrypted) throw new Error('That file is not a readable HuntFlow backup.');
      const result = await restoreBackupPayload(bundle.payload);
      await settingsStore.refresh();
      message = `Restored ${Object.values(result.totals).reduce((sum, count) => sum + count, 0)} records. Reloading…`;
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Restore failed.';
    } finally {
      restoring = '';
    }
  }

  $: usedPercent = usage && usage.quota > 0 ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;
  $: lastExport = $settingsStore.lastExportAt;
</script>

<section class="hf-card overflow-hidden" aria-labelledby="storage-safety-heading">
  <div class="px-4 pb-2 pt-4">
    <h2 id="storage-safety-heading" class="hf-section-title">Storage & Backups</h2>
    <p class="mt-0.5 text-xs text-zinc-500">Your workspace lives in this browser. These keep it safe.</p>
  </div>

  <ul class="hf-list border-t-[0.5px] border-zinc-900">
    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        {#if $storageHealth.state === 'ok'}
          <CheckCircle2 size={17} class="text-green-500" aria-hidden="true" />
        {:else}
          <ShieldAlert size={17} class="text-red-500" aria-hidden="true" />
        {/if}
        <span>
          <span class="block text-zinc-100">Browser storage</span>
          <span class="block text-xs text-zinc-500">
            {#if $storageHealth.state === 'ok'}
              Saving normally{usage ? ` · ${bytes(usage.usage)} used` : ''}
            {:else if $storageHealth.state === 'memory'}
              Not saving — changes will be lost when the tab closes
            {:else if $storageHealth.state === 'quota'}
              Full — new changes can't be saved
            {:else}
              Waiting on another tab
            {/if}
          </span>
        </span>
      </span>
      {#if usage && usage.quota > 0}
        <span class="flex w-40 items-center gap-2" title={`${bytes(usage.usage)} of ${bytes(usage.quota)}`}>
          <span class="h-1.5 flex-1 overflow-hidden rounded-full" style="background: var(--hf-fill)">
            <span class="block h-full rounded-full {usedPercent > 85 ? 'bg-red-500' : 'bg-green-500'}" style={`width: ${Math.max(usedPercent, 1)}%`}></span>
          </span>
          <span class="text-[0.6875rem] tabular-nums text-zinc-500">{usedPercent.toFixed(usedPercent < 1 ? 2 : 0)}%</span>
        </span>
      {/if}
    </li>

    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        {#if $storagePersistence === 'persisted'}
          <ShieldCheck size={17} class="text-green-500" aria-hidden="true" />
        {:else}
          <ShieldAlert size={17} class="text-orange-500" aria-hidden="true" />
        {/if}
        <span>
          <span class="block text-zinc-100">Protected from cleanup</span>
          <span class="block text-xs text-zinc-500">
            {#if $storagePersistence === 'persisted'}
              On — the browser won't evict HuntFlow data to free space
            {:else if $storagePersistence === 'unsupported'}
              Not supported by this browser — keep regular backups
            {:else}
              Off — the browser may clear data under storage pressure
            {/if}
          </span>
        </span>
      </span>
      {#if $storagePersistence === 'best-effort' || $storagePersistence === 'unknown'}
        <button type="button" class="hf-button-tinted h-7 min-h-0 text-xs" on:click={protect}>Turn On</button>
      {/if}
    </li>

    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <HardDrive size={17} class={$diskBackupState.available ? 'text-green-500' : 'text-zinc-500'} aria-hidden="true" />
        <span class="min-w-0">
          <span class="block text-zinc-100">Automatic disk backups</span>
          <span class="block truncate text-xs text-zinc-500">
            {#if $diskBackupState.available}
              On · {$diskBackupState.count} saved in
              <code class="font-mono">{$diskBackupState.dir}</code>
              {#if $diskBackupState.latestAt} · last {formatRelativeDate($diskBackupState.latestAt)}{/if}
            {:else if $diskBackupState.checked}
              Available when you run HuntFlow with <code class="font-mono">npx huntflow</code>
            {:else}
              Checking…
            {/if}
          </span>
        </span>
      </span>
      {#if $diskBackupState.available}
        <span class="flex gap-2">
          {#if backups.length > 0}
            <button type="button" class="hf-button-ghost h-7 min-h-0 text-xs" on:click={() => (showBackups = !showBackups)}>
              {showBackups ? 'Hide' : 'Restore…'}
            </button>
          {/if}
          <button type="button" class="hf-button-tinted h-7 min-h-0 text-xs" disabled={$diskBackupState.saving} on:click={backUpNow}>
            {#if $diskBackupState.saving}<Loader2 size={12} class="animate-spin" aria-hidden="true" />{/if}
            Back Up Now
          </button>
        </span>
      {/if}
    </li>

    {#if showBackups}
      {#each backups as entry (entry.name)}
        <li class="hf-list-row justify-between pl-11">
          <span class="min-w-0">
            <span class="block text-zinc-200">{new Date(entry.createdAt).toLocaleString()}</span>
            <span class="block text-xs text-zinc-500">{bytes(entry.size)}</span>
          </span>
          <button
            type="button"
            class="hf-button-ghost h-7 min-h-0 text-xs"
            disabled={Boolean(restoring)}
            on:click={() => restore(entry)}
          >
            {#if restoring === entry.name}<Loader2 size={12} class="animate-spin" aria-hidden="true" />{:else}<RotateCcw size={12} aria-hidden="true" />{/if}
            Restore
          </button>
        </li>
      {/each}
    {/if}

    <li class="hf-list-row justify-between">
      <span>
        <span class="block text-zinc-100">Last manual backup</span>
        <span class="block text-xs text-zinc-500">
          {lastExport ? formatRelativeDate(lastExport) : 'Never — use “Export backup” below'}
        </span>
      </span>
    </li>
  </ul>

  {#if message || errorMessage}
    <p class="border-t-[0.5px] border-zinc-900 px-4 py-2.5 text-xs {errorMessage ? 'text-red-400' : 'text-green-400'}" role="status">
      {errorMessage || message}
    </p>
  {/if}
</section>
