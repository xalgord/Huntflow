<script lang="ts">
  import { browser } from '$app/environment';
  import { APP_VERSION, IS_WEB } from '$lib/buildTarget';
  import { exportDataAsJson } from '$lib/db/export';
  import { importData, validateImportData, ImportValidationError } from '$lib/db/import';
  import { getHuntFlowDB, resetMemoryDB } from '$lib/db';
  import {
    flushAllStores,
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
  import Modal from '$lib/components/ui/Modal.svelte';
  import { Download, Loader2, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-svelte';
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
    const json = await exportDataAsJson(APP_VERSION);
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
    // Drain every debounced write first. Otherwise a save scheduled just
    // before the wipe (e.g. `lastExportAt` after an export) can land after
    // the object stores are cleared and resurrect the old settings —
    // which also re-hides the welcome sheet.
    await flushAllStores();
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
        reconAssetStore.refresh(),
        submissionStore.refresh(),
        checklistInstanceStore.refresh(),
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
    // Close first: clearing resets settings, which brings back the welcome sheet.
    showClearModal = false;
    clearConfirm = '';
    await clearStores();
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
      // Dynamic import keeps the demo seeder out of the bundle when the
      // surrounding `{#if IS_WEB}` UI is dead-coded (app build).
      const { loadDemoWorkspace } = await import('$lib/seeds/demoWorkspace');
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

<section class="hf-card overflow-hidden" aria-labelledby="data-heading">
  <div class="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
    <div>
      <h2 id="data-heading" class="hf-section-title">Data</h2>
      <p class="mt-0.5 text-xs text-zinc-500">Move your workspace between browsers and machines.</p>
    </div>
    <span class="shrink-0 text-xs tabular-nums text-zinc-500">{storageText}</span>
  </div>

  <ul class="hf-list border-t-[0.5px] border-zinc-900">
    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <Download size={17} class="text-blue-500" aria-hidden="true" />
        <span>
          <span class="block text-zinc-100">Export workspace</span>
          <span class="block text-xs text-zinc-500">A JSON file with programs, targets, findings, notes and settings</span>
        </span>
      </span>
      <button type="button" class="hf-button-tinted h-7 min-h-0 text-xs" on:click={downloadExport}>Export JSON</button>
    </li>

    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <Upload size={17} class="text-blue-500" aria-hidden="true" />
        <span>
          <span class="block text-zinc-100">Import workspace</span>
          <span class="block text-xs text-zinc-500">From a HuntFlow export or backup</span>
        </span>
      </span>
      <span class="flex items-center gap-2">
        <select bind:value={importMode} class="hf-select h-7 min-h-0 w-auto py-0 pl-2 pr-7 text-xs" aria-label="Import mode">
          <option value="merge">Merge</option>
          <option value="replace">Replace</option>
        </select>
        <label class="hf-button-tinted h-7 min-h-0 cursor-pointer text-xs">
          Import JSON
          <input class="sr-only" type="file" accept="application/json,.json" on:change={handleImport} />
        </label>
      </span>
    </li>

    {#if IS_WEB}
      <!-- The local app build ships without the demo seeder. -->
      <li class="hf-list-row flex-wrap justify-between gap-y-2">
        <span class="flex items-center gap-2.5">
          <Sparkles size={17} class="text-purple-500" aria-hidden="true" />
          <span>
            <span class="block text-zinc-100">Sample workspace</span>
            <span class="block text-xs text-zinc-500">Three demo programs with sessions, recon, notes and findings</span>
          </span>
        </span>
        <button type="button" class="hf-button-tinted h-7 min-h-0 text-xs" on:click={handleLoadDemo} disabled={demoLoading}>
          {#if demoLoading}<Loader2 size={12} class="animate-spin" aria-hidden="true" />{/if}
          {demoLoading ? 'Loading…' : 'Load demo data'}
        </button>
      </li>
    {/if}

    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <RotateCcw size={17} class="text-zinc-500" aria-hidden="true" />
        <span>
          <span class="block text-zinc-100">Welcome screen</span>
          <span class="block text-xs text-zinc-500">Show it again the next time HuntFlow opens</span>
        </span>
      </span>
      <button type="button" class="hf-button-ghost h-7 min-h-0 text-xs" on:click={relaunchTour}>Replay tour</button>
    </li>

    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <Trash2 size={17} class="text-red-500" aria-hidden="true" />
        <span>
          <span class="block text-red-500">Clear local data</span>
          <span class="block text-xs text-zinc-500">Deletes programs, targets, findings, notes and sessions on this device</span>
        </span>
      </span>
      <button type="button" class="hf-button-ghost h-7 min-h-0 text-xs text-red-500" on:click={() => (showClearModal = true)}>Clear Data</button>
    </li>
  </ul>

  {#if importStatus || importError || demoStatus || demoError || tourStatus}
    <p
      class="border-t-[0.5px] border-zinc-900 px-4 py-2.5 text-xs {importError || demoError ? 'text-red-500' : 'text-green-600 dark:text-green-400'}"
      role="status"
    >
      {importError || demoError || importStatus || demoStatus || tourStatus}
    </p>
  {/if}
</section>

<Modal
  open={showClearModal}
  title="Clear all local data?"
  description="This can't be undone. Export a backup first if you might need anything."
  on:close={() => {
    showClearModal = false;
    clearConfirm = '';
  }}
>
  <label class="block">
    <span class="hf-label">Type CLEAR to confirm</span>
    <input bind:value={clearConfirm} class="hf-input mt-1.5 font-mono" placeholder="CLEAR" autocomplete="off" />
  </label>
  <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <button
      type="button"
      class="hf-button-secondary"
      on:click={() => {
        showClearModal = false;
        clearConfirm = '';
      }}>Cancel</button
    >
    <button type="button" class="hf-button-danger" disabled={clearConfirm !== 'CLEAR'} on:click={confirmClear}>Clear Everything</button>
  </div>
</Modal>
