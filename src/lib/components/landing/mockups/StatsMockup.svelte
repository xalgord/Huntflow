<script lang="ts">
  import { Crosshair } from 'lucide-svelte';

  // Random-ish but deterministic bar heights and heatmap densities
  const bars = [22, 38, 26, 64, 48, 72, 55, 41, 88, 60, 52, 36, 70, 44, 58, 78, 50, 32, 66, 84, 48, 56, 30, 42, 68, 90, 62, 46, 74, 58];
  const heatmap = Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 30 }, (_, col) => (row + col * 7) % 13)
  );

  function heatColor(v: number): string {
    if (v <= 1) return 'bg-zinc-900';
    if (v <= 4) return 'bg-primary-900/70';
    if (v <= 7) return 'bg-primary-700/70';
    if (v <= 10) return 'bg-primary-500/70';
    return 'bg-primary-400';
  }

  const vulns = [
    { name: 'SSRF', pct: 28, color: 'bg-rose-500' },
    { name: 'IDOR', pct: 22, color: 'bg-amber-500' },
    { name: 'XSS', pct: 18, color: 'bg-sky-500' },
    { name: 'Auth bypass', pct: 16, color: 'bg-emerald-500' },
    { name: 'RCE', pct: 10, color: 'bg-violet-500' },
    { name: 'Other', pct: 6, color: 'bg-zinc-500' }
  ];
</script>

<div class="grid h-full grid-cols-[180px_1fr] bg-zinc-950 text-zinc-200">
  <aside class="flex flex-col gap-1 border-r border-zinc-900 bg-zinc-950 p-3">
    <div class="mb-3 flex items-center gap-2 px-1.5 py-1.5">
      <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-zinc-950">
        <Crosshair size={14} aria-hidden="true" />
      </span>
      <span class="text-xs font-semibold tracking-tight text-zinc-100">HuntFlow</span>
    </div>
    {#each ['Dashboard', 'Timer', 'Targets', 'Notes', 'Evidence', 'Stats', 'Income'] as item, i}
      <div
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] {i === 5
          ? 'bg-primary-500/10 text-primary-200'
          : 'text-zinc-500'}"
      >
        <span class="h-1 w-1 rounded-full {i === 5 ? 'bg-primary-400' : 'bg-zinc-700'}"></span>
        {item}
      </div>
    {/each}
  </aside>

  <div class="overflow-hidden p-5">
    <!-- Top metrics -->
    <div class="grid grid-cols-4 gap-2.5">
      {#each [{ k: 'Total focused', v: '246h', sub: 'all-time' }, { k: 'Best streak', v: '23d', sub: 'this year' }, { k: 'Earned', v: '$18,450', sub: 'lifetime' }, { k: 'Acceptance', v: '67%', sub: 'last 90d' }] as m}
        <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
          <p class="text-[9px] uppercase tracking-wider text-zinc-500">{m.k}</p>
          <p class="mt-1 text-lg font-semibold text-zinc-100">{m.v}</p>
          <p class="text-[9px] text-zinc-500">{m.sub}</p>
        </div>
      {/each}
    </div>

    <!-- Daily focus bars -->
    <div class="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div class="flex items-center justify-between">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Daily focus</p>
        <p class="text-[9px] text-zinc-500">Last 30 days</p>
      </div>
      <div class="mt-2 flex h-16 items-end gap-1">
        {#each bars as b}
          <div class="flex-1 rounded-t-sm bg-primary-500/80" style="height: {b}%"></div>
        {/each}
      </div>
    </div>

    <div class="mt-3 grid grid-cols-[1fr_180px] gap-3">
      <!-- Heatmap -->
      <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Activity heatmap</p>
        <div class="flex flex-col gap-[3px]">
          {#each heatmap as row}
            <div class="flex gap-[3px]">
              {#each row as v}
                <span class="h-2.5 w-2.5 rounded-[2px] {heatColor(v)}"></span>
              {/each}
            </div>
          {/each}
        </div>
        <div class="mt-2 flex items-center justify-end gap-1 text-[9px] text-zinc-500">
          <span>less</span>
          {#each [0, 3, 6, 9, 12] as v}
            <span class="h-2 w-2 rounded-[2px] {heatColor(v)}"></span>
          {/each}
          <span>more</span>
        </div>
      </div>

      <!-- Vuln breakdown -->
      <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Vulnerability mix</p>
        <div class="space-y-1.5">
          {#each vulns as v}
            <div>
              <div class="flex justify-between text-[9px]">
                <span class="text-zinc-300">{v.name}</span>
                <span class="font-mono text-zinc-500">{v.pct}%</span>
              </div>
              <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                <div class="h-full rounded-full {v.color}" style="width: {v.pct * 3}%"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
