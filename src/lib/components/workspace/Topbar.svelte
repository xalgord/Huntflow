<script lang="ts">
  import { goto } from '$app/navigation';
  import GlobalSearch from '$lib/components/workspace/GlobalSearch.svelte';
  import QuickAddMenu from '$lib/components/workspace/QuickAddMenu.svelte';
  import { sessionStore, targetStore, timerStore } from '$lib/stores';
  import { quickCaptureStore } from '$lib/stores/quickCaptureStore';
  import { formatTimer } from '$lib/utils/workspace';
  import { PanelLeft, PenSquare, Play } from 'lucide-svelte';
  import { createEventDispatcher, onMount } from 'svelte';

  export let title = '';

  const dispatch = createEventDispatcher<{ openMobileNav: void }>();

  onMount(() => {
    void Promise.all([sessionStore.load(), targetStore.load()]);
  });

  $: activeSession = $timerStore.sessionId
    ? $sessionStore.find((session) => session.id === $timerStore.sessionId)
    : undefined;
  $: activeProgram = activeSession ? $targetStore.find((target) => target.id === activeSession?.targetId) : undefined;
  $: timerActive = $timerStore.status === 'running' || $timerStore.status === 'paused';
</script>

<header
  class="hf-toolbar-material hf-hairline-b fixed left-0 right-0 top-0 z-30 h-[3.25rem] transition-[left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:left-[calc(var(--hf-sidebar-width)+0.5rem)]"
>
  <div class="flex h-full w-full items-center gap-1.5 px-3 sm:px-4">
    <button
      type="button"
      class="hf-icon-button lg:hidden"
      aria-label="Open navigation"
      on:click={() => dispatch('openMobileNav')}
    >
      <PanelLeft size={18} aria-hidden="true" />
    </button>

    {#if title}
      <p class="min-w-0 truncate text-[0.8125rem] font-semibold text-zinc-100 lg:hidden">{title}</p>
    {/if}

    <div class="flex-1"></div>

    {#if timerActive}
      <a
        href="/timer"
        class="hidden h-8 max-w-[15rem] items-center gap-2 rounded-full px-3 text-xs text-zinc-200 transition sm:flex"
        style="background: var(--hf-fill)"
        title="Open the running session"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full {$timerStore.status === 'running'
            ? 'bg-green-500 animate-priority-pulse'
            : 'bg-orange-500'}"
          aria-hidden="true"
        ></span>
        <span class="font-mono font-medium tabular-nums text-zinc-50">{formatTimer($timerStore.remainingMs)}</span>
        <span class="truncate text-zinc-500">{activeProgram?.name ?? 'Session'}</span>
      </a>
    {/if}

    <button
      type="button"
      class="hf-icon-button"
      aria-label="Quick capture (Shift ⌘K)"
      title="Quick capture  ⇧⌘K"
      on:click={() => quickCaptureStore.open()}
    >
      <PenSquare size={17} aria-hidden="true" />
    </button>

    <QuickAddMenu />

    {#if !timerActive}
      <button
        type="button"
        class="hf-button-primary hidden h-8 min-h-0 sm:inline-flex"
        on:click={() => goto('/timer')}
      >
        <Play size={13} fill="currentColor" aria-hidden="true" />
        Start Session
      </button>
    {/if}

    <div class="ml-1 hidden w-56 md:block xl:w-64">
      <GlobalSearch />
    </div>
    <div class="md:hidden">
      <GlobalSearch compact />
    </div>
  </div>
</header>
