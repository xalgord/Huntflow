<script lang="ts">
  /**
   * HuntFlow brand mark — a precision-reticle monogram.
   *
   * Composition (32x32 grid):
   *   1. Outer ring at r=9.5 — the scope barrel.
   *   2. Four compass tick marks just outside the ring — they extend the
   *      mark to the edges of the tile so it doesn't read as "icon
   *      floating in a square", but as a single integrated piece.
   *   3. Four inner crosshair segments between the ring and the center
   *      dot — gives the reticle its targeting precision.
   *   4. A solid center dot — the "lock" / aim point.
   *
   * This intentionally evokes the previous Crosshair favicon (which the
   * team liked) but is custom geometry: the lucide Crosshair has only a
   * single ring + 4 lines through the center, while this reticle has
   * gapped crosshairs, dual tick rings, and a filled lock dot — a
   * distinct and more polished mark suitable for a brand identity.
   *
   * The mark sits well within the central 80% safe area, so the same
   * geometry is reused as a full-bleed maskable PWA icon.
   *
   * Two render modes:
   *  - `filled = true` (default): full green tile + white reticle.
   *  - `filled = false`: reticle only, in `currentColor` — for use
   *    inside an existing colored container (e.g. SideNav brand chip).
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
    <rect width="32" height="32" rx="7" fill="#16a34a" />
    <g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round">
      <!-- Outer scope ring -->
      <circle cx="16" cy="16" r="9.5" />
      <!-- Compass tick marks (extending from the tile edge toward the ring) -->
      <line x1="16" y1="3.5" x2="16" y2="6" />
      <line x1="16" y1="26" x2="16" y2="28.5" />
      <line x1="3.5" y1="16" x2="6" y2="16" />
      <line x1="26" y1="16" x2="28.5" y2="16" />
      <!-- Inner crosshair segments (ring → center, with a gap for the dot) -->
      <line x1="16" y1="9" x2="16" y2="12.5" />
      <line x1="16" y1="19.5" x2="16" y2="23" />
      <line x1="9" y1="16" x2="12.5" y2="16" />
      <line x1="19.5" y1="16" x2="23" y2="16" />
    </g>
    <!-- Lock dot -->
    <circle cx="16" cy="16" r="2" fill="#ffffff" />
  {:else}
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="16" cy="16" r="9.5" />
      <line x1="16" y1="3.5" x2="16" y2="6" />
      <line x1="16" y1="26" x2="16" y2="28.5" />
      <line x1="3.5" y1="16" x2="6" y2="16" />
      <line x1="26" y1="16" x2="28.5" y2="16" />
      <line x1="16" y1="9" x2="16" y2="12.5" />
      <line x1="16" y1="19.5" x2="16" y2="23" />
      <line x1="9" y1="16" x2="12.5" y2="16" />
      <line x1="19.5" y1="16" x2="23" y2="16" />
    </g>
    <circle cx="16" cy="16" r="2" fill="currentColor" />
  {/if}
</svg>
