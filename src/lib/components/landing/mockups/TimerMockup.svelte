<script lang="ts">
  import { Crosshair, Pause, Play, SkipForward } from 'lucide-svelte';
</script>

<div class="grid h-full grid-cols-[180px_1fr] bg-slate-950 text-slate-200">
  <aside class="flex flex-col gap-1 border-r border-slate-900 bg-slate-950 p-3">
    <div class="mb-3 flex items-center gap-2 px-1.5 py-1.5">
      <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-slate-950">
        <Crosshair size={14} aria-hidden="true" />
      </span>
      <span class="text-xs font-semibold tracking-tight text-slate-100">HuntFlow</span>
    </div>
    {#each ['Dashboard', 'Timer', 'Targets', 'Notes', 'Evidence', 'Stats', 'Income'] as item, i}
      <div
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] {i === 1
          ? 'bg-primary-500/10 text-primary-200'
          : 'text-slate-500'}"
      >
        <span class="h-1 w-1 rounded-full {i === 1 ? 'bg-primary-400' : 'bg-slate-700'}"></span>
        {item}
      </div>
    {/each}
  </aside>

  <div class="grid grid-cols-[1fr_220px] overflow-hidden">
    <div class="flex flex-col items-center justify-center p-6">
      <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Focus session</p>
      <div class="mt-3 font-mono text-[88px] font-semibold leading-none tracking-tight tabular-nums text-primary-300">
        23:14
      </div>
      <p class="mt-2 text-xs text-slate-400">
        Target: <span class="text-slate-100">Tesla Bug Bounty</span> &middot; HackerOne
      </p>

      <div class="mt-6 flex items-center gap-2">
        <button class="flex h-10 items-center gap-1.5 rounded-md bg-primary-600 px-4 text-xs font-semibold text-slate-950">
          <Pause size={13} aria-hidden="true" /> Pause
        </button>
        <button class="flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300">
          <SkipForward size={14} aria-hidden="true" />
        </button>
      </div>

      <div class="mt-5 w-full max-w-md rounded-md border border-slate-800 bg-slate-900 p-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quick note</p>
        <p class="mt-1 text-[11px] leading-5 text-slate-300">
          Image proxy returns full body when fetching <span class="rounded bg-slate-800 px-1 font-mono text-[10px] text-emerald-300">file://</span>
          URLs. SSRF candidate &mdash; need to verify auth boundary.
        </p>
        <div class="mt-2 flex gap-1">
          <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">ssrf</span>
          <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">recon</span>
          <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">tesla</span>
        </div>
      </div>
    </div>

    <aside class="border-l border-slate-900 bg-slate-950/50 p-4">
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Today</p>
      <p class="mt-0.5 text-xs text-slate-300">5 sessions &middot; 2h 47m</p>
      <div class="mt-3 space-y-1.5">
        {#each [{ time: '14:32', dur: '25m', label: 'Recon &amp; subdomain enum' }, { time: '13:55', dur: '15m', label: 'Reading scope notes' }, { time: '12:10', dur: '50m', label: 'JWT auth bypass attempts' }, { time: '10:40', dur: '45m', label: 'Tesla &mdash; image proxy' }, { time: '09:20', dur: '32m', label: 'Triage submissions' }] as s}
          <div class="rounded-md border border-slate-800 bg-slate-900 p-2">
            <div class="flex items-center justify-between text-[10px] text-slate-500">
              <span>{s.time}</span>
              <span class="font-mono">{s.dur}</span>
            </div>
            <p class="mt-0.5 truncate text-[11px] text-slate-200">{@html s.label}</p>
          </div>
        {/each}
      </div>
    </aside>
  </div>
</div>
