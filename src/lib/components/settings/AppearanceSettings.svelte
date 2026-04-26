<script lang="ts">
  import { settingsStore } from '$lib/stores';
  import type { Settings } from '$lib/types';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';

  export let settings: Settings;

  function changeTheme(event: Event): void {
    void settingsStore.setTheme((event.currentTarget as HTMLSelectElement).value as Settings['theme']);
  }

  function changeFontSize(event: Event): void {
    void settingsStore.setValue(
      'fontSize',
      (event.currentTarget as HTMLSelectElement).value as Settings['fontSize']
    );
  }
</script>

<section class="hf-card p-4">
  <h2 class="text-lg font-semibold text-slate-100">Appearance</h2>
  <div class="mt-4 grid gap-4 lg:grid-cols-2">
    <label class="block">
      <span class="hf-label">Theme</span>
      <select
        value={settings.theme}
        class="hf-select mt-2"
        on:change={changeTheme}
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Font size</span>
      <select
        value={settings.fontSize}
        class="hf-select mt-2"
        on:change={changeFontSize}
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </label>

    <div class="lg:col-span-2">
      <ColorPicker
        value={settings.accentColor}
        on:change={(event) => settingsStore.setValue('accentColor', event.detail)}
      />
    </div>
  </div>
</section>
