<script lang="ts">
  import type { Platform } from '$lib/types';
  import { Bug, Building2, Globe, Shield, Target } from 'lucide-svelte';

  export let platform: Platform = 'other';
  export let size = 18;

  const labels: Record<Platform, string> = {
    hackerone: 'HackerOne',
    bugcrowd: 'Bugcrowd',
    intigriti: 'Intigriti',
    synack: 'Synack',
    yeswehack: 'YesWeHack',
    'self-hosted': 'Self-hosted',
    other: 'Other'
  };

  $: label = labels[platform];
</script>

<span class="inline-flex items-center gap-1.5 text-zinc-400" title={label}>
  {#if platform === 'hackerone'}
    <Shield {size} aria-hidden="true" />
  {:else if platform === 'bugcrowd'}
    <Bug {size} aria-hidden="true" />
  {:else if platform === 'intigriti'}
    <Target {size} aria-hidden="true" />
  {:else if platform === 'synack'}
    <Building2 {size} aria-hidden="true" />
  {:else}
    <Globe {size} aria-hidden="true" />
  {/if}
  <span class="text-xs font-medium">{label}</span>
</span>
