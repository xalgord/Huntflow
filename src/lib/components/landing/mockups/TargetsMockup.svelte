<script lang="ts">
  import { Crosshair } from 'lucide-svelte';

  const targets = [
    { name: 'Shopify', platform: 'HackerOne', priority: 'high', perHour: 84, accept: 71, last: '2h ago' },
    { name: 'GitLab', platform: 'HackerOne', priority: 'med', perHour: 62, accept: 64, last: '1d ago' },
    { name: 'Tesla', platform: 'Bugcrowd', priority: 'high', perHour: 110, accept: 58, last: 'today' },
    { name: 'Coinbase', platform: 'HackerOne', priority: 'high', perHour: 92, accept: 49, last: '3d ago' },
    { name: 'GitHub', platform: 'HackerOne', priority: 'med', perHour: 41, accept: 73, last: '5d ago' },
    { name: 'Atlassian', platform: 'Bugcrowd', priority: 'low', perHour: 28, accept: 81, last: '1w ago' }
  ];

  function priorityClass(p: string): string {
    if (p === 'high') return 'bg-rose-500/15 text-rose-200 border-rose-500/30';
    if (p === 'med') return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
    return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40';
  }
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
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] {i === 2
          ? 'bg-primary-500/10 text-primary-200'
          : 'text-zinc-500'}"
      >
        <span class="h-1 w-1 rounded-full {i === 2 ? 'bg-primary-400' : 'bg-zinc-700'}"></span>
        {item}
      </div>
    {/each}
  </aside>

  <div class="overflow-hidden p-5">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold text-zinc-100">Targets</h2>
      <div class="flex items-center gap-1.5 text-[10px]">
        {#each ['HackerOne', 'Bugcrowd', 'Intigriti', 'YesWeHack'] as plat, i}
          <span class="rounded-full border border-zinc-800 px-2 py-0.5 {i === 0 ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500'}">{plat}</span>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2.5">
      {#each targets as t}
        <div class="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-semibold text-zinc-100">{t.name}</p>
              <p class="text-[10px] text-zinc-500">{t.platform}</p>
            </div>
            <span class="rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide {priorityClass(t.priority)}">
              {t.priority}
            </span>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p class="uppercase tracking-wider text-zinc-500">$/hr</p>
              <p class="font-mono text-emerald-300">${t.perHour}</p>
            </div>
            <div>
              <p class="uppercase tracking-wider text-zinc-500">Accept</p>
              <p class="font-mono text-sky-300">{t.accept}%</p>
            </div>
          </div>
          <p class="mt-2 text-[9px] text-zinc-500">Last session {t.last}</p>
        </div>
      {/each}
    </div>
  </div>
</div>
