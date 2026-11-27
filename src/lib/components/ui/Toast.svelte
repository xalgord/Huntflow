<script lang="ts" context="module">
  export interface ToastProps {
    open?: boolean;
    type?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
    title?: string;
    message?: string;
    duration?: number;
  }
</script>

<script lang="ts">
  import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-svelte';
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let open = true;
  export let type: ToastProps['type'] = 'info';
  export let title = '';
  export let message = '';
  export let duration = 4000;

  const dispatch = createEventDispatcher<{ dismiss: void }>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const typeClass = {
    success: 'text-green-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    info: 'text-blue-400',
    primary: 'text-primary-400'
  };

  const iconByType = {
    success: CheckCircle,
    warning: AlertCircle,
    danger: XCircle,
    info: Info,
    primary: Info
  };

  function dismiss(): void {
    open = false;
    dispatch('dismiss');
  }

  function startTimer(): void {
    if (timer) clearTimeout(timer);
    if (open && duration > 0) timer = setTimeout(dismiss, duration);
  }

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });

  $: icon = iconByType[type ?? 'info'];
  $: if (open) startTimer();
</script>

{#if open}
  <section
    class="hf-material hf-rim hf-floating-pane fixed inset-x-4 top-4 z-50 animate-slide-up rounded-[18px] px-4 py-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-96 {typeClass[
      type ?? 'info'
    ]}"
    role="status"
  >
    <div class="flex items-start gap-3">
      <svelte:component this={icon} size={20} aria-hidden="true" />
      <div class="min-w-0 flex-1">
        {#if title}
          <h2 class="text-sm font-semibold text-zinc-100 dark:text-zinc-100">{title}</h2>
        {/if}
        {#if message}
          <p class="mt-1 text-sm leading-5 text-zinc-400 dark:text-zinc-400">{message}</p>
        {:else}
          <slot />
        {/if}
      </div>
      <button
        type="button"
        class="inline-flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-[var(--hf-fill)] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        aria-label="Dismiss notification"
        on:click={dismiss}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  </section>
{/if}
