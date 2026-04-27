<script lang="ts">
  import { ArrowRight, Cloud, Laptop, Smartphone, Sparkles } from 'lucide-svelte';
</script>

<section id="cloud-sync" class="relative overflow-hidden border-b border-slate-800 bg-slate-900 px-4 py-20 sm:px-6 lg:px-8">
  <!-- Soft glow accent that signals "premium" without overwhelming the dark theme -->
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64 bg-gradient-to-b from-primary-500/10 via-primary-500/5 to-transparent"
  ></div>

  <div class="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
    <div>
      <span class="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
        <Sparkles size={12} aria-hidden="true" />
        Pro feature
      </span>

      <h2 class="mt-4 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">
        Real-time cloud sync, like Notion — but for your hunting workspace.
      </h2>

      <p class="mt-4 text-base leading-7 text-slate-300">
        HuntFlow Pro keeps your targets, sessions, notes, evidence and submissions in sync across every device, in
        real time. Open a session on your laptop, finish it on your phone, write the report on a tablet — same data
        everywhere, always up to date.
      </p>

      <ul class="mt-6 space-y-3 text-sm text-slate-300">
        <li class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-300">
            <Laptop size={12} aria-hidden="true" />
          </span>
          Sub-second updates pushed to every signed-in device. No refresh. No conflicts.
        </li>
        <li class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-300">
            <Smartphone size={12} aria-hidden="true" />
          </span>
          End-to-end encrypted backups. Your evidence and notes are yours, full stop.
        </li>
        <li class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-300">
            <Cloud size={12} aria-hidden="true" />
          </span>
          Built on Convex. Operational-transform style merging means simultaneous edits never overwrite each other.
        </li>
      </ul>

      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href="/pricing"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          See pricing
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        <a
          href="/sign-up"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
        >
          Create a free account
        </a>
      </div>
    </div>

    <div class="relative">
      <!-- Stylized "two devices, one workspace" mockup. No real images required. -->
      <div class="relative mx-auto max-w-md">
        <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-dark-xl">
          <div class="mb-3 flex items-center gap-2 border-b border-slate-800 pb-3">
            <span class="h-2 w-2 rounded-full bg-slate-700" aria-hidden="true"></span>
            <span class="h-2 w-2 rounded-full bg-slate-700" aria-hidden="true"></span>
            <span class="h-2 w-2 rounded-full bg-slate-700" aria-hidden="true"></span>
            <span class="ml-2 font-mono text-[10px] text-slate-500">laptop · synced 2s ago</span>
          </div>
          <div class="space-y-2.5">
            <div class="h-2 w-3/5 rounded-full bg-slate-800"></div>
            <div class="h-2 w-4/5 rounded-full bg-slate-800"></div>
            <div class="rounded-md border border-primary-500/20 bg-primary-500/5 p-3">
              <div class="mb-2 h-2 w-1/2 rounded-full bg-primary-500/40"></div>
              <div class="h-2 w-3/4 rounded-full bg-primary-500/20"></div>
            </div>
            <div class="h-2 w-2/3 rounded-full bg-slate-800"></div>
          </div>
        </div>

        <div class="absolute -bottom-12 -right-6 w-44 rotate-3 rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-dark-xl">
          <div class="mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Smartphone size={10} class="text-primary-300" aria-hidden="true" />
            <span class="font-mono text-[9px] text-slate-500">phone · live</span>
          </div>
          <div class="space-y-1.5">
            <div class="h-1.5 w-2/3 rounded-full bg-slate-800"></div>
            <div class="rounded-md border border-primary-500/30 bg-primary-500/10 p-2">
              <div class="mb-1 h-1.5 w-3/4 rounded-full bg-primary-500/40"></div>
              <div class="h-1.5 w-1/2 rounded-full bg-primary-500/20"></div>
            </div>
            <div class="h-1.5 w-3/5 rounded-full bg-slate-800"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
