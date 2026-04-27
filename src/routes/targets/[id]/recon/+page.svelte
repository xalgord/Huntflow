<script lang="ts">
  import { page } from '$app/stores';
  import ReconImport from '$lib/components/recon/ReconImport.svelte';
  import ReconRow from '$lib/components/recon/ReconRow.svelte';
  import { reconAssetStore, targetStore } from '$lib/stores';
  import type { ReconAsset, ReconAssetStatus } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import { ArrowLeft, Network, Plus, Search, Upload } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let loaded = false;
  let query = '';
  let statusFilter: ReconAssetStatus | 'all' = 'all';
  let scopeFilter: 'all' | 'in-scope' | 'out-of-scope' = 'all';
  let showImport = false;
  let manualHostname = '';
  let manualUrl = '';

  onMount(async () => {
    await Promise.all([targetStore.load(), reconAssetStore.load()]);
    loaded = true;
  });

  $: targetId = $page.params.id;
  $: target = $targetStore.find((t) => t.id === targetId);
  $: targetAssets = $reconAssetStore.filter((a) => a.targetId === targetId);
  $: filteredAssets = targetAssets
    .filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (scopeFilter === 'in-scope' && !a.inScope) return false;
      if (scopeFilter === 'out-of-scope' && a.inScope) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [a.hostname, a.url, a.title, a.technologies.join(' '), a.notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  $: stats = (() => {
    const total = targetAssets.length;
    const tested = targetAssets.filter((a) => a.status === 'tested' || a.status === 'safe' || a.status === 'vulnerable').length;
    const vulnerable = targetAssets.filter((a) => a.status === 'vulnerable').length;
    const inScope = targetAssets.filter((a) => a.inScope).length;
    return { total, tested, vulnerable, inScope, coverage: total ? Math.round((tested / total) * 100) : 0 };
  })();

  async function handleImport(event: CustomEvent<{ assets: ReconAsset[] }>) {
    // Deduplicate by hostname within the same target
    const existingHosts = new Set(targetAssets.map((a) => a.hostname));
    const fresh = event.detail.assets.filter((a) => a.hostname && !existingHosts.has(a.hostname));
    if (fresh.length === 0) return;
    await reconAssetStore.putBatch(fresh);
    await reconAssetStore.persistNow();
    showImport = false;
  }

  async function addManual() {
    const hostname = manualHostname.trim();
    if (!hostname) return;
    const now = Date.now();
    await reconAssetStore.put({
      id: generateId(),
      targetId,
      hostname,
      url: manualUrl.trim() || undefined,
      technologies: [],
      inScope: true,
      status: 'untested',
      source: 'manual',
      discoveredAt: now,
      createdAt: now,
      updatedAt: now
    });
    await reconAssetStore.persistNow();
    manualHostname = '';
    manualUrl = '';
  }

  async function updateAsset(event: CustomEvent<{ asset: ReconAsset }>) {
    await reconAssetStore.put(event.detail.asset);
  }

  async function deleteAsset(event: CustomEvent<{ id: string }>) {
    if (!confirm('Delete this recon asset?')) return;
    await reconAssetStore.delete(event.detail.id);
  }
</script>

<svelte:head>
  <title>Recon: {target?.name ?? 'Target'} | HuntFlow</title>
  <meta name="description" content="Asset inventory and recon tracking for this target." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-6xl">
    <a
      href={`/targets/${targetId}`}
      class="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      Back to target
    </a>

    {#if target}
      <header class="hf-page-header">
        <div>
          <p class="hf-eyebrow">Recon · {target.name}</p>
          <h1 class="hf-title">Asset Inventory</h1>
          <p class="hf-description">
            Track every subdomain, host, and URL you've discovered. Mark coverage as you test so
            nothing falls through the cracks.
          </p>
        </div>
        <button
          type="button"
          class="hf-button-primary"
          on:click={() => (showImport = !showImport)}
        >
          <Upload size={18} aria-hidden="true" />
          {showImport ? 'Hide import' : 'Bulk import'}
        </button>
      </header>

      <section class="grid gap-3 sm:grid-cols-4">
        <div class="hf-stat-tile">
          <p class="hf-label">Total Assets</p>
          <p class="mt-1 text-2xl font-semibold text-foreground op-mono">{stats.total}</p>
        </div>
        <div class="hf-stat-tile">
          <p class="hf-label">In Scope</p>
          <p class="mt-1 text-2xl font-semibold text-foreground op-mono">{stats.inScope}</p>
        </div>
        <div class="hf-stat-tile">
          <p class="hf-label">Coverage</p>
          <p class="mt-1 text-2xl font-semibold text-foreground op-mono">{stats.coverage}%</p>
          <p class="text-xs text-muted-foreground">{stats.tested}/{stats.total} tested</p>
        </div>
        <div class="hf-stat-tile">
          <p class="hf-label">Vulnerable</p>
          <p class="mt-1 text-2xl font-semibold text-destructive op-mono">{stats.vulnerable}</p>
        </div>
      </section>

      {#if showImport}
        <section class="hf-card p-4">
          <h2 class="text-lg font-semibold text-foreground">Bulk Import</h2>
          <p class="mb-3 mt-1 text-sm text-muted-foreground">
            Paste recon tool output to bring assets in instantly. Duplicates by hostname are skipped.
          </p>
          <ReconImport {targetId} on:import={handleImport} />
        </section>
      {/if}

      <section class="hf-card p-4">
        <h2 class="text-lg font-semibold text-foreground">Add Asset</h2>
        <form
          class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          on:submit|preventDefault={addManual}
        >
          <input
            bind:value={manualHostname}
            class="hf-input"
            placeholder="api.example.com"
            required
          />
          <input
            bind:value={manualUrl}
            class="hf-input"
            placeholder="https://api.example.com (optional)"
            type="url"
          />
          <button type="submit" class="hf-button-primary">
            <Plus size={18} aria-hidden="true" />
            Add
          </button>
        </form>
      </section>

      <section class="hf-card p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            class="flex flex-1 items-center gap-2 rounded-[14px] border border-input bg-background/70 px-3 shadow-inner-line focus-within:border-primary/60"
          >
            <Search size={18} class="text-muted-foreground" aria-hidden="true" />
            <input
              bind:value={query}
              class="min-h-[44px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              placeholder="Search hosts, tech, notes"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <select bind:value={statusFilter} class="hf-select min-w-[140px]">
              <option value="all">All status</option>
              <option value="untested">Untested</option>
              <option value="in-progress">In progress</option>
              <option value="tested">Tested</option>
              <option value="safe">Safe</option>
              <option value="vulnerable">Vulnerable</option>
            </select>
            <select bind:value={scopeFilter} class="hf-select min-w-[140px]">
              <option value="all">All scope</option>
              <option value="in-scope">In scope</option>
              <option value="out-of-scope">Out of scope</option>
            </select>
          </div>
        </div>
      </section>

      {#if filteredAssets.length > 0}
        <section class="hf-card overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th class="px-3 py-2">Host</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Tech</th>
                <th class="px-3 py-2">Coverage</th>
                <th class="px-3 py-2 text-center">Scope</th>
                <th class="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredAssets as asset (asset.id)}
                <ReconRow
                  {asset}
                  on:update={updateAsset}
                  on:delete={deleteAsset}
                />
              {/each}
            </tbody>
          </table>
        </section>
      {:else}
        <section class="hf-card p-8 text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
            <Network size={24} aria-hidden="true" />
          </div>
          <h2 class="mt-4 text-lg font-semibold text-foreground">
            {targetAssets.length === 0 ? 'No recon assets yet' : 'No assets match'}
          </h2>
          <p class="mt-2 text-sm text-muted-foreground">
            {targetAssets.length === 0
              ? 'Bulk-paste subfinder/httpx output or add hosts manually to start tracking attack surface.'
              : 'Try clearing search or status filters.'}
          </p>
        </section>
      {/if}
    {:else if loaded}
      <section class="hf-card p-8 text-center">
        <h1 class="text-lg font-semibold text-foreground">Target not found</h1>
        <a href="/targets" class="mt-4 inline-flex hf-button-primary">Back to targets</a>
      </section>
    {/if}
  </div>
</main>
