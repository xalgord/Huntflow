<script lang="ts">
  import { fade } from 'svelte/transition';

  export let name = '';
</script>

{#key name}
  <div in:fade={{ duration: 150 }}>
    <slot />
  </div>
{/key}
