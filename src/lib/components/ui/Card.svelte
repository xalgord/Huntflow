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
    standard:
      'border border-border/80 bg-card/90 p-4 text-card-foreground shadow-dark-sm backdrop-blur-xl hover:border-border',
    interactive:
      'cursor-pointer border border-border/80 bg-card/90 p-4 text-card-foreground shadow-dark-sm backdrop-blur-xl hover:-tranzinc-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-dark-md active:tranzinc-y-0 active:scale-[0.99]',
    feature:
      'border border-primary/30 bg-card/95 p-6 text-card-foreground shadow-dark-md backdrop-blur-xl'
  };

  $: classes = cn(
    variant === 'feature' ? 'rounded-xl' : 'rounded-lg',
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
