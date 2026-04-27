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
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-background/80 p-4 backdrop-blur-md"
    role="presentation"
    on:click={handleOverlayClick}
  >
    <div
      bind:this={dialog}
      class="w-full max-w-md animate-scale-in rounded-xl border border-border bg-card/95 p-6 text-card-foreground shadow-dark-xl outline-none backdrop-blur-xl sm:max-w-lg lg:max-w-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      tabindex="-1"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          {#if title}
            <h2 id={titleId} class="text-lg font-semibold text-foreground">{title}</h2>
          {/if}
          {#if description}
            <p class="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          {/if}
        </div>
        <button
          type="button"
          class="inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Close dialog"
          on:click={close}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div class={title || description ? 'mt-4' : ''}>
        <slot />
      </div>
    </div>
  </div>
{/if}
