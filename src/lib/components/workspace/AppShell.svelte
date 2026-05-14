<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import Topbar from './Topbar.svelte';

  export let pathname: string;
  export let collapsed = false;

  let mobileOpen = false;

  $: sidebarWidth = collapsed ? '4rem' : '14rem';
</script>

<div class="min-h-screen bg-black text-zinc-50" style={`--hf-sidebar-width: ${sidebarWidth}`}>
  <Sidebar
    {pathname}
    bind:collapsed
    {mobileOpen}
    on:closeMobile={() => (mobileOpen = false)}
  />
  <div class="min-h-screen transition-[padding] duration-200 lg:pl-[var(--hf-sidebar-width)]">
    <Topbar on:openMobileNav={() => (mobileOpen = true)} />
    <main class="min-h-screen pt-16">
      <slot />
    </main>
  </div>
</div>
