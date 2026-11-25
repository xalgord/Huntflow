<script lang="ts" context="module">
  export interface ModalProps {
    open?: boolean;
    title?: string;
    description?: string;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    labelledBy?: string;
  }
</script>

<script lang="ts">
  import { X } from 'lucide-svelte';
  import { createEventDispatcher, onMount, tick } from 'svelte';

  export let open = false;
  export let title = '';
  export let description = '';
  export let closeOnOverlay = true;
  export let closeOnEscape = true;
  export let labelledBy: ModalProps['labelledBy'] = undefined;

  const dispatch = createEventDispatcher<{ close: void }>();
  let dialog: HTMLDivElement;
  $: titleId = labelledBy ?? 'modal-title';

  function close(): void {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (open && closeOnEscape && event.key === 'Escape') close();
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (closeOnOverlay && event.target === event.currentTarget) close();
  }

  // onMount never runs during SSR, so its returned cleanup is also SSR-safe.
  // Using onDestroy directly here would crash adapter-static prerendering
  // because onDestroy DOES fire during SSR cleanup, where `window` is undefined.
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  $: if (open) void tick().then(() => dialog?.focus());
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4 dark:bg-black/50"
    role="presentation"
    on:click={handleOverlayClick}
  >
    <div
      bind:this={dialog}
      class="hf-material max-h-[92vh] w-full animate-scale-in overflow-y-auto rounded-t-[14px] p-5 text-card-foreground shadow-sheet outline-none sm:max-w-lg sm:rounded-[14px] lg:max-w-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      tabindex="-1"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          {#if title}
            <h2 id={titleId} class="text-[1.0625rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {/if}
          {#if description}
            <p class="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">{description}</p>
          {/if}
        </div>
        <button
          type="button"
          class="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition hover:text-zinc-200"
          style="background: var(--hf-fill)"
          aria-label="Close dialog"
          on:click={close}
        >
          <X size={14} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
      <div class={title || description ? 'mt-4' : ''}>
        <slot />
      </div>
    </div>
  </div>
{/if}
