<script lang="ts">
  import { browser } from '$app/environment';
  import {
    collectBackupPayload,
    restoreBackupPayload,
    totalsFromPayload,
    type BackupPayload
  } from '$lib/db/backupBundle';
  import { settingsStore } from '$lib/stores';
  import {
    decryptBackup,
    encryptBackup,
    isBackup,
    makePlainBackup,
    type Backup,
    type BackupMeta
  } from '$lib/utils/cryptoBackup';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { APP_VERSION } from '$lib/buildTarget';
  import { AlertTriangle, Archive, Loader2, RotateCw, Upload } from 'lucide-svelte';

  let exportPassphrase = '';
  let exportPassphraseConfirm = '';
  let useEncryption = true;
  let exporting = false;
  let exportError = '';
  let exportSuccess = '';

  let importFile: File | null = null;
  let importPassphrase = '';
  let restoring = false;
  let restoreError = '';
  let restoreSummary: { totals: Record<string, number>; warnings: string[] } | null = null;
  let restoreConfirm = '';
  let restoreStage: 'pick' | 'confirm' | 'done' = 'pick';
  let showBackup = false;

  function closeRestore(): void {
    importFile = null;
    importPassphrase = '';
    restoreConfirm = '';
    restoreError = '';
    restoreStage = 'pick';
  }

  function reset(): void {
    exportError = '';
    exportSuccess = '';
    restoreError = '';
  }

  async function handleExport(): Promise<void> {
    reset();
    if (useEncryption) {
      if (exportPassphrase.length < 6) {
        exportError = 'Passphrase must be at least 6 characters.';
        return;
      }
      if (exportPassphrase !== exportPassphraseConfirm) {
        exportError = 'Passphrases do not match.';
        return;
      }
    }
    exporting = true;
    try {
      const payload = await collectBackupPayload();
      const meta: BackupMeta = {
        exportedAt: Date.now(),
        appVersion: APP_VERSION,
        totals: totalsFromPayload(payload as BackupPayload)
      };

      const bundle: Backup = useEncryption
        ? await encryptBackup(payload, exportPassphrase, meta)
        : makePlainBackup(payload, meta);

      const blob = new Blob([JSON.stringify(bundle)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const ext = useEncryption ? 'huntflow.enc' : 'huntflow.json';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `huntflow-backup-${stamp}.${ext}`;
      anchor.click();
      URL.revokeObjectURL(url);

      await settingsStore.update((s) => ({ ...s, lastExportAt: Date.now() }));
      exportSuccess = `Backup downloaded (${formatTotals(meta.totals)}).`;
      exportPassphrase = '';
      exportPassphraseConfirm = '';
      showBackup = false;
    } catch (error) {
      exportError = error instanceof Error ? error.message : 'Backup failed.';
    } finally {
      exporting = false;
    }
  }

  function formatTotals(totals: Record<string, number>): string {
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');
  }

  function handleFile(event: Event): void {
    reset();
    const input = event.currentTarget as HTMLInputElement;
    importFile = input.files?.[0] ?? null;
    input.value = '';
    restoreStage = importFile ? 'confirm' : 'pick';
    restoreConfirm = '';
  }

  async function handleRestore(): Promise<void> {
    reset();
    if (!importFile) return;
    if (restoreConfirm !== 'RESTORE') {
      restoreError = 'Type RESTORE in the box to continue.';
      return;
    }
    restoring = true;
    try {
      const text = await importFile.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('File is not a valid HuntFlow backup (invalid JSON).');
      }
      if (!isBackup(parsed)) {
        throw new Error('File is not a HuntFlow backup.');
      }
      const bundle = parsed as Backup;

      let payload: unknown;
      if (bundle.encrypted) {
        if (!importPassphrase) {
          throw new Error('This backup is encrypted — enter the passphrase.');
        }
        payload = await decryptBackup(bundle, importPassphrase);
      } else {
        payload = bundle.payload;
      }

      const result = await restoreBackupPayload(payload);
      restoreSummary = result;
      restoreStage = 'done';
    } catch (error) {
      restoreError = error instanceof Error ? error.message : 'Restore failed.';
    } finally {
      restoring = false;
    }
  }

  function reload(): void {
    if (browser) window.location.reload();
  }
</script>

<section class="hf-card overflow-hidden" aria-labelledby="backup-heading">
  <div class="px-4 pb-2 pt-4">
    <h2 id="backup-heading" class="hf-section-title">Full Backup</h2>
    <p class="mt-0.5 text-xs text-zinc-500">Everything, including evidence files. Optionally encrypted with AES-GCM and a passphrase only you know.</p>
  </div>
  <ul class="hf-list border-t-[0.5px] border-zinc-900">
    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <Archive size={17} class="text-blue-500" aria-hidden="true" />
        <span>
          <span class="block text-zinc-100">Back up everything</span>
          <span class="block text-xs text-zinc-500">Programs, findings, notes, recon, payouts and evidence</span>
        </span>
      </span>
      <button type="button" class="hf-button-tinted h-7 min-h-0 text-xs" on:click={() => { reset(); showBackup = true; }}>Back Up…</button>
    </li>
    <li class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="flex items-center gap-2.5">
        <Upload size={17} class="text-orange-500" aria-hidden="true" />
        <span>
          <span class="block text-zinc-100">Restore from backup</span>
          <span class="block text-xs text-zinc-500">Replaces this workspace with the backup's contents</span>
        </span>
      </span>
      <label class="hf-button-ghost h-7 min-h-0 cursor-pointer text-xs">
        Choose backup file
        <input type="file" class="sr-only" accept=".huntflow,.enc,.json,application/json,application/octet-stream" on:change={handleFile} />
      </label>
    </li>
  </ul>
  {#if exportSuccess}
    <p class="border-t-[0.5px] border-zinc-900 px-4 py-2.5 text-xs text-green-600 dark:text-green-400" role="status">{exportSuccess}</p>
  {/if}
</section>

<Modal open={showBackup} title="Back Up Everything" description="Downloads one file with your whole workspace, including evidence." on:close={() => (showBackup = false)}>
  <div class="hf-list overflow-hidden rounded-[12px]" style="background: var(--hf-fill)">
    <Toggle bind:checked={useEncryption} label="Encrypt with passphrase" description="Nobody can read the file without it — including us." />
  </div>
  {#if useEncryption}
    <div class="mt-4 space-y-3">
      <label class="block">
        <span class="hf-label">Passphrase</span>
        <input type="password" bind:value={exportPassphrase} placeholder="At least 6 characters" class="hf-input mt-1.5" autocomplete="new-password" spellcheck="false" />
      </label>
      <label class="block">
        <span class="hf-label">Confirm passphrase</span>
        <input type="password" bind:value={exportPassphraseConfirm} class="hf-input mt-1.5" autocomplete="new-password" spellcheck="false" />
      </label>
      <p class="flex items-start gap-2 rounded-[10px] bg-orange-500/[0.12] p-2.5 text-xs leading-5 text-orange-600 dark:text-orange-400">
        <AlertTriangle size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
        If you lose the passphrase, the backup can't be opened. There is no recovery.
      </p>
    </div>
  {/if}
  {#if exportError}
    <p class="mt-3 text-[0.8125rem] text-red-500" role="alert">{exportError}</p>
  {/if}
  <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <button type="button" class="hf-button-secondary" on:click={() => (showBackup = false)}>Cancel</button>
    <button type="button" class="hf-button-primary" on:click={handleExport} disabled={exporting}>
      {#if exporting}<Loader2 size={15} class="animate-spin" aria-hidden="true" />Building backup…{:else}Download backup{/if}
    </button>
  </div>
</Modal>

<Modal
  open={restoreStage !== 'pick'}
  title={restoreStage === 'done' ? 'Restore Complete' : 'Restore From Backup'}
  description={restoreStage === 'done' ? '' : 'Everything in this workspace will be replaced. Export it first if you are unsure.'}
  closeOnOverlay={restoreStage !== 'done'}
  on:close={restoreStage === 'done' ? reload : closeRestore}
>
  {#if restoreStage === 'confirm'}
    <p class="rounded-[10px] px-3 py-2 text-xs text-zinc-500" style="background: var(--hf-fill)">
      Selected: <span class="font-mono text-zinc-200">{importFile?.name ?? ''}</span>
    </p>
    <div class="mt-4 space-y-3">
      <label class="block">
        <span class="hf-label">Passphrase (if encrypted)</span>
        <input type="password" bind:value={importPassphrase} class="hf-input mt-1.5" autocomplete="off" spellcheck="false" />
      </label>
      <label class="block">
        <span class="hf-label">Type RESTORE to confirm</span>
        <input type="text" bind:value={restoreConfirm} class="hf-input mt-1.5 font-mono" autocomplete="off" spellcheck="false" placeholder="RESTORE" />
      </label>
    </div>
    {#if restoreError}
      <p class="mt-3 text-[0.8125rem] text-red-500" role="alert">{restoreError}</p>
    {/if}
    <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" class="hf-button-secondary" on:click={closeRestore}>Cancel</button>
      <button type="button" class="hf-button-danger" on:click={handleRestore} disabled={restoring || restoreConfirm !== 'RESTORE'}>
        {#if restoring}<Loader2 size={15} class="animate-spin" aria-hidden="true" />Restoring…{:else}Restore workspace{/if}
      </button>
    </div>
  {:else if restoreStage === 'done' && restoreSummary}
    <p class="text-[0.8125rem] text-zinc-400">{formatTotals(restoreSummary.totals) || 'Nothing to restore.'}</p>
    {#if restoreSummary.warnings.length > 0}
      <div class="mt-3 rounded-[10px] bg-orange-500/[0.12] px-3 py-2 text-xs text-orange-600 dark:text-orange-400">
        <p class="font-medium">Some data reported warnings:</p>
        <ul class="mt-1 list-disc space-y-0.5 pl-4">
          {#each restoreSummary.warnings as warning}<li>{warning}</li>{/each}
        </ul>
      </div>
    {/if}
    <button type="button" class="hf-button-primary mt-5 w-full" on:click={reload}>
      <RotateCw size={16} aria-hidden="true" />
      Reload to apply
    </button>
  {/if}
</Modal>
