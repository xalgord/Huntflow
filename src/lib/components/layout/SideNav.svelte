<script lang="ts">
  import { Keyboard, PanelLeftClose, PanelLeftOpen, Search, UserRound } from 'lucide-svelte';
  import { authStore } from '$lib/cloud/firebase';
  import { cloudConfigured } from '$lib/cloud/convex';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { shortcutsHelpStore } from '$lib/utils/shortcuts';
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import NavItem from './NavItem.svelte';
  import { navItems } from './navItems';

  export let pathname = '/';
  export let collapsed = false;

  // Detect macOS so we can show the right modifier hint (⌘K vs Ctrl K).
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || '');

  // Pro when signed in with an active subscription.
  $: isPro = $authStore.signedIn && $authStore.isPro;
  $: workspaceLabel = isPro ? 'Pro workspace' : 'Local workspace';
  $: displayName = $authStore.displayName?.trim() || 'Local hunter';
  // Binary subtitle: Pro → Synced, otherwise → Subscribe to sync.
  $: userSubtitle = isPro ? 'Synced' : 'Subscribe to sync';

  // Two-letter avatar fallback for the SideNav user pill — renders
  // when the auth provider has resolved a user but not yet returned a
  // photo URL (fresh signup, slow CDN). Mirrors the avatarInitials()
  // helper on the /account page so both surfaces show the same letters.
  $: initials = (() => {
    const name = displayName.trim();
    if (!name || name === 'Local hunter') return '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();
</script>

<aside
  class="fixed inset-y-0 left-0 z-40 hidden border-r border-border/80 bg-background/90 text-muted-foreground shadow-dark-sm backdrop-blur-xl transition-[width] duration-200 lg:flex lg:flex-col {collapsed
    ? 'w-16'
    : 'w-56'}"
>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="relative flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-3">
      {#if !collapsed}
        <a href="/account" class="group flex min-h-[44px] items-center gap-3 rounded-[14px] px-1 text-foreground">
          <span class="relative flex h-11 w-11 items-center justify-center rounded-[14px] border border-primary/30 bg-primary/10 text-primary shadow-inner-line">
            <BrandMark size={28} />
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
        <a href="/account" class="mx-auto flex h-10 min-h-[40px] w-10 items-center justify-center rounded-[14px] border border-primary/30 bg-primary/10 text-primary" aria-label="HuntFlow">
          <BrandMark size={26} />
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

    <div class="shrink-0 px-3 pt-3">
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

    <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Primary">
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

    <div class="shrink-0 px-3">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-[14px] px-2.5 py-2 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 {collapsed
          ? 'justify-center'
          : ''}"
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        on:click={() => shortcutsHelpStore.set(true)}
      >
        <Keyboard size={14} aria-hidden="true" class="shrink-0" />
        {#if !collapsed}
          <span class="flex-1 truncate text-left">Keyboard shortcuts</span>
          <kbd
            class="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-inner-line"
          >
            ?
          </kbd>
        {/if}
      </button>
    </div>

    {#if !collapsed}
      <!--
        User pill in the SideNav footer. Links to /account (identity +
        subscription), NOT /settings (app preferences). Renders the
        user avatar when available, two-letter initials fallback
        otherwise so the pill never shows a generic icon for a
        signed-in user.
      -->
      <a
        href="/account"
        class="m-3 block rounded-[14px] border-t border-border/70 pt-4 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 {pathname === '/account' ? 'opacity-100' : ''}"
        aria-label="Account settings"
        aria-current={pathname === '/account' ? 'page' : undefined}
      >
        <div class="flex items-center gap-3">
          {#if $authStore.signedIn && $authStore.photoURL}
            <img
              src={$authStore.photoURL}
              alt=""
              width="40"
              height="40"
              class="h-10 w-10 shrink-0 rounded-[14px] border border-border/70 object-cover"
              referrerpolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
          {:else if $authStore.signedIn && initials}
            <span
              class="flex h-10 w-10 items-center justify-center rounded-[14px] border {isPro
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted text-foreground'} text-sm font-semibold"
              aria-hidden="true"
            >
              {initials}
            </span>
          {:else}
            <span
              class="flex h-10 w-10 items-center justify-center rounded-[14px] border {isPro
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted text-muted-foreground'}"
            >
              <UserRound size={20} aria-hidden="true" />
            </span>
          {/if}
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

<style>
  /* Thin, unobtrusive scrollbar for the nav section */
  aside :global(nav) {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--border)) transparent;
  }
  aside :global(nav)::-webkit-scrollbar {
    width: 4px;
  }
  aside :global(nav)::-webkit-scrollbar-track {
    background: transparent;
  }
  aside :global(nav)::-webkit-scrollbar-thumb {
    background: hsl(var(--border));
    border-radius: 9999px;
  }
</style>
