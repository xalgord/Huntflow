<script lang="ts">
  import {
    BarChart3,
    Boxes,
    Cloud,
    Crosshair,
    FileText,
    Keyboard,
    Network,
    ShieldCheck,
    Timer,
    Wrench
  } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';

  interface Feature {
    icon: ComponentType;
    title: string;
    description: string;
    pro?: boolean;
  }

  const features: Feature[] = [
    {
      icon: Timer,
      title: 'Focus sessions',
      description:
        'Pomodoro-style timed hunts pinned to a target. Pause-aware, so abandoned minutes never count as work.'
    },
    {
      icon: Crosshair,
      title: 'Target tracker',
      description:
        'Programs with platform, scope, priority, status, ROI per hour and acceptance rate — at a glance.'
    },
    {
      icon: FileText,
      title: 'Markdown notes',
      description:
        'Templates for SSRF, IDOR, XSS, RCE, auth bypass and more. Tags, code fences, instant search.'
    },
    {
      icon: Network,
      title: 'Recon assets',
      description:
        'Subdomains, IPs, endpoints, params per target. Search across everything you have ever found.'
    },
    {
      icon: Boxes,
      title: 'Evidence canvas',
      description:
        'A whiteboard for screenshots, requests and findings. Connect them visually so reports write themselves.'
    },
    {
      icon: BarChart3,
      title: 'Stats and streaks',
      description:
        'Year heatmap, weekly recap, $/hour, vulnerability mix and the times of day you actually ship.'
    },
    {
      icon: Wrench,
      title: 'Hunter toolkit',
      description:
        'Encoder/decoder, JWT, hash, random tokens and a scope validator. No more Alt-Tabbing to CyberChef.'
    },
    {
      icon: Keyboard,
      title: 'Command palette',
      description:
        'Cmd-K opens a fuzzy palette across every target, note, payload and submission. g-t to jump anywhere.'
    },
    {
      icon: ShieldCheck,
      title: 'Offline first',
      description:
        'Everything stored in your browser. No account required. Encrypted backups when you want them.'
    },
    {
      icon: Cloud,
      title: 'Cloud sync',
      description:
        'Seamless real-time sync across every device you use. Resolves conflicts, keeps you fast.',
      pro: true
    }
  ];
</script>

<section id="features" class="border-y border-slate-800 bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-6xl">
    <div class="max-w-2xl">
      <p class="hf-eyebrow">Features</p>
      <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">Built around how hunters actually work.</h2>
      <p class="mt-3 text-base leading-7 text-slate-400">
        Ten focused tools that talk to each other, instead of ten browser tabs that don't.
      </p>
    </div>

    <div class="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each features as feature}
        <article class="relative flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700 hover:bg-slate-900">
          <div class="flex items-start justify-between">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300">
              <svelte:component this={feature.icon} size={20} aria-hidden="true" />
            </div>
            {#if feature.pro}
              <span class="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                Pro
              </span>
            {/if}
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-100">{feature.title}</h3>
            <p class="mt-1 text-sm leading-6 text-slate-400">{feature.description}</p>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>
