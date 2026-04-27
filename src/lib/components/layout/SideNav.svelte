<script lang="ts">
  import { Crosshair, PanelLeftClose, PanelLeftOpen, Search, UserRound } from 'lucide-svelte';
  import { clerkAuthStore } from '$lib/cloud/clerk';
  import { cloudConfigured } from '$lib/cloud/convex';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import NavItem from './NavItem.svelte';
  import { navItems } from './navItems';

  export let pathname = '/';
  export let collapsed = false;

  // Detect macOS so we can show the right modifier hint (⌘K vs Ctrl K).
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || '');

  // "Pro workspace" only when the user is actually signed in AND cloud sync is
  // configured. Otherwise show "Local workspace" — honest about the offline-first
  // free tier instead of misleading every visitor with a Pro badge.
  $: isPro = cloudConfigured && $clerkAuthStore.signedIn && $clerkAuthStore.convexAuthenticated;
  $: workspaceLabel = isPro ? 'Pro workspace' : 'Local workspace';
  $: displayName = $clerkAuthStore.displayName?.trim() || 'Local hunter';
  $: userSubtitle = isPro
    ? 'Synced'
    : cloudConfigured
      ? 'Local · sign in to sync'
      : 'Local-only mode';
</script>

<aside
  class="fixed inset-y-0 left-0 z-40 hidden border-r border-border/80 bg-background/90 text-muted-foreground shadow-dark-sm backdrop-blur-xl transition-[width] duration-200 lg:block {collapsed
    ? 'w-16'
    : 'w-56'}"
>
  <div class="flex h-full flex-col">
    <div class="relative flex h-24 items-center justify-between border-b border-border/70 px-3">
      {#if !collapsed}
        <a href="/" class="group flex min-h-[44px] items-center gap-3 rounded-[14px] px-1 text-foreground">
          <span class="relative flex h-11 w-11 items-center justify-center rounded-[14px] border border-primary/30 bg-primary/10 text-primary shadow-inner-line">
            <Crosshair size={22} aria-hidden="true" />
            <span class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary"></span>
          </span>
          <span>
            <span class="block text-base font-semibold leading-5">HuntFlow</span>
            <span
              class="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] {isPro
                ? 'text-primary'
                : 'text-muted-foreground'}"
            >
              {workspaceLabel}
            </span>
          </span>
        </a>
      {:else}
        <a href="/" class="mx-auto flex h-10 min-h-[40px] w-10 items-center justify-center rounded-[14px] border border-primary/30 bg-primary/10 text-primary" aria-label="HuntFlow">
          <Crosshair size={22} aria-hidden="true" />
        </a>
      {/if}
      <button
        type="button"
        class="absolute right-2 top-2 inline-flex h-9 min-h-[36px] w-9 items-center justify-center rounded-[14px] text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        on:click={() => (collapsed = !collapsed)}
      >
        {#if collapsed}
          <PanelLeftOpen size={20} aria-hidden="true" />
        {:else}
          <PanelLeftClose size={20} aria-hidden="true" />
        {/if}
      </button>
    </div>

    <div class="px-3 pt-4">
      <button
        type="button"
        class="group flex w-full items-center gap-2 rounded-[14px] border border-border/70 bg-muted/40 px-2.5 py-2 text-left text-sm text-muted-foreground shadow-inner-line transition hover:border-primary/30 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 {collapsed
          ? 'justify-center'
          : ''}"
        aria-label="Open command palette"
        title="Search and quick actions"
        on:click={() => commandPaletteStore.open()}
      >
        <Search size={16} class="shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
        {#if !collapsed}
          <span class="flex-1 truncate text-xs">Search…</span>
          <kbd
            class="hidden items-center gap-0.5 rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-inner-line sm:inline-flex"
          >
            {isMac ? '⌘' : 'Ctrl'}K
          </kbd>
        {/if}
      </button>
    </div>

    <nav class="flex-1 space-y-2 px-3 py-5" aria-label="Primary">
      {#each navItems as item}
        <NavItem
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={item.match(pathname)}
          {collapsed}
          placement="side"
        />
      {/each}
    </nav>

    {#if !collapsed}
      <a
        href="/settings"
        class="m-3 block border-t border-border/70 pt-4 transition hover:opacity-90"
        aria-label="Open account settings"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-[14px] border {isPro
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground'}"
          >
            <UserRound size={20} aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-foreground">{displayName}</span>
            <span class="block truncate text-[11px] text-muted-foreground">{userSubtitle}</span>
          </span>
          {#if isPro}
            <span
              class="ml-auto h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary))]"
              aria-label="Cloud sync active"
            ></span>
          {/if}
        </div>
      </a>
    {/if}
  </div>
</aside>
