<script lang="ts">
  import { browser } from '$app/environment';
  import { WifiOff } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  let online = true;

  function update(): void {
    online = navigator.onLine;
  }

  onMount(() => {
    if (!browser) return;
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  });
</script>

{#if !online}
  <div class="fixed inset-x-0 top-0 z-50 border-b border-red-500/30 bg-red-600 px-4 py-2 text-white shadow-dark-md">
    <div class="mx-auto flex max-w-6xl items-center justify-center gap-2 text-sm font-medium">
      <WifiOff size={18} aria-hidden="true" />
      Offline Mode
    </div>
  </div>
{/if}
