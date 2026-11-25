<script lang="ts">
  import { navItems, tabNavItems } from '$lib/components/layout/navItems';
  import StorageStatusBanner from '$lib/components/pwa/StorageStatusBanner.svelte';
  import { MoreHorizontal } from 'lucide-svelte';
  import Sidebar from './Sidebar.svelte';
  import Topbar from './Topbar.svelte';

  export let pathname: string;
  export let collapsed = false;

  let mobileOpen = false;

  $: sidebarWidth = collapsed ? '3.75rem' : '15rem';
  $: current = navItems.find((item) => item.match(pathname));
  $: onTab = tabNavItems.some((item) => item.match(pathname));
</script>

<div class="min-h-screen text-zinc-50" style={`--hf-sidebar-width: ${sidebarWidth}`}>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
  >
    Skip to content
  </a>
  <Sidebar {pathname} bind:collapsed {mobileOpen} on:closeMobile={() => (mobileOpen = false)} />
  <div
    class="min-h-screen transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:pl-[var(--hf-sidebar-width)]"
  >
    <Topbar title={current?.label ?? ''} on:openMobileNav={() => (mobileOpen = true)} />
    <!-- Each page renders its own <main> landmark; this is only the frame. -->
    <div id="main-content" tabindex="-1" class="min-h-screen pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-[3.25rem] outline-none lg:pb-0">
      <StorageStatusBanner />
      <slot />
    </div>
  </div>

  <!-- iPhone-style tab bar -->
  <nav
    class="hf-toolbar-material fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] border-zinc-800 pb-[env(safe-area-inset-bottom)] lg:hidden"
    aria-label="Tab bar"
  >
    <ul class="mx-auto grid h-[3.25rem] max-w-lg grid-cols-5">
      {#each tabNavItems as item}
        {@const active = item.match(pathname)}
        <li>
          <a
            href={item.href}
            class="flex h-full flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium {active
              ? 'text-primary'
              : 'text-zinc-500'}"
            aria-current={active ? 'page' : undefined}
          >
            <svelte:component this={item.icon} size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
            {item.label}
          </a>
        </li>
      {/each}
      <li>
        <button
          type="button"
          class="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium {onTab
            ? 'text-zinc-500'
            : 'text-primary'}"
          aria-label="More sections"
          on:click={() => (mobileOpen = true)}
        >
          <MoreHorizontal size={21} aria-hidden="true" />
          More
        </button>
      </li>
    </ul>
  </nav>
</div>
