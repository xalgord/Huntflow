<script lang="ts">
  import { goto } from '$app/navigation';
  import GlobalSearch from '$lib/components/workspace/GlobalSearch.svelte';
  import QuickAddMenu from '$lib/components/workspace/QuickAddMenu.svelte';
  import { sessionStore, settingsStore, targetStore, timerStore } from '$lib/stores';
  import { formatTimer } from '$lib/utils/workspace';
  import { Menu, Play, Settings, SunMoon, Timer } from 'lucide-svelte';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher<{ openMobileNav: void }>();

  onMount(() => {
    void Promise.all([sessionStore.load(), targetStore.load(), settingsStore.load()]);
  });

  $: activeSession = $timerStore.sessionId
    ? $sessionStore.find((session) => session.id === $timerStore.sessionId)
    : undefined;
  $: activeProgram = activeSession ? $targetStore.find((target) => target.id === activeSession?.targetId) : undefined;
  $: timerActive = $timerStore.status === 'running' || $timerStore.status === 'paused';

  async function toggleTheme(): Promise<void> {
    const next = $settingsStore.theme === 'dark' ? 'light' : $settingsStore.theme === 'light' ? 'system' : 'dark';
    await settingsStore.update((settings) => ({ ...settings, theme: next }));
  }
</script>

<header class="fixed left-0 right-0 top-0 z-30 h-16 border-b border-zinc-900 bg-black/85 backdrop-blur-xl transition-[left] lg:left-[var(--hf-sidebar-width)]">
  <div class="flex h-full w-full items-center gap-2.5 px-4 sm:px-5 xl:px-6">
    <button type="button" class="hf-icon-button lg:hidden" aria-label="Open navigation" on:click={() => dispatch('openMobileNav')}>
      <Menu size={17} aria-hidden="true" />
    </button>

    <div class="hidden min-w-0 flex-1 md:block">
      <GlobalSearch />
    </div>
    <div class="md:hidden">
      <GlobalSearch compact />
    </div>

    {#if timerActive}
      <a
        href="/timer"
        class="hidden min-h-[40px] max-w-[260px] items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 shadow-inner-line sm:flex"
      >
        <span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
        <Timer size={15} aria-hidden="true" />
        <span class="font-mono text-xs text-zinc-100">{formatTimer($timerStore.remainingMs)}</span>
        <span class="truncate text-xs text-zinc-500">{activeProgram?.name ?? 'Active session'}</span>
      </a>
    {/if}

    <QuickAddMenu />

    <button type="button" class="hf-button-primary hidden min-h-[40px] sm:inline-flex" on:click={() => goto('/timer')}>
      <Play size={15} aria-hidden="true" />
      New Session
    </button>

    <button type="button" class="hf-icon-button" aria-label="Cycle theme" title="Cycle theme" on:click={toggleTheme}>
      <SunMoon size={16} aria-hidden="true" />
    </button>

    <a href="/settings" class="hf-icon-button" aria-label="Settings" title="Settings">
      <Settings size={16} aria-hidden="true" />
    </a>
  </div>
</header>
