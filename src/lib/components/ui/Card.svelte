<script lang="ts" context="module">
  export interface CardProps {
    variant?: 'standard' | 'interactive' | 'feature';
    href?: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils';

  export let variant: CardProps['variant'] = 'standard';
  export let href: CardProps['href'] = undefined;
  export let disabled = false;

  const variantClass = {
    standard: 'hf-glass p-4 text-card-foreground',
    interactive:
      'hf-glass hf-interactive cursor-pointer p-4 text-card-foreground hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
    feature: 'hf-glass hf-glass-elevated p-6 text-card-foreground'
  };

  $: classes = cn(
    variant === 'feature' ? 'rounded-[20px]' : 'rounded-2xl',
    'transition duration-200',
    variantClass[variant ?? 'standard'],
    disabled && 'pointer-events-none opacity-60'
  );
</script>

{#if href && !disabled}
  <a {href} class={classes}>
    <slot />
  </a>
{:else}
  <section class={classes}>
    <slot />
  </section>
{/if}
