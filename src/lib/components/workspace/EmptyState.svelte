<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { Inbox } from 'lucide-svelte';

  export let title: string;
  export let description: string;
  export let actionLabel: string | undefined = undefined;
  export let href: string | undefined = undefined;
  export let icon: ComponentType = Inbox;
</script>

<section class="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
  <svelte:component this={icon} size={40} strokeWidth={1.4} class="text-zinc-600" aria-hidden="true" />
  <h2 class="mt-3 text-[1.0625rem] font-semibold tracking-[-0.01em] text-zinc-100">{title}</h2>
  <p class="mt-1 max-w-md text-[0.8125rem] leading-5 text-zinc-500">{description}</p>
  {#if actionLabel && href}
    <a href={href} class="hf-button-tinted mt-4">{actionLabel}</a>
  {/if}
  <slot />
</section>
