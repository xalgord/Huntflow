<script lang="ts">
  import { BarChart3 } from 'lucide-svelte';
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import { navItems } from './navItems';

  export let pathname = '/';

  $: current = navItems.find((item) => item.match(pathname));
  $: title = current?.label ?? 'HuntFlow';
</script>

<header
  class="fixed inset-x-0 top-0 z-30 border-b border-border/80 bg-background/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] text-foreground shadow-dark-sm backdrop-blur-xl lg:hidden"
>
  <div class="mx-auto flex max-w-6xl items-center justify-between gap-3">
    <a href="/dashboard" class="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-foreground">
      <span class="flex h-8 w-8 items-center justify-center rounded-[14px] border border-primary/25 bg-primary/10 text-primary">
        <BrandMark size={22} filled={false} />
      </span>
      HuntFlow
    </a>
    <h1 class="truncate text-sm font-medium text-muted-foreground">{title}</h1>
    <a
      href="/stats"
      class="inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-[14px] text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label="Open stats"
    >
      <BarChart3 size={20} aria-hidden="true" />
    </a>
  </div>
</header>
