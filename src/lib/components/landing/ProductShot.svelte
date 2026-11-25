<script lang="ts">
  /** A screenshot from static/screenshots/v3, in the visitor's appearance. */
  export let name: string;
  export let alt: string;
  export let eager = false;
</script>

<figure class="overflow-hidden rounded-[12px] shadow-[var(--hf-shadow-xl)] ring-1 ring-black/[0.06] dark:ring-white/[0.08] sm:rounded-[16px]">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/screenshots/v3/{name}-dark.webp" />
    <img
      src="/screenshots/v3/{name}-light.webp"
      {alt}
      width="1920"
      height="1200"
      class="block h-auto w-full"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={eager ? 'high' : 'auto'}
    />
  </picture>
</figure>
