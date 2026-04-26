<script lang="ts" context="module">
  export interface SkeletonProps {
    width?: string;
    height?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'full';
    count?: number;
  }
</script>

<script lang="ts">
  export let width = '100%';
  export let height = '1rem';
  export let rounded: SkeletonProps['rounded'] = 'lg';
  export let count = 1;

  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };
</script>

<div class="space-y-3" aria-hidden="true">
  {#each Array.from({ length: count }) as _, index}
    <div
      class="animate-pulse bg-muted {roundedClass[rounded ?? 'lg']}"
      style:width={index === count - 1 && count > 1 ? `calc(${width} * 0.72)` : width}
      style:height={height}
    ></div>
  {/each}
</div>
