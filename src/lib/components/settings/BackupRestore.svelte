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
  import { Download, Lock, ShieldCheck, Upload, AlertTriangle, RotateCw } from 'lucide-svelte';

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
        appVersion: '1.0.0',
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

<section class="hf-card p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="flex items-start gap-3">
      <span class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
        <ShieldCheck size={22} aria-hidden="true" />
      </span>
      <div>
        <h2 class="text-lg font-semibold text-foreground">Encrypted backup &amp; restore</h2>
        <p class="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          One-click full-workspace backup including evidence binaries. Encrypts with AES-GCM
          locked behind a passphrase you choose — nobody (not even us) can read the file
          without it.
        </p>
      </div>
    </div>
  </div>

  <!-- ── EXPORT ─────────────────────────────────────────────────────── -->
  <div class="mt-5 grid gap-4 lg:grid-cols-2">
    <div class="rounded-[14px] border border-border/70 bg-muted/30 p-4 shadow-inner-line">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Download size={16} aria-hidden="true" />
        Create backup
      </h3>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        Includes targets, sessions, notes, payouts, submissions, payloads, recon, evidence
        and binaries.
      </p>

      <label class="mt-4 flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" bind:checked={useEncryption} class="accent-primary" />
        <span class="flex items-center gap-1">
          <Lock size={14} aria-hidden="true" />
          Encrypt with passphrase
        </span>
      </label>

      {#if useEncryption}
        <div class="mt-3 space-y-2">
          <label class="block">
            <span class="hf-label">Passphrase</span>
            <input
              type="password"
              bind:value={exportPassphrase}
              placeholder="At least 6 characters"
              class="hf-input mt-1"
              autocomplete="new-password"
              spellcheck="false"
            />
          </label>
          <label class="block">
            <span class="hf-label">Confirm passphrase</span>
            <input
              type="password"
              bind:value={exportPassphraseConfirm}
              class="hf-input mt-1"
              autocomplete="new-password"
              spellcheck="false"
            />
          </label>
          <p class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] leading-4 text-amber-200/90">
            <AlertTriangle size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              We can&apos;t recover this. If you lose the passphrase, the backup becomes
              permanently unreadable.
            </span>
          </p>
        </div>
      {/if}

      <button
        type="button"
        class="hf-button-primary mt-4 w-full"
        on:click={handleExport}
        disabled={exporting}
      >
        {#if exporting}
          Building backup…
        {:else}
          <Download size={16} aria-hidden="true" />
          Download backup
        {/if}
      </button>

      {#if exportError}
        <p class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {exportError}
        </p>
      {/if}
      {#if exportSuccess}
        <p class="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {exportSuccess}
        </p>
      {/if}
    </div>

    <!-- ── RESTORE ────────────────────────────────────────────────────── -->
    <div class="rounded-[14px] border border-border/70 bg-muted/30 p-4 shadow-inner-line">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Upload size={16} aria-hidden="true" />
        Restore from backup
      </h3>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        Replaces every local entity with what&apos;s in the backup. The current workspace
        is wiped — export it first if you&apos;re unsure.
      </p>

      {#if restoreStage === 'pick'}
        <label class="mt-4 inline-flex w-full min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-border bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-muted/50">
          <Upload size={16} aria-hidden="true" />
          Choose backup file
          <input type="file" class="sr-only" accept=".huntflow,.enc,.json,application/json,application/octet-stream" on:change={handleFile} />
        </label>
      {:else if restoreStage === 'confirm'}
        <div class="mt-4 space-y-3">
          <p class="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            Selected: <span class="font-mono text-foreground">{importFile?.name ?? ''}</span>
          </p>

          <label class="block">
            <span class="hf-label">Passphrase (if encrypted)</span>
            <input
              type="password"
              bind:value={importPassphrase}
              class="hf-input mt-1"
              autocomplete="off"
              spellcheck="false"
            />
          </label>

          <label class="block">
            <span class="hf-label">Type RESTORE to confirm</span>
            <input
              type="text"
              bind:value={restoreConfirm}
              class="hf-input mt-1 font-mono"
              autocomplete="off"
              spellcheck="false"
              placeholder="RESTORE"
            />
          </label>

          <div class="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              class="hf-button-secondary flex-1"
              on:click={() => {
                importFile = null;
                importPassphrase = '';
                restoreConfirm = '';
                restoreStage = 'pick';
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              class="hf-button-primary flex-1 disabled:bg-destructive/30"
              on:click={handleRestore}
              disabled={restoring || restoreConfirm !== 'RESTORE'}
            >
              {#if restoring}
                Restoring…
              {:else}
                Restore workspace
              {/if}
            </button>
          </div>
        </div>
      {:else if restoreStage === 'done' && restoreSummary}
        <div class="mt-4 space-y-3">
          <div class="rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-xs text-primary">
            <p class="font-medium">Restore complete.</p>
            <p class="mt-1 text-foreground/80">{formatTotals(restoreSummary.totals)}</p>
          </div>
          {#if restoreSummary.warnings.length > 0}
            <div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              <p class="font-medium">Some stores reported warnings:</p>
              <ul class="mt-1 list-disc space-y-0.5 pl-4">
                {#each restoreSummary.warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}
          <button type="button" class="hf-button-primary w-full" on:click={reload}>
            <RotateCw size={16} aria-hidden="true" />
            Reload to apply
          </button>
        </div>
      {/if}

      {#if restoreError}
        <p class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {restoreError}
        </p>
      {/if}
    </div>
  </div>
</section>
