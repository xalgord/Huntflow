<script lang="ts">
  /**
   * HuntFlow brand mark — three stacked chevron-cut slabs with a small
   * leading accent diamond on the centre slab. Mirrors the marketing
   * logo image at /brand/huntflow-mark.jpg so every entry point reads
   * as the same brand:
   *
   *   - Marketing landing page hero/footer → JPG (premium polish)
   *   - SideNav, MobileHeader, favicon, PWA icon → this SVG (crisp at
   *     any size, themable for tinted tiles)
   *
   * The silhouette evokes layered hunting passes flowing forward in
   * time — three reconnaissance/probe layers stacked and chevroned to
   * the right, with a cyan accent on the centre layer reading as the
   * "lock-on" highlight.
   *
   * Two render modes:
   *  - filled (default): self-contained green tile + white slabs +
   *    cyan accent. Use on dark surfaces.
   *  - filled={false}: slabs in currentColor, no tile. Use inside a
   *    pre-tinted container (SideNav brand chip, MobileHeader badge).
   */
  export let size = 32;
  export let filled = true;
  export let title = 'HuntFlow';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 32 32"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label={title}
  focusable="false"
>
  {#if filled}
    <!-- Brand tile background (matches the generated marketing JPG). -->
    <rect width="32" height="32" rx="7" fill="#16a34a" />
    <!--
      Three stacked slabs. Each slab is a hexagonal band: notched on
      the leading (left) edge and chevroned to a point on the trailing
      (right) edge. Together they form the layered hunt-pass silhouette.
    -->
    <g fill="#ffffff">
      <path d="M7 7 L21 7 L25 10 L21 13 L7 13 L9.5 10 Z" />
      <path d="M7 14 L21 14 L25 17 L21 20 L7 20 L9.5 17 Z" />
      <path d="M7 21 L21 21 L25 24 L21 27 L7 27 L9.5 24 Z" />
    </g>
    <!-- Cyan accent diamond — the lock-on highlight on the centre slab. -->
    <path d="M14.8 16 L18 17 L14.8 18 L13.4 17 Z" fill="#22d3ee" />
  {:else}
    <g fill="currentColor">
      <path d="M5 6 L19 6 L23 9 L19 12 L5 12 L7.5 9 Z" />
      <path d="M5 13 L19 13 L23 16 L19 19 L5 19 L7.5 16 Z" />
      <path d="M5 20 L19 20 L23 23 L19 26 L5 26 L7.5 23 Z" />
    </g>
  {/if}
</svg>
