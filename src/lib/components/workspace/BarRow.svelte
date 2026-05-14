<script lang="ts">
  export let label: string;
  export let value: string;
  export let width: string;
</script>

<div>
  <div class="mb-1 flex items-center justify-between gap-3 text-xs">
    <span class="truncate text-zinc-400">{label}</span>
    <span class="font-mono text-zinc-300">{value}</span>
  </div>
  <div class="h-2 overflow-hidden rounded-full bg-zinc-900">
    <div class="h-full rounded-full bg-zinc-200" style={`width: ${width}`}></div>
  </div>
</div>
