<script lang="ts">
  // Static visual mockup for the landing showcase. Renders the same
  // visual language as the real Dashboard route but with hand-tuned
  // sample data so it always looks crisp at any viewport.
  import { Activity, Crosshair, DollarSign, Flame, Target, Timer } from 'lucide-svelte';
</script>

<div class="grid h-full grid-cols-[180px_1fr] bg-zinc-950 text-zinc-200">
  <!-- Side rail to mirror the real app shell -->
  <aside class="flex flex-col gap-1 border-r border-zinc-900 bg-zinc-950 p-3">
    <div class="mb-3 flex items-center gap-2 px-1.5 py-1.5">
      <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-zinc-950">
        <Crosshair size={14} aria-hidden="true" />
      </span>
      <span class="text-xs font-semibold tracking-tight text-zinc-100">HuntFlow</span>
    </div>
    {#each ['Dashboard', 'Timer', 'Targets', 'Notes', 'Evidence', 'Stats', 'Income'] as item, i}
      <div
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] {i === 0
          ? 'bg-primary-500/10 text-primary-200'
          : 'text-zinc-500'}"
      >
        <span class="h-1 w-1 rounded-full {i === 0 ? 'bg-primary-400' : 'bg-zinc-700'}"></span>
        {item}
      </div>
    {/each}
  </aside>

  <!-- Main pane -->
  <div class="overflow-hidden p-5">
    <header class="mb-4 flex items-center justify-between">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-300">Welcome back</p>
        <h1 class="mt-0.5 text-lg font-semibold text-zinc-100">Tuesday, hunt no. 47</h1>
      </div>
      <div class="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
        <Flame size={12} aria-hidden="true" />
        12 day streak
      </div>
    </header>

    <!-- Three stat cards -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          <Timer size={11} aria-hidden="true" /> Focused
        </div>
        <p class="mt-1.5 text-2xl font-semibold text-zinc-100">47<span class="text-base text-zinc-500">h</span></p>
        <p class="text-[10px] text-emerald-400">+8h this week</p>
      </div>
      <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          <DollarSign size={11} aria-hidden="true" /> Earned
        </div>
        <p class="mt-1.5 text-2xl font-semibold text-zinc-100">$3,250</p>
        <p class="text-[10px] text-emerald-400">+$500 this week</p>
      </div>
      <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          <Target size={11} aria-hidden="true" /> Active
        </div>
        <p class="mt-1.5 text-2xl font-semibold text-zinc-100">8<span class="text-base text-zinc-500"> targets</span></p>
        <p class="text-[10px] text-zinc-500">3 high priority</p>
      </div>
    </div>

    <!-- Today's hunt panel -->
    <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3.5">
      <div class="flex items-center justify-between">
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Today&apos;s hunt</p>
        <span class="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400">paused</span>
      </div>
      <div class="mt-3 flex items-center gap-4">
        <div class="font-mono text-3xl font-semibold tabular-nums text-primary-300">18:42</div>
        <div class="flex-1">
          <p class="text-[11px] text-zinc-400">Active target</p>
          <p class="text-sm font-medium text-zinc-100">Tesla Bug Bounty</p>
          <div class="mt-1.5 flex gap-1">
            <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300">recon</span>
            <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300">ssrf</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="h-8 w-8 rounded-md bg-primary-600 text-[10px] font-semibold text-zinc-950">▶</button>
        </div>
      </div>
    </div>

    <!-- Recent activity rows -->
    <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3.5">
      <div class="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <Activity size={11} aria-hidden="true" /> Recent submissions
      </div>
      {#each [{ name: 'SSRF in image proxy', target: 'Tesla', state: 'Triaged', tone: 'amber' }, { name: 'IDOR on /api/users', target: 'GitLab', state: 'Resolved', tone: 'emerald' }, { name: 'Stored XSS in profile', target: 'Shopify', state: 'New', tone: 'sky' }] as row}
        <div class="flex items-center justify-between border-t border-zinc-800/60 py-1.5 first:border-0 first:pt-0">
          <div>
            <p class="text-[11px] font-medium text-zinc-100">{row.name}</p>
            <p class="text-[10px] text-zinc-500">{row.target}</p>
          </div>
          <span
            class="rounded px-1.5 py-0.5 text-[9px] {row.tone === 'amber'
              ? 'bg-amber-500/15 text-amber-200'
              : row.tone === 'emerald'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-sky-500/15 text-sky-200'}"
          >
            {row.state}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>
