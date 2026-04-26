<script lang="ts" context="module">
  import type { ComponentType } from 'svelte';

  export interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    disabled?: boolean;
    loading?: boolean;
    label?: string;
    icon?: ComponentType;
    fullWidth?: boolean;
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils';
  import { Loader2 } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let variant: ButtonProps['variant'] = 'primary';
  export let size: ButtonProps['size'] = 'md';
  export let type: ButtonProps['type'] = 'button';
  export let href: ButtonProps['href'] = undefined;
  export let disabled = false;
  export let loading = false;
  export let label = '';
  export let icon: ButtonProps['icon'] = undefined;
  export let fullWidth = false;

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  const variantClass = {
    primary:
      'bg-primary text-primary-foreground shadow-dark-sm hover:bg-primary/90 active:bg-primary/80',
    secondary:
      'border border-border bg-muted/70 text-foreground shadow-inner-line hover:bg-muted active:bg-muted/80',
    outline:
      'border border-border bg-background/50 text-foreground shadow-inner-line hover:bg-muted hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground shadow-dark-sm hover:bg-destructive/90 active:bg-destructive/80',
    icon:
      'bg-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground',
    ghost:
      'bg-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground'
  };

  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  $: classes = cn(
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md font-medium tracking-normal transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'icon' ? 'h-11 w-11 rounded-lg p-0' : sizeClass[size ?? 'md'],
    variantClass[variant ?? 'primary'],
    fullWidth && 'w-full',
    loading && 'cursor-wait opacity-70'
  );

  function handleClick(event: MouseEvent): void {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    dispatch('click', event);
  }
</script>

{#if href && !disabled}
  <a {href} class={classes} aria-label={label || undefined} on:click={handleClick}>
    {#if loading}
      <Loader2 size={16} class="animate-spin" aria-hidden="true" />
    {:else if icon}
      <svelte:component this={icon} size={variant === 'icon' ? 20 : 18} aria-hidden="true" />
    {/if}
    {#if variant !== 'icon'}
      <slot>{label}</slot>
    {/if}
  </a>
{:else}
  <button
    {type}
    disabled={disabled || loading}
    class={classes}
    aria-label={label || undefined}
    aria-busy={loading}
    on:click={handleClick}
  >
    {#if loading}
      <Loader2 size={16} class="animate-spin" aria-hidden="true" />
    {:else if icon}
      <svelte:component this={icon} size={variant === 'icon' ? 20 : 18} aria-hidden="true" />
    {/if}
    {#if variant !== 'icon'}
      <slot>{label}</slot>
    {/if}
  </button>
{/if}
