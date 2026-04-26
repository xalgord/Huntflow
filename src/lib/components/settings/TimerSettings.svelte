<script lang="ts">
  import { settingsStore } from '$lib/stores';
  import type { Settings } from '$lib/types';
  import Toggle from '$lib/components/ui/Toggle.svelte';

  export let settings: Settings;

  const durations = [15, 25, 45, 60];
  const breaks = [5, 10, 15];
  const longBreaks = [10, 15, 20, 30];

  function seconds(minutes: number): number {
    return minutes * 60;
  }
</script>

<section class="hf-card p-4">
  <h2 class="text-lg font-semibold text-slate-100">Timer</h2>
  <div class="mt-4 grid gap-4 lg:grid-cols-2">
    <label class="block">
      <span class="hf-label">Default session duration</span>
      <select
        value={settings.defaultDuration / 60}
        class="hf-select mt-2"
        on:change={(event) => settingsStore.setValue('defaultDuration', seconds(Number(event.currentTarget.value)))}
      >
        {#each durations as duration}
          <option value={duration}>{duration} minutes</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Break duration</span>
      <select
        value={settings.breakDuration / 60}
        class="hf-select mt-2"
        on:change={(event) => settingsStore.setValue('breakDuration', seconds(Number(event.currentTarget.value)))}
      >
        {#each breaks as duration}
          <option value={duration}>{duration} minutes</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Long break after</span>
      <select
        value={settings.sessionsBeforeLongBreak}
        class="hf-select mt-2"
        on:change={(event) => settingsStore.setValue('sessionsBeforeLongBreak', Number(event.currentTarget.value))}
      >
        {#each [3, 4, 5] as count}
          <option value={count}>{count} sessions</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Long break duration</span>
      <select
        value={settings.longBreakDuration / 60}
        class="hf-select mt-2"
        on:change={(event) => settingsStore.setValue('longBreakDuration', seconds(Number(event.currentTarget.value)))}
      >
        {#each longBreaks as duration}
          <option value={duration}>{duration} minutes</option>
        {/each}
      </select>
    </label>

    <Toggle
      checked={settings.autoStartBreak}
      label="Auto-start break timer"
      description="Start the configured break after a completed focus session."
      on:change={(event) => settingsStore.setValue('autoStartBreak', event.detail)}
    />
    <Toggle
      checked={settings.soundEnabled}
      label="Sound notifications"
      description="Play a short sound when a session finishes."
      on:change={(event) => settingsStore.setValue('soundEnabled', event.detail)}
    />
    <Toggle
      checked={settings.vibrationEnabled}
      label="Vibration"
      description="Use device vibration on mobile when supported."
      on:change={(event) => settingsStore.setValue('vibrationEnabled', event.detail)}
    />
  </div>
</section>
