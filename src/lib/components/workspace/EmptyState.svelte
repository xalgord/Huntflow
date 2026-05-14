<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { Inbox } from 'lucide-svelte';

  export let title: string;
  export let description: string;
  export let actionLabel: string | undefined = undefined;
  export let href: string | undefined = undefined;
  export let icon: ComponentType = Inbox;
</script>

<section class="hf-card flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
  <span class="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500">
    <svelte:component this={icon} size={21} aria-hidden="true" />
  </span>
  <h2 class="mt-4 text-base font-semibold text-zinc-100">{title}</h2>
  <p class="mt-2 max-w-lg text-sm leading-6 text-zinc-500">{description}</p>
  {#if actionLabel && href}
    <a href={href} class="hf-button-primary mt-5">{actionLabel}</a>
  {/if}
</section>
