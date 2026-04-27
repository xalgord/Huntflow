<script lang="ts">
  // Marketing carousel that shows the real product UI.
  //
  // Each slide tries to load `/screenshots/<id>.png` first (these are the
  // PNGs produced by `npm run screenshots`, which captures the live app
  // with Playwright + sample IndexedDB data). If the PNG is missing - in
  // a fresh clone, in v0 preview, or before CI has populated the static
  // dir - we transparently fall back to a hand-built CSS mockup of the
  // same screen so the page never looks broken.
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
    fallback: ComponentType;
    alt: string;
  }

  // Filenames must match the ones the capture script writes to
  // static/screenshots/. Keep them in sync with capture-readme-screenshots.mjs.
  const shots: Shot[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description:
        'Streak, focused hours, earnings and active programs at a glance. Pick up the timer where you paused yesterday.',
      fallback: DashboardMockup,
      alt: 'HuntFlow dashboard with streak counter, weekly focused hours, earnings and active targets'
    },
    {
      id: 'timer',
      title: 'Focus timer',
      description:
        'Pomodoro-style sessions tied to a target. Capture quick notes and tags before context fades.',
      fallback: TimerMockup,
      alt: 'HuntFlow focus timer with countdown, target selector and quick note field'
    },
    {
      id: 'targets',
      title: 'Targets',
      description:
        'Every program in one grid: scope, priority, last session, $/hour, acceptance rate. Cut underperforming targets quickly.',
      fallback: TargetsMockup,
      alt: 'HuntFlow targets grid showing program cards with platform badges and ROI metrics'
    },
    {
      id: 'notes',
      title: 'Notes',
      description:
        'Vulnerability templates for SSRF, IDOR, XSS, RCE and more. Markdown-first with code fences and tag filtering.',
      fallback: NotesMockup,
      alt: 'HuntFlow markdown note editor with vulnerability template and tags'
    },
    {
      id: 'evidence',
      title: 'Evidence',
      description:
        'A visual workspace for findings: drop screenshots, paste requests, link them so reports write themselves.',
      fallback: EvidenceMockup,
      alt: 'HuntFlow evidence canvas with screenshots and request snippets connected by lines'
    },
    {
      id: 'stats',
      title: 'Stats',
      description:
        'Year-long activity heatmap, vulnerability mix, best streaks. The data hunters actually want to see.',
      fallback: StatsMockup,
      alt: 'HuntFlow stats page with activity heatmap, vulnerability donut chart and trend bars'
    }
  ];

  let active = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let prefersReducedMotion = false;

  // Tracks which slide IDs failed to load a real PNG so we render the
  // mockup instead. Once a slide has fallen back, it stays that way for
  // the rest of the visit (no flicker).
  const fallbackForId: Record<string, boolean> = {};

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

  function handleImgError(id: string): void {
    fallbackForId[id] = true;
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
    <!-- Window chrome makes the slide feel like a real product frame. -->
    <div class="flex items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
      <span class="h-2.5 w-2.5 rounded-full bg-rose-500/70" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-amber-400/70" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-emerald-500/70" aria-hidden="true"></span>
      <div class="ml-3 hidden truncate font-mono text-xs text-slate-500 sm:block">
        huntflow.xalgorix.com/{activeShot.id}
      </div>
    </div>

    <!-- 16:10 frame; both the PNG and the mockup are sized to fill it
         exactly so transitions never reflow. -->
    <div class="relative aspect-[16/10] overflow-hidden bg-slate-950">
      {#each shots as shot, index}
        <div
          class="absolute inset-0 transition-opacity duration-700 {active === index
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'}"
          aria-hidden={active !== index}
          aria-label={shot.alt}
        >
          {#if fallbackForId[shot.id]}
            <svelte:component this={shot.fallback} />
          {:else}
            <img
              src="/screenshots/{shot.id}.png"
              alt={shot.alt}
              class="h-full w-full object-cover object-top"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              on:error={() => handleImgError(shot.id)}
            />
          {/if}
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
