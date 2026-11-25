<script lang="ts">
  import { isServedByCli } from '$lib/db/autoBackup';
  import {
    fetchInboxItem,
    inboxItems,
    matchProgram,
    refreshInbox,
    removeInboxItem,
    startInboxPolling,
    type InboxItem
  } from '$lib/cli/inbox';
  import { targetStore } from '$lib/stores';
  import { IMPORT_KIND_LABELS, detectImportKind, type ImportKind } from '$lib/utils/importers';
  import { TerminalSquare, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import ImportSheet from './ImportSheet.svelte';

  let enabled = false;
  let active: InboxItem | null = null;
  let open = false;
  let programId = '';
  let loading = false;

  onMount(() => {
    // Only the `npx huntflow` server has an inbox; never probe the hosted app.
    if (!isServedByCli()) return;
    enabled = true;
    void targetStore.load();
    return startInboxPolling();
  });

  $: next = $inboxItems[0];
  $: waiting = $inboxItems.length;

  async function review(): Promise<void> {
    if (!next || loading) return;
    loading = true;
    const item = await fetchInboxItem(next.id);
    loading = false;
    if (!item) {
      await refreshInbox();
      return;
    }
    active = item;
    programId = matchProgram(item.program, $targetStore)?.id ?? $targetStore[0]?.id ?? '';
    open = true;
  }

  async function discard(): Promise<void> {
    if (next) await removeInboxItem(next.id);
  }

  async function handleImported(): Promise<void> {
    if (active) await removeInboxItem(active.id);
  }

  function handleClose(): void {
    open = false;
    active = null;
    // Imported items are gone; skipped ones stay queued for later.
    void refreshInbox();
  }

  function describe(item: { lines: number; kind?: ImportKind; fileName?: string; program?: string; preview: string }): string {
    const what = item.fileName ?? IMPORT_KIND_LABELS[item.kind ?? detectImportKind(item.preview)];
    return `${what} · ${item.lines.toLocaleString()} line${item.lines === 1 ? '' : 's'}${item.program ? ` · ${item.program}` : ''}`;
  }
</script>

{#if enabled && next && !open}
  <div
    class="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md animate-scale-in items-center gap-3 rounded-[14px] px-3.5 py-2.5 shadow-sheet lg:bottom-5 lg:left-auto lg:right-5 lg:mx-0"
    style="background: var(--hf-surface-elevated)"
    role="status"
    aria-label="Output from your terminal"
  >
    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-primary/[0.12] text-primary">
      <TerminalSquare size={17} aria-hidden="true" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-[0.8125rem] font-semibold text-zinc-100">
        From your terminal{waiting > 1 ? ` · ${waiting} waiting` : ''}
      </p>
      <p class="truncate text-xs text-zinc-500">{describe(next)}</p>
    </div>
    <button type="button" class="hf-button-tinted h-8 min-h-0 shrink-0 px-3 text-xs" disabled={loading} on:click={review}>Review</button>
    <button type="button" class="hf-icon-button h-8 w-8 shrink-0" title="Discard" aria-label="Discard terminal import" on:click={discard}>
      <X size={15} aria-hidden="true" />
    </button>
  </div>
{/if}

{#if enabled && active}
  <ImportSheet
    {open}
    {programId}
    initialText={active.text}
    initialKind={active.kind ?? 'auto'}
    initialFileName={active.fileName ?? ''}
    sourceLabel={`From your terminal${active.program ? ` · --program ${active.program}` : ''}`}
    on:imported={handleImported}
    on:close={handleClose}
  />
{/if}
