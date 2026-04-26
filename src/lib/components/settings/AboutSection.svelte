<script lang="ts">
  import { ExternalLink, HeartHandshake, Info } from 'lucide-svelte';
</script>

<section class="hf-card p-4">
  <div class="flex items-start gap-3">
    <div class="rounded-lg border border-primary-500/20 bg-primary-500/10 p-2 text-primary-400">
      <Info size={24} aria-hidden="true" />
    </div>
    <div>
      <h2 class="text-lg font-semibold text-slate-100">About HuntFlow</h2>
      <p class="mt-1 text-sm text-slate-400">Version 1.0.0</p>
    </div>
  </div>

  <div class="mt-4 grid gap-3 lg:grid-cols-3">
    <div class="rounded-lg border border-slate-700 bg-slate-900 p-3">
      <h3 class="text-sm font-semibold text-slate-100">What&apos;s New</h3>
      <p class="mt-2 text-sm leading-6 text-slate-400">
        Offline sessions, target tracking, markdown notes, stats dashboard, and PWA install support.
      </p>
    </div>
    <a
      href="mailto:feedback@huntflow.local"
      class="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 transition hover:border-primary-500/50 hover:bg-slate-850"
    >
      <HeartHandshake size={20} class="text-primary-400" aria-hidden="true" />
      <h3 class="mt-2 text-sm font-semibold">Feedback</h3>
      <p class="mt-1 text-sm text-slate-400">Send bug reports, workflow friction, or feature requests.</p>
    </a>
    <a
      href="/manifest.json"
      class="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 transition hover:border-primary-500/50 hover:bg-slate-850"
    >
      <ExternalLink size={20} class="text-blue-400" aria-hidden="true" />
      <h3 class="mt-2 text-sm font-semibold">Privacy</h3>
      <p class="mt-1 text-sm text-slate-400">All MVP data stays local in your browser unless you export it.</p>
    </a>
  </div>
</section>
