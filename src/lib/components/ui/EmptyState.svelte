<script lang="ts" context="module">
  import type { ComponentType } from 'svelte';

  export interface EmptyStateProps {
    icon?: ComponentType;
    title: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from './Button.svelte';

  export let icon: EmptyStateProps['icon'] = undefined;
  export let title: EmptyStateProps['title'];
  export let description = '';
  export let actionLabel = '';
  export let actionHref: EmptyStateProps['actionHref'] = undefined;

  const dispatch = createEventDispatcher<{ action: void }>();
</script>

<section class="rounded-lg border border-zinc-700 bg-zinc-800 p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
  {#if icon}
    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-600">
      <svelte:component this={icon} size={48} aria-hidden="true" />
    </div>
  {/if}
  <h2 class="mt-4 text-lg font-semibold text-zinc-300 dark:text-zinc-300">{title}</h2>
  {#if description}
    <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-500">{description}</p>
  {/if}
  {#if actionLabel}
    <div class="mt-5">
      <Button href={actionHref} on:click={() => dispatch('action')}>{actionLabel}</Button>
    </div>
  {/if}
</section>
