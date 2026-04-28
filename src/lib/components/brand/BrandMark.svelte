<script lang="ts">
  /**
   * HuntFlow brand mark.
   *
   * Custom monogram designed for HuntFlow: two vertical bars forming an
   * "H" with a continuous horizontal bar that exits the right leg into
   * a forward-pointing arrow head. Reads as "Hunt + Flow" — the H is
   * the initial, and the arrow communicates forward motion / scan-line
   * intent typical of bug-hunting workflows. Distinct from any lucide
   * icon so the brand stays unique.
   *
   * The mark is drawn within an inner safe zone (x:7..25, y:6.5..25.5)
   * of a 32x32 viewBox, which is well inside the 80% maskable PWA
   * safe area — so the same geometry is reused in `/static/icons/huntflow.svg`.
   *
   * Two render modes:
   *  - `filled = true` (default): renders the full green tile + white
   *    mark, self-contained. Use on neutral surfaces.
   *  - `filled = false`: renders just the mark in `currentColor` so it
   *    inherits the parent text color — use when the parent already
   *    provides a colored container (e.g. landing header chip).
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
    <!-- Brand-green tile. Rounded corners look right inside browser
         chrome (favicon, Mac dock, etc.); maskable PWA installs will
         crop to whatever shape the OS prefers, so the rx is purely
         cosmetic when the icon is shown raw. -->
    <rect width="32" height="32" rx="7" fill="#16a34a" />
    <g fill="#ffffff">
      <!-- Left H leg -->
      <rect x="7" y="6.5" width="3" height="19" rx="1.4" />
      <!-- Right H leg -->
      <rect x="14" y="6.5" width="3" height="19" rx="1.4" />
      <!-- Crossbar that visually pierces the right leg, becoming the
           shaft of the forward arrow -->
      <rect x="10" y="14.5" width="11" height="3" rx="0.6" />
      <!-- Arrow head -->
      <path d="M19.75 11 L25.5 16 L19.75 21 Z" />
    </g>
  {:else}
    <g fill="currentColor">
      <rect x="7" y="6.5" width="3" height="19" rx="1.4" />
      <rect x="14" y="6.5" width="3" height="19" rx="1.4" />
      <rect x="10" y="14.5" width="11" height="3" rx="0.6" />
      <path d="M19.75 11 L25.5 16 L19.75 21 Z" />
    </g>
  {/if}
</svg>
