<script lang="ts">
  import AboutSection from '$lib/components/settings/AboutSection.svelte';
  import AppearanceSettings from '$lib/components/settings/AppearanceSettings.svelte';
  import CloudSyncSettings from '$lib/components/settings/CloudSyncSettings.svelte';
  import DataSettings from '$lib/components/settings/DataSettings.svelte';
  import TimerSettings from '$lib/components/settings/TimerSettings.svelte';
  import { settingsStore } from '$lib/stores';
  import { Settings } from 'lucide-svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    void settingsStore.load();
  });
</script>

<svelte:head>
  <title>Settings | HuntFlow</title>
  <meta name="description" content="Configure HuntFlow timer, appearance, data, and PWA preferences." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-5xl">
    <header class="hf-page-header">
      <div class="flex items-start gap-3">
      <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
        <Settings size={28} aria-hidden="true" />
      </div>
      <div>
        <p class="hf-eyebrow">Preferences</p>
        <h1 class="hf-title">Settings</h1>
        <p class="hf-description">
          Changes save immediately to IndexedDB and apply locally on this device.
        </p>
      </div>
      </div>
    </header>

    <TimerSettings settings={$settingsStore} />
    <AppearanceSettings settings={$settingsStore} />
    <CloudSyncSettings />
    <DataSettings />
    <AboutSection />
  </div>
</main>
