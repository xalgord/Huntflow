<script lang="ts">
  import TargetCard from '$lib/components/targets/TargetCard.svelte';
  import TargetFilter from '$lib/components/targets/TargetFilter.svelte';
  import TargetForm from '$lib/components/targets/TargetForm.svelte';
  import TargetSearch from '$lib/components/targets/TargetSearch.svelte';
  import { targetStore } from '$lib/stores';
  import type { Platform, Priority, Target, TargetStatus } from '$lib/types';
  import { Flag, Plus } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type StatusFilter = TargetStatus | 'active' | 'all';

  let showForm = false;
  let searchInput = '';
  let query = '';
  let platform: Platform | 'all' = 'all';
  let priority: Priority | 'all' = 'all';
  let status: StatusFilter = 'active';

  onMount(() => {
    void targetStore.load();
  });

  $: sortedTargets = [...$targetStore].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.lastSessionAt ?? b.updatedAt) - (a.lastSessionAt ?? a.updatedAt);
  });

  $: filteredTargets = sortedTargets.filter((target) => {
    if (platform !== 'all' && target.platform !== platform) return false;
    if (priority !== 'all' && target.priority !== priority) return false;
    if (status === 'active' && target.status === 'archived') return false;
    if (status !== 'all' && status !== 'active' && target.status !== status) return false;

    const search = query.toLowerCase();
    if (!search) return true;

    return (
      target.name.toLowerCase().includes(search) ||
      target.platform.toLowerCase().includes(search) ||
      target.scope.toLowerCase().includes(search)
    );
  });

  async function createTarget(event: CustomEvent<{ target: Target }>) {
    await targetStore.put(event.detail.target);
    showForm = false;
  }

  function handleFilterChange(
    event: CustomEvent<{ platform: Platform | 'all'; priority: Priority | 'all'; status: StatusFilter }>
  ) {
    platform = event.detail.platform;
    priority = event.detail.priority;
    status = event.detail.status;
  }
</script>

<svelte:head>
  <title>Targets | HuntFlow</title>
  <meta name="description" content="Track bug bounty programs, scope, priority, status, and sessions." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-6xl">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Target Tracker</p>
        <h1 class="hf-title">Targets</h1>
        <p class="hf-description">
          Manage programs, scope, priority, and status without leaving the offline workflow.
        </p>
      </div>
      <button
        type="button"
        class="hf-button-primary"
        on:click={() => (showForm = true)}
      >
        <Plus size={20} aria-hidden="true" />
        Add Target
      </button>
    </header>

    {#if showForm}
      <section class="hf-card p-4">
        <h2 class="mb-4 text-lg font-semibold text-slate-100">New Target</h2>
        <TargetForm submitLabel="Create Target" on:submit={createTarget} on:cancel={() => (showForm = false)} />
      </section>
    {/if}

    <section class="hf-card space-y-4 p-4">
      <TargetSearch bind:value={searchInput} on:search={(event) => (query = event.detail.value)} />
      <TargetFilter
        {platform}
        {priority}
        {status}
        on:change={handleFilterChange}
      />
    </section>

    {#if filteredTargets.length > 0}
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Target list">
        {#each filteredTargets as target (target.id)}
          <TargetCard {target} />
        {/each}
      </section>
    {:else}
      <section class="hf-card p-8 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-slate-600">
          <Flag size={48} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-slate-300">
          {#if $targetStore.length === 0}
            No targets tracked
          {:else}
            No targets match the filters
          {/if}
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          {#if $targetStore.length === 0}
            Add your first program to start linking sessions and notes.
          {:else}
            Adjust search or filters to widen the target list.
          {/if}
        </p>
        {#if $targetStore.length === 0}
          <button
            type="button"
            class="mt-5 hf-button-primary"
            on:click={() => (showForm = true)}
          >
            <Plus size={20} aria-hidden="true" />
            Add Target
          </button>
        {/if}
      </section>
    {/if}
  </div>
</main>
