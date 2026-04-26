<script lang="ts" context="module">
  export interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
  }
</script>

<script lang="ts">
  import { Loader2 } from 'lucide-svelte';

  export let size: LoadingSpinnerProps['size'] = 'md';
  export let label = 'Loading';

  const sizeClass = {
    sm: 16,
    md: 24,
    lg: 32
  };
</script>

<span class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-primary-400" role="status" aria-label={label}>
  <Loader2 size={sizeClass[size ?? 'md']} class="animate-spin" aria-hidden="true" />
  <span class="sr-only">{label}</span>
</span>
