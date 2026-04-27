<script lang="ts">
  // Renders a carousel of in-app screen mockups for the marketing page.
  // We deliberately use HTML/CSS mockups instead of bitmap screenshots so
  // every panel is pixel-perfect at any viewport, matches the live theme,
  // and stays in sync with the real product without needing to re-export
  // PNGs every time the UI evolves.
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { ComponentType } from 'svelte';
  import DashboardMockup from './mockups/DashboardMockup.svelte';
  import EvidenceMockup from './mockups/EvidenceMockup.svelte';
  import NotesMockup from './mockups/NotesMockup.svelte';
  import StatsMockup from './mockups/StatsMockup.svelte';
  import TargetsMockup from './mockups/TargetsMockup.svelte';
  import TimerMockup from './mockups/TimerMockup.svelte';

  interface Shot {
    id: string;
    title: string;
    description: string;
    component: ComponentType;
    alt: string;
  }

  const shots: Shot[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description:
        'Streak, focused hours, earnings and active programs at a glance. Pick up the timer where you paused yesterday.',
      component: DashboardMockup,
      alt: 'HuntFlow dashboard with streak counter, weekly focused hours, earnings and active targets'
    },
    {
      id: 'timer',
      title: 'Focus timer',
      description:
        'Pomodoro-style sessions tied to a target. Capture quick notes and tags before context fades.',
      component: TimerMockup,
      alt: 'HuntFlow focus timer with countdown, target selector and quick note field'
    },
    {
      id: 'targets',
      title: 'Targets',
      description:
        'Every program in one grid: scope, priority, last session, $/hour, acceptance rate. Cut underperforming targets quickly.',
      component: TargetsMockup,
      alt: 'HuntFlow targets grid showing program cards with platform badges and ROI metrics'
    },
    {
      id: 'notes',
      title: 'Notes',
      description:
        'Vulnerability templates for SSRF, IDOR, XSS, RCE and more. Markdown-first with code fences and tag filtering.',
      component: NotesMockup,
      alt: 'HuntFlow markdown note editor with vulnerability template and tags'
    },
    {
      id: 'evidence',
      title: 'Evidence canvas',
      description:
        'A whiteboard for findings: drop screenshots, paste requests, link them visually so reports write themselves.',
      component: EvidenceMockup,
      alt: 'HuntFlow evidence canvas with screenshots and request snippets connected by lines'
    },
    {
      id: 'stats',
      title: 'Stats',
      description:
        'Year-long activity heatmap, vulnerability mix, best streaks. The data hunters actually want to see.',
      component: StatsMockup,
      alt: 'HuntFlow stats page with activity heatmap, vulnerability donut chart and trend bars'
    }
  ];

  let active = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let prefersReducedMotion = false;

  function step(direction: 1 | -1): void {
    active = (active + direction + shots.length) % shots.length;
  }

  function startCarousel(): void {
    if (!browser || prefersReducedMotion) return;
    if (timer) clearInterval(timer);
    timer = setInterval(() => step(1), 6500);
  }

  function pauseCarousel(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  onMount(() => {
    if (!browser) return;
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    startCarousel();
  });

  onDestroy(() => {
    pauseCarousel();
  });

  $: activeShot = shots[active];
</script>

<div
  class="relative"
  on:mouseenter={pauseCarousel}
  on:mouseleave={startCarousel}
  role="region"
  aria-roledescription="carousel"
  aria-label="Product screenshots"
>
  <div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-dark-xl">
    <!-- Window chrome to make the mockup feel like a real app frame -->
    <div class="flex items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
      <span class="h-2.5 w-2.5 rounded-full bg-rose-500/70" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-amber-400/70" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-emerald-500/70" aria-hidden="true"></span>
      <div class="ml-3 hidden truncate font-mono text-xs text-slate-500 sm:block">
        huntflow.xalgorix.com/{activeShot.id}
      </div>
    </div>

    <!-- 16:10 frame; each mockup fills it edge-to-edge.
         We render all panels stacked and crossfade between them so the
         layout never reflows during transitions. -->
    <div class="relative aspect-[16/10] overflow-hidden bg-slate-950">
      {#each shots as shot, index}
        <div
          class="absolute inset-0 transition-opacity duration-700 {active === index
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'}"
          aria-hidden={active !== index}
          aria-label={shot.alt}
        >
          <svelte:component this={shot.component} />
        </div>
      {/each}
    </div>
  </div>

  <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div class="max-w-xl">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300">
        {String(active + 1).padStart(2, '0')} / {String(shots.length).padStart(2, '0')}
      </p>
      <h3 class="mt-1.5 text-xl font-semibold text-slate-100">{activeShot.title}</h3>
      <p class="mt-1.5 text-sm leading-6 text-slate-400">{activeShot.description}</p>
    </div>

    <div role="tablist" aria-label="Choose screenshot" class="flex flex-wrap gap-1.5">
      {#each shots as shot, index}
        <button
          type="button"
          role="tab"
          aria-selected={active === index}
          aria-label={`Show ${shot.title} screenshot`}
          tabindex={active === index ? 0 : -1}
          class="rounded-md border px-3 py-1.5 text-xs font-medium transition {active === index
            ? 'border-primary-500/40 bg-primary-500/10 text-primary-200'
            : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
          on:click={() => {
            active = index;
            startCarousel();
          }}
        >
          {shot.title}
        </button>
      {/each}
    </div>
  </div>
</div>
