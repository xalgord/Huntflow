<script lang="ts">
  import { clerkAuthStore } from '$lib/cloud/clerk';
  import { BarChart3, UserRound } from 'lucide-svelte';
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import { navItems } from './navItems';

  export let pathname = '/';

  $: current = navItems.find((item) => item.match(pathname));
  $: title = current?.label ?? 'HuntFlow';

  // Two-letter initials fallback for the mobile header avatar — mirrors
  // the same logic used on /account and in SideNav so all three places
  // show the same letters before Clerk resolves an image URL.
  $: mobileInitials = (() => {
    const name = $clerkAuthStore.displayName?.trim() ?? '';
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();
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
    <div class="flex items-center gap-1">
      <a
        href="/stats"
        class="inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-[14px] text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label="Open stats"
      >
        <BarChart3 size={20} aria-hidden="true" />
      </a>
      <!--
        Account link. Renders the user's Clerk avatar when available,
        a two-letter initials chip when signed in but image not yet
        resolved, and the generic UserRound icon when signed out (the
        auth gate will redirect to /sign-in on tap).
      -->
      <a
        href="/account"
        class="inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-[14px] text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label="Open account"
      >
        {#if $clerkAuthStore.signedIn && $clerkAuthStore.imageUrl}
          <img
            src={$clerkAuthStore.imageUrl}
            alt=""
            width="32"
            height="32"
            class="h-8 w-8 rounded-full border border-border/70 object-cover"
            referrerpolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
        {:else if $clerkAuthStore.signedIn && mobileInitials}
          <span
            class="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary"
            aria-hidden="true"
          >
            {mobileInitials}
          </span>
        {:else}
          <UserRound size={20} aria-hidden="true" />
        {/if}
      </a>
    </div>
  </div>
</header>
