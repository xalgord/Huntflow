<script lang="ts" context="module">
  export interface BadgeProps {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils';

  export let variant: BadgeProps['variant'] = 'default';

  const variantClass = {
    default: 'border border-border bg-muted text-muted-foreground',
    success: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    warning: 'border border-amber-500/30 bg-amber-500/10 text-amber-300',
    danger: 'border border-destructive/30 bg-destructive/10 text-red-300',
    info: 'border border-sky-500/30 bg-sky-500/10 text-sky-300',
    primary: 'border border-primary/30 bg-primary/10 text-primary'
  };
</script>

<span class={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shadow-inner-line', variantClass[variant ?? 'default'])}>
  <slot />
</span>
