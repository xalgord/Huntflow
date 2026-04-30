<script lang="ts">
  import NavItem from './NavItem.svelte';
  import { navItems } from './navItems';

  export let pathname = '/';
</script>

<nav
  class="fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),0px)+4.25rem)] z-30 border-y border-border/80 bg-background/90 px-2 py-1.5 text-muted-foreground shadow-dark-sm backdrop-blur-xl lg:hidden"
  aria-label="Primary"
>
  <div class="mobile-nav-scroll mx-auto flex h-12 items-center gap-1 overflow-x-auto">
    {#each navItems as item}
      <NavItem
        href={item.href}
        label={item.label}
        icon={item.icon}
        active={item.match(pathname)}
        placement="bottom"
      />
    {/each}
  </div>
</nav>

<style>
  /* Hide scrollbar but keep scroll functionality */
  .mobile-nav-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .mobile-nav-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
