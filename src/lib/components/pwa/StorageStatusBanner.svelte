<script lang="ts">
  import { downloadBackupNow } from '$lib/db/autoBackup';
  import { storageHealth, type StorageHealthState } from '$lib/db/health';
  import { AlertTriangle, Download, HardDrive, RefreshCw } from 'lucide-svelte';

  let downloading = false;
  let downloaded = false;
  let downloadError = '';

  const copy: Record<Exclude<StorageHealthState, 'ok'>, { title: string; body: string; tone: 'red' | 'orange' | 'blue' }> = {
    memory: {
      title: "Changes aren't being saved",
      body:
        "This browser won't let HuntFlow use its storage (private browsing or storage disabled). Anything you add now disappears when this tab closes — download a backup before leaving.",
      tone: 'red'
    },
    quota: {
      title: 'Storage is full',
      body: 'New changes cannot be saved until space is freed. Download a backup, then remove large evidence files or free up disk space.',
      tone: 'red'
    },
    'version-changed': {
      title: 'HuntFlow was updated in another tab',
      body: 'Reload this tab to keep working with your latest data.',
      tone: 'blue'
    },
    blocked: {
      title: 'Finishing an update',
      body: 'Close other HuntFlow tabs or windows so this one can upgrade your data. Nothing is lost.',
      tone: 'orange'
    }
  };

  const toneClass = {
    red: 'bg-red-500/[0.12] text-red-400',
    orange: 'bg-orange-500/[0.12] text-orange-400',
    blue: 'bg-blue-500/[0.12] text-blue-400'
  };

  async function download(): Promise<void> {
    downloading = true;
    downloadError = '';
    try {
      await downloadBackupNow();
      downloaded = true;
    } catch (error) {
      downloadError = error instanceof Error ? error.message : 'Could not build the backup.';
    } finally {
      downloading = false;
    }
  }

  $: state = $storageHealth.state;
  $: message = state === 'ok' ? null : copy[state];
</script>

{#if message}
  <div class="px-4 pt-3 sm:px-6 lg:px-8" role={message.tone === 'red' ? 'alert' : 'status'}>
    <div class="mx-auto flex max-w-[1600px] flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center {toneClass[message.tone]}">
      <div class="flex min-w-0 flex-1 gap-3">
        {#if message.tone === 'blue'}
          <RefreshCw size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
        {:else if state === 'quota'}
          <HardDrive size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
        {:else}
          <AlertTriangle size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
        {/if}
        <div class="min-w-0">
          <p class="text-[0.8125rem] font-semibold">{message.title}</p>
          <p class="mt-0.5 text-xs leading-5 text-zinc-300">{message.body}</p>
          {#if $storageHealth.detail && message.tone === 'red'}
            <p class="mt-1 truncate font-mono text-[0.6875rem] text-zinc-500" title={$storageHealth.detail}>
              {$storageHealth.detail}
            </p>
          {/if}
          {#if downloadError}
            <p class="mt-1 text-xs" role="alert">{downloadError}</p>
          {/if}
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        {#if state === 'memory' || state === 'quota'}
          <button type="button" class="hf-button-primary" disabled={downloading} on:click={download}>
            <Download size={14} aria-hidden="true" />
            {downloaded ? 'Downloaded' : downloading ? 'Preparing…' : 'Download Backup'}
          </button>
        {/if}
        {#if state !== 'blocked'}
          <button type="button" class="hf-button-secondary" on:click={() => location.reload()}>
            <RefreshCw size={14} aria-hidden="true" />
            Reload
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
