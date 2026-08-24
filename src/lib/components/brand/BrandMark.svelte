<script lang="ts">
  /**
   * HuntFlow brand mark — renders the crimson Xalgorix-family logo
   * (/icons/huntflow-logo.png) at the requested pixel size.
   *
   * The logo art is a self-contained transparent PNG, so it reads
   * correctly on any dark surface (sidebar, footer) or pre-tinted chip
   * (SideNav / MobileHeader brand badge) without needing a tile — the
   * same mark is used at every entry point so the brand stays consistent.
   */
  export let size = 32;
  export let title = 'HuntFlow';
</script>

<img
  src="/icons/huntflow-logo.png"
  alt={title}
  width={size}
  height={size}
  style={`width:${size}px;height:${size}px`}
  class="block shrink-0 object-contain"
  decoding="async"
  draggable="false"
/>
