<script lang="ts" context="module">
  import type { ComponentType } from 'svelte';

  export interface NavItemProps {
    href: string;
    label: string;
    icon: ComponentType;
    active?: boolean;
    collapsed?: boolean;
    placement?: 'bottom' | 'side';
  }
</script>

<script lang="ts">
  export let href: NavItemProps['href'];
  export let label: NavItemProps['label'];
  export let icon: NavItemProps['icon'];
  export let active = false;
  export let collapsed = false;
  export let placement: NavItemProps['placement'] = 'side';

  $: bottomClass = active
    ? 'bg-primary text-primary-foreground shadow-inner-line'
    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground';
  $: sideClass = active
    ? 'border-primary/40 bg-primary text-primary-foreground shadow-inner-line'
    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground';
</script>

<a
  {href}
  class={placement === 'bottom'
    ? `flex min-h-[44px] min-w-[4rem] shrink-0 flex-col items-center justify-center rounded-[14px] px-2 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${bottomClass}`
    : `flex h-10 min-h-[40px] items-center gap-3 rounded-[14px] border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${collapsed ? 'justify-center' : ''} ${sideClass}`}
  aria-current={active ? 'page' : undefined}
  title={collapsed ? label : undefined}
>
  <svelte:component this={icon} size={placement === 'bottom' ? 22 : 24} aria-hidden="true" />
  {#if placement === 'bottom'}
    <span class="mt-1 leading-none">{label}</span>
  {:else if !collapsed}
    <span>{label}</span>
  {:else}
    <span class="sr-only">{label}</span>
  {/if}
</a>
