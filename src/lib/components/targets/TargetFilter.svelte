<script lang="ts" context="module">
  import type { TargetStatus } from '$lib/types';

  export type StatusFilter = TargetStatus | 'active' | 'all';
</script>

<script lang="ts">
  import type { Platform, Priority } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  import PlatformIcon from './PlatformIcon.svelte';

  export let platform: Platform | 'all' = 'all';
  export let priority: Priority | 'all' = 'all';
  export let status: StatusFilter = 'active';

  const dispatch = createEventDispatcher<{
    change: { platform: Platform | 'all'; priority: Priority | 'all'; status: StatusFilter };
  }>();

  const platforms: Array<{ label: string; value: Platform | 'all' }> = [
    { label: 'All platforms', value: 'all' },
    { label: 'HackerOne', value: 'hackerone' },
    { label: 'Bugcrowd', value: 'bugcrowd' },
    { label: 'Intigriti', value: 'intigriti' },
    { label: 'Synack', value: 'synack' },
    { label: 'YesWeHack', value: 'yeswehack' },
    { label: 'Self-hosted', value: 'self-hosted' },
    { label: 'Other', value: 'other' }
  ];

  const statuses: Array<{ label: string; value: StatusFilter }> = [
    { label: 'Active', value: 'active' },
    { label: 'All statuses', value: 'all' },
    { label: 'Recon', value: 'recon' },
    { label: 'Testing', value: 'testing' },
    { label: 'Reported', value: 'reported' },
    { label: 'Paid', value: 'paid' },
    { label: 'Closed', value: 'closed' },
    { label: 'Archived', value: 'archived' }
  ];

  $: dispatch('change', { platform, priority, status });
</script>

<div class="grid gap-3 sm:grid-cols-3">
  <label class="block">
    <span class="hf-label">Platform</span>
    <select
      bind:value={platform}
      class="hf-select mt-2"
    >
      {#each platforms as item}
        <option value={item.value}>{item.label}</option>
      {/each}
    </select>
    <div class="mt-2 h-5">
      {#if platform !== 'all'}
        <PlatformIcon platform={platform} />
      {/if}
    </div>
  </label>

  <label class="block">
    <span class="hf-label">Priority</span>
    <select
      bind:value={priority}
      class="hf-select mt-2"
    >
      <option value="all">All priorities</option>
      <option value={0}>P0 Critical</option>
      <option value={1}>P1 High</option>
      <option value={2}>P2 Medium</option>
      <option value={3}>P3 Low</option>
    </select>
  </label>

  <label class="block">
    <span class="hf-label">Status</span>
    <select
      bind:value={status}
      class="hf-select mt-2"
    >
      {#each statuses as item}
        <option value={item.value}>{item.label}</option>
      {/each}
    </select>
  </label>
</div>
