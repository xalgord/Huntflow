<script lang="ts">
  import type { Platform, Priority, Target } from '$lib/types';
  import { Plus } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { targetStore } from '$lib/stores/targetStore';

  export let selectedTargetId = '';
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    select: { targetId: string };
    create: { target: Target };
  }>();

  const platforms: { label: string; value: Platform }[] = [
    { label: 'HackerOne', value: 'hackerone' },
    { label: 'Bugcrowd', value: 'bugcrowd' },
    { label: 'Intigriti', value: 'intigriti' },
    { label: 'Synack', value: 'synack' },
    { label: 'YesWeHack', value: 'yeswehack' },
    { label: 'Self-hosted', value: 'self-hosted' },
    { label: 'Other', value: 'other' }
  ];

  let creating = false;
  let name = '';
  let platform: Platform = 'hackerone';
  let priority: Priority = 2;
  let error = '';

  $: selectedTargetId, dispatch('select', { targetId: selectedTargetId });

  async function createTarget() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      error = 'Target name is required';
      return;
    }

    const now = Date.now();
    const target: Target = {
      id: crypto.randomUUID(),
      name: trimmedName,
      platform,
      scope: '',
      notes: '',
      priority,
      status: 'recon',
      createdAt: now,
      updatedAt: now,
      sessionCount: 0
    };

    await targetStore.put(target);
    selectedTargetId = target.id;
    dispatch('create', { target });
    creating = false;
    name = '';
    platform = 'hackerone';
    priority = 2;
    error = '';
  }
</script>

<div class="space-y-3">
  <label class="block">
    <span class="hf-label">Target</span>
    <select
      bind:value={selectedTargetId}
      {disabled}
      class="hf-select mt-2"
    >
      <option value="">Select target</option>
      {#each $targetStore as target}
        <option value={target.id}>{target.name}</option>
      {/each}
    </select>
  </label>

  {#if !disabled}
    <button
      type="button"
      class="hf-button-secondary px-3 py-2"
      on:click={() => (creating = !creating)}
    >
      <Plus size={18} aria-hidden="true" />
      Add Target
    </button>
  {/if}

  {#if creating}
    <!--
      The selector lives inside a 360px aside on lg+, so a horizontal 4-column
      grid overflows the card and clips the Save button. Use a vertical flex
      column with explicit w-full controls — bulletproof against any parent
      grid-template propagation.
    -->
    <div class="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/50 p-3 shadow-inner-line">
      <label class="flex w-full flex-col gap-1">
        <span class="text-xs font-medium text-muted-foreground">Name</span>
        <input
          bind:value={name}
          class="hf-input w-full"
          placeholder="Example Corp"
        />
      </label>
      <div class="flex w-full gap-3">
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-xs font-medium text-muted-foreground">Platform</span>
          <select
            bind:value={platform}
            class="hf-select w-full"
          >
            {#each platforms as item}
              <option value={item.value}>{item.label}</option>
            {/each}
          </select>
        </label>
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-xs font-medium text-muted-foreground">Priority</span>
          <select
            bind:value={priority}
            class="hf-select w-full"
          >
            <option value={0}>P0</option>
            <option value={1}>P1</option>
            <option value={2}>P2</option>
            <option value={3}>P3</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        class="hf-button-primary w-full justify-center"
        on:click={createTarget}
      >
        Save
      </button>
      {#if error}
        <p class="text-xs text-red-300">{error}</p>
      {/if}
    </div>
  {/if}
</div>
