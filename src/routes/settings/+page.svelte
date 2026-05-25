<script lang="ts">
  import { authStore } from '$lib/cloud/firebase';
  import AboutSection from '$lib/components/settings/AboutSection.svelte';
  import AppearanceSettings from '$lib/components/settings/AppearanceSettings.svelte';
  import BackupRestore from '$lib/components/settings/BackupRestore.svelte';
  import DataSettings from '$lib/components/settings/DataSettings.svelte';
  import TimerSettings from '$lib/components/settings/TimerSettings.svelte';
  import { settingsStore } from '$lib/stores';
  import { ArrowRight, BadgeCheck, Settings, UserRound } from 'lucide-svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    void settingsStore.load();
  });

  $: isPro = $authStore.isPro;
  $: signedIn = $authStore.signedIn;
  $: displayName = $authStore.displayName?.trim() || '';
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

    <!--
      Account cross-link. Settings is for app preferences (timer,
      appearance, backup) — identity, password, and subscription live
      on the dedicated /account page. This card surfaces the user's
      current state and gives a one-tap path to manage it.
    -->
    <a
      href="/account"
      class="hf-card flex flex-col gap-3 p-4 transition hover:border-primary/30 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
    >
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border {isPro
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-muted text-muted-foreground'} shadow-inner-line"
      >
        <UserRound size={22} aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-base font-semibold text-foreground">
            {signedIn && displayName ? displayName : 'Account'}
          </h2>
          {#if signedIn}
            {#if isPro}
              <span
                class="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary"
              >
                <BadgeCheck size={11} aria-hidden="true" />
                Pro
              </span>
            {:else}
              <span
                class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Free
              </span>
            {/if}
          {/if}
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          {signedIn
            ? 'Profile, password, connected accounts, sessions, and subscription.'
            : 'Optional account and cloud sync controls live outside the local-first workspace.'}
        </p>
      </div>
      <span class="hidden text-muted-foreground sm:inline-flex">
        <ArrowRight size={18} aria-hidden="true" />
      </span>
    </a>

    <TimerSettings settings={$settingsStore} />
    <AppearanceSettings settings={$settingsStore} />
    <BackupRestore />
    <DataSettings />
    <AboutSection />
  </div>
</main>
