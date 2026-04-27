<script lang="ts">
  import { browser } from '$app/environment';
  import { exportDataAsJson } from '$lib/db/export';
  import { importData, validateImportData, ImportValidationError } from '$lib/db/import';
  import { getHuntFlowDB, resetMemoryDB } from '$lib/db';
  import { loadDemoWorkspace } from '$lib/seeds/demoWorkspace';
  import {
    checklistInstanceStore,
    noteStore,
    payoutStore,
    reconAssetStore,
    sessionStore,
    settingsStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import { DEFAULT_SETTINGS } from '$lib/types';
  import { Download, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let storageText = 'Calculating...';
  let importMode: 'merge' | 'replace' = 'merge';
  let importStatus = '';
  let importError = '';
  let showClearModal = false;
  let clearConfirm = '';
  let demoLoading = false;
  let demoStatus = '';
  let demoError = '';
  let tourStatus = '';

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function updateStorageUsage(): Promise<void> {
    if (!browser || !navigator.storage?.estimate) {
      storageText = 'Not available';
      return;
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    storageText = quota > 0 ? `${formatBytes(usage)} of ${formatBytes(quota)}` : formatBytes(usage);
  }

  async function downloadExport(): Promise<void> {
    const json = await exportDataAsJson('1.0.0');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `huntflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    await settingsStore.setValue('lastExportAt', Date.now());
    await updateStorageUsage();
  }

  async function clearStores(): Promise<void> {
    const db = await getHuntFlowDB();
    if (db) {
      // Clear every user-data object store so a "Clear" wipe is total. We
      // intentionally leave payloads/bookmarks/checklistTemplates/evidence
      // untouched — those are seeded built-ins or content-addressed blobs
      // that the user can re-seed by reload anyway.
      const stores = [
        'sessions',
        'notes',
        'targets',
        'payouts',
        'reconAssets',
        'submissions',
        'checklistInstances',
        'settings'
      ] as const;
      const present = stores.filter((name) => db.objectStoreNames.contains(name));
      if (present.length > 0) {
        const tx = db.transaction(present, 'readwrite');
        await Promise.all([
          ...present.map((name) => tx.objectStore(name).clear()),
          tx.done
        ]);
      }
    }

    resetMemoryDB();
    await settingsStore.set(DEFAULT_SETTINGS);
    await Promise.all([
      sessionStore.refresh(),
      noteStore.refresh(),
      targetStore.refresh(),
      payoutStore.refresh(),
      reconAssetStore.refresh(),
      submissionStore.refresh(),
      checklistInstanceStore.refresh(),
      settingsStore.refresh()
    ]);
    await updateStorageUsage();
  }

  async function handleImport(event: Event): Promise<void> {
    importStatus = '';
    importError = '';
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const payload = await file.text();
      await validateImportData(payload);
      if (importMode === 'replace') await clearStores();
      const imported = await importData(payload);
      await Promise.all([
        sessionStore.refresh(),
        noteStore.refresh(),
        targetStore.refresh(),
        payoutStore.refresh(),
        settingsStore.refresh()
      ]);
      await updateStorageUsage();
      importStatus = `Imported ${imported.data.targets.length} targets, ${imported.data.sessions.length} sessions, ${imported.data.notes.length} notes, and ${imported.data.payouts.length} payouts.`;
    } catch (error) {
      importError =
        error instanceof ImportValidationError
          ? error.errors.slice(0, 5).join(' ')
          : error instanceof Error
            ? error.message
            : 'Import failed.';
    } finally {
      input.value = '';
    }
  }

  async function confirmClear(): Promise<void> {
    if (clearConfirm !== 'CLEAR') return;
    await clearStores();
    showClearModal = false;
    clearConfirm = '';
    importStatus = 'All local data was cleared.';
  }

  async function handleLoadDemo(): Promise<void> {
    if (demoLoading) return;
    if (
      !confirm(
        'Add a sample workspace (3 targets, sessions, notes, recon assets, and one paid submission) to your existing data?'
      )
    )
      return;
    demoLoading = true;
    demoStatus = '';
    demoError = '';
    try {
      const result = await loadDemoWorkspace();
      // Refresh stats-derived stores so the dashboard reflects the new data.
      await Promise.all([
        targetStore.refresh(),
        sessionStore.refresh(),
        noteStore.refresh(),
        reconAssetStore.refresh(),
        submissionStore.refresh(),
        payoutStore.refresh(),
        checklistInstanceStore.refresh()
      ]);
      await updateStorageUsage();
      demoStatus = `Loaded ${result.targets} targets, ${result.sessions} sessions, ${result.notes} notes, ${result.reconAssets} recon assets, ${result.submissions} submissions.`;
    } catch (error) {
      demoError = error instanceof Error ? error.message : 'Could not load demo workspace.';
    } finally {
      demoLoading = false;
    }
  }

  async function relaunchTour(): Promise<void> {
    await settingsStore.setValue('onboardingCompleted', false);
    tourStatus = 'Tour will start on the next page load.';
  }

  onMount(() => {
    void updateStorageUsage();
  });
</script>

<section class="hf-card p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-100">Data</h2>
      <p class="mt-1 text-sm text-slate-400">Export, import, and manage local IndexedDB storage.</p>
    </div>
    <div class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400">
      Storage: <span class="text-slate-200">{storageText}</span>
    </div>
  </div>

  <div class="mt-4 grid gap-4 lg:grid-cols-3">
    <button
      type="button"
      class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
      on:click={downloadExport}
    >
      <Download size={20} aria-hidden="true" />
      Export JSON
    </button>

    <label class="block">
      <span class="hf-label">Import mode</span>
      <select
        bind:value={importMode}
        class="hf-select mt-2"
      >
        <option value="merge">Merge with existing data</option>
        <option value="replace">Replace local data</option>
      </select>
    </label>

    <label class="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600">
      <Upload size={20} aria-hidden="true" />
      Import JSON
      <input class="sr-only" type="file" accept="application/json,.json" on:change={handleImport} />
    </label>
  </div>

  <div class="mt-4 rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Sparkles size={16} aria-hidden="true" />
          Sample workspace
        </h3>
        <p class="mt-1 text-sm text-slate-400">
          Adds 3 demo programs, sessions across two weeks, recon assets, notes, and a paid submission so you can explore every screen.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-primary-500/30 bg-primary-500/10 px-4 py-2.5 text-sm font-medium text-primary-200 transition hover:bg-primary-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          on:click={handleLoadDemo}
          disabled={demoLoading}
        >
          <Sparkles size={16} aria-hidden="true" />
          {demoLoading ? 'Loading…' : 'Load demo data'}
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
          on:click={relaunchTour}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Replay tour
        </button>
      </div>
    </div>
    {#if demoStatus}
      <p class="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{demoStatus}</p>
    {/if}
    {#if demoError}
      <p class="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{demoError}</p>
    {/if}
    {#if tourStatus}
      <p class="mt-3 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300">{tourStatus}</p>
    {/if}
  </div>

  <div class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="text-sm font-semibold text-red-300">Clear local data</h3>
        <p class="mt-1 text-sm text-red-200/80">Deletes sessions, notes, targets, and resets settings.</p>
      </div>
      <button
        type="button"
        class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
        on:click={() => (showClearModal = true)}
      >
        <Trash2 size={18} aria-hidden="true" />
        Clear Data
      </button>
    </div>
  </div>

  {#if importStatus}
    <p class="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{importStatus}</p>
  {/if}
  {#if importError}
    <p class="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{importError}</p>
  {/if}
</section>

{#if showClearModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
    <section class="w-full max-w-md rounded-lg border border-red-500/30 bg-slate-800 p-4 shadow-dark-xl">
      <h2 class="text-lg font-semibold text-red-300">Clear all local data?</h2>
      <p class="mt-2 text-sm leading-6 text-slate-400">
        This cannot be undone. Type <span class="font-mono text-red-300">CLEAR</span> to confirm.
      </p>
      <input
        bind:value={clearConfirm}
        class="mt-4 w-full rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
        placeholder="CLEAR"
      />
      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
          on:click={() => {
            showClearModal = false;
            clearConfirm = '';
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center justify-center rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          disabled={clearConfirm !== 'CLEAR'}
          on:click={confirmClear}
        >
          Clear Everything
        </button>
      </div>
    </section>
  </div>
{/if}
