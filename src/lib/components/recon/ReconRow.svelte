<script lang="ts">
  import type { ReconAsset, ReconAssetStatus } from '$lib/types';
  import { ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion, Trash2 } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let asset: ReconAsset;

  const dispatch = createEventDispatcher<{
    update: { asset: ReconAsset };
    delete: { id: string };
  }>();

  const statuses: { value: ReconAssetStatus; label: string }[] = [
    { value: 'untested', label: 'Untested' },
    { value: 'in-progress', label: 'In progress' },
    { value: 'tested', label: 'Tested' },
    { value: 'safe', label: 'Safe' },
    { value: 'vulnerable', label: 'Vulnerable' }
  ];

  function statusColor(status: ReconAssetStatus): string {
    switch (status) {
      case 'vulnerable':
        return 'border-destructive/40 bg-destructive/15 text-destructive';
      case 'safe':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'in-progress':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'tested':
        return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
      default:
        return 'border-border/60 bg-muted/30 text-muted-foreground';
    }
  }

  function statusIcon(status: ReconAssetStatus) {
    if (status === 'vulnerable') return ShieldAlert;
    if (status === 'safe') return ShieldCheck;
    return ShieldQuestion;
  }

  async function handleStatusChange(event: Event) {
    const status = (event.target as HTMLSelectElement).value as ReconAssetStatus;
    dispatch('update', {
      asset: {
        ...asset,
        status,
        lastTestedAt: ['tested', 'safe', 'vulnerable'].includes(status) ? Date.now() : asset.lastTestedAt,
        updatedAt: Date.now()
      }
    });
  }

  async function toggleScope() {
    dispatch('update', {
      asset: { ...asset, inScope: !asset.inScope, updatedAt: Date.now() }
    });
  }
</script>

<tr class="border-t border-border/60 hover:bg-muted/20">
  <td class="px-3 py-2 align-top">
    <div class="flex items-start gap-2">
      <svelte:component this={statusIcon(asset.status)} size={16} class="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-foreground">{asset.hostname}</p>
        {#if asset.title}
          <p class="truncate text-xs text-muted-foreground">{asset.title}</p>
        {/if}
      </div>
    </div>
  </td>
  <td class="px-3 py-2 align-top">
    {#if asset.url}
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-1 text-xs text-primary hover:underline op-mono"
      >
        {asset.httpStatus ?? '—'}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    {:else}
      <span class="text-xs text-muted-foreground op-mono">—</span>
    {/if}
  </td>
  <td class="px-3 py-2 align-top">
    {#if asset.technologies.length > 0}
      <div class="flex flex-wrap gap-1">
        {#each asset.technologies.slice(0, 3) as tech}
          <span class="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">{tech}</span>
        {/each}
        {#if asset.technologies.length > 3}
          <span class="text-[10.5px] text-muted-foreground">+{asset.technologies.length - 3}</span>
        {/if}
      </div>
    {:else}
      <span class="text-xs text-muted-foreground">—</span>
    {/if}
  </td>
  <td class="px-3 py-2 align-top">
    <select
      class="rounded-md border bg-muted/30 px-2 py-1 text-xs font-medium {statusColor(asset.status)}"
      on:change={handleStatusChange}
    >
      {#each statuses as option}
        <option value={option.value} selected={asset.status === option.value}>{option.label}</option>
      {/each}
    </select>
  </td>
  <td class="px-3 py-2 align-top text-center">
    <button
      type="button"
      class="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition {asset.inScope ? 'border border-primary/40 bg-primary/15 text-primary' : 'border border-border/60 bg-muted/30 text-muted-foreground'}"
      aria-pressed={asset.inScope}
      on:click={toggleScope}
    >
      {asset.inScope ? 'In scope' : 'Out'}
    </button>
  </td>
  <td class="px-3 py-2 align-top text-right">
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete asset"
      on:click={() => dispatch('delete', { id: asset.id })}
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  </td>
</tr>
