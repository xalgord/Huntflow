<script lang="ts">
  import NavItem from './NavItem.svelte';
  import { primaryNavItems } from './navItems';

  export let pathname = '/';
</script>

<nav
  class="fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),0px)+4.25rem)] z-30 border-y border-border/80 bg-background/90 px-2 py-2 text-muted-foreground shadow-dark-sm backdrop-blur-xl lg:hidden"
  aria-label="Primary"
>
  <div class="mx-auto flex h-14 max-w-xl items-center gap-1">
    {#each primaryNavItems as item}
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
