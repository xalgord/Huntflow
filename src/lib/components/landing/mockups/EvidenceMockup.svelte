<script lang="ts">
  import { Crosshair, Image, Link2, MousePointer2, Plus, Terminal } from 'lucide-svelte';
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
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] {i === 4
          ? 'bg-primary-500/10 text-primary-200'
          : 'text-slate-500'}"
      >
        <span class="h-1 w-1 rounded-full {i === 4 ? 'bg-primary-400' : 'bg-slate-700'}"></span>
        {item}
      </div>
    {/each}
  </aside>

  <div class="relative overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.08)_1px,transparent_0)] bg-slate-950 [background-size:14px_14px]">
    <!-- Floating toolbar -->
    <div class="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/95 p-1 backdrop-blur">
      <button class="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-slate-100">
        <MousePointer2 size={13} aria-hidden="true" />
      </button>
      <button class="flex h-7 w-7 items-center justify-center rounded bg-primary-500/15 text-primary-200">
        <Plus size={13} aria-hidden="true" />
      </button>
      <span class="mx-1 h-4 w-px bg-slate-800"></span>
      <span class="px-2 font-mono text-[10px] text-slate-500">100%</span>
    </div>

    <!-- Connection lines (SVG) -->
    <svg class="absolute inset-0 h-full w-full" viewBox="0 0 800 480" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 220 130 C 320 130, 360 220, 440 220" stroke="rgb(20 184 166 / 0.4)" stroke-width="1.5" fill="none" stroke-dasharray="4 4" />
      <path d="M 440 270 C 540 270, 560 360, 640 360" stroke="rgb(20 184 166 / 0.4)" stroke-width="1.5" fill="none" stroke-dasharray="4 4" />
      <path d="M 220 320 C 300 320, 360 260, 440 250" stroke="rgb(20 184 166 / 0.4)" stroke-width="1.5" fill="none" stroke-dasharray="4 4" />
    </svg>

    <!-- Node: HTTP request -->
    <div class="absolute left-[6%] top-[18%] w-[28%] rounded-md border border-slate-800 bg-slate-900 p-2.5 shadow-dark-lg">
      <div class="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500">
        <Terminal size={10} aria-hidden="true" /> Request
      </div>
      <pre class="mt-1.5 overflow-hidden font-mono text-[9px] leading-4 text-slate-300"><span class="text-amber-300">POST</span> /api/image-proxy
<span class="text-slate-500">Authorization:</span> Bearer eyJh&hellip;
<span class="text-slate-500">Content-Type:</span> application/json

&#123;<span class="text-emerald-300">"url"</span>: <span class="text-emerald-300">"file:///etc/passwd"</span>&#125;</pre>
    </div>

    <!-- Node: Screenshot -->
    <div class="absolute left-[44%] top-[36%] w-[26%] rounded-md border border-slate-800 bg-slate-900 p-2 shadow-dark-lg">
      <div class="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500">
        <Image size={10} aria-hidden="true" /> Screenshot
      </div>
      <div class="mt-1.5 h-20 rounded-sm bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
        <div class="flex h-full items-center justify-center font-mono text-[9px] text-slate-400">
          200 OK &middot; 4.2 KB
        </div>
      </div>
    </div>

    <!-- Node: Response -->
    <div class="absolute left-[68%] top-[58%] w-[28%] rounded-md border border-slate-800 bg-slate-900 p-2.5 shadow-dark-lg">
      <div class="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-emerald-400">
        <Link2 size={10} aria-hidden="true" /> Response body
      </div>
      <pre class="mt-1.5 overflow-hidden font-mono text-[9px] leading-4 text-emerald-300">root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin&hellip;
<span class="text-slate-500"># SSRF confirmed</span></pre>
    </div>

    <!-- Node: Note pin -->
    <div class="absolute bottom-[14%] left-[8%] w-[26%] rounded-md border border-amber-400/30 bg-amber-500/5 p-2.5 shadow-dark-lg">
      <p class="text-[10px] font-semibold text-amber-200">Severity: High</p>
      <p class="mt-1 text-[10px] leading-4 text-slate-300">
        Reachable from any authenticated user. No content-type allowlist on proxy fetch.
      </p>
    </div>
  </div>
</div>
