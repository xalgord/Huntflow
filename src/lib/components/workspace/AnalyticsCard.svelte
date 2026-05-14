<script lang="ts">
  export let title: string;
  export let subtitle = '';
</script>

<section class="hf-card p-4">
  <div class="mb-4">
    <h2 class="text-sm font-semibold text-zinc-100">{title}</h2>
    {#if subtitle}
      <p class="mt-1 text-xs text-zinc-500">{subtitle}</p>
    {/if}
  </div>
  <slot />
</section>
