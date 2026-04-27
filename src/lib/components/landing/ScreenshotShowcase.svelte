<script lang="ts">
  // Marketing carousel that shows the real product UI.
  //
  // Each slide loads a Playwright-captured PNG from /screenshots/<id>.png
  // (the same files the README links to from docs/screenshots/, copied
  // into static/screenshots/ at build time so SvelteKit serves them).
  // If a PNG ever fails to load we fall back to the matching CSS mockup
  // so the page never looks broken in dev or fresh clones.
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { ComponentType } from 'svelte';
  import DashboardMockup from './mockups/DashboardMockup.svelte';
  import NotesMockup from './mockups/NotesMockup.svelte';
  import StatsMockup from './mockups/StatsMockup.svelte';
  import TargetsMockup from './mockups/TargetsMockup.svelte';

  interface Shot {
    id: string;
    title: string;
    description: string;
    fallback: ComponentType;
    alt: string;
  }

  // Each `id` matches a real PNG in static/screenshots/ that was captured
  // from the running app with seeded sample bounty data. Order is the
  // hunting flow: pick a target, write evidence, ship reports, get paid.
  const shots: Shot[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description:
        'Streak, focused hours, earnings, and active programs at a glance. Pick up the timer where you paused yesterday.',
      fallback: DashboardMockup,
      alt: 'HuntFlow dashboard with sample targets, evidence, payouts, and sync status'
    },
    {
      id: 'targets',
      title: 'Target detail',
      description:
        'Status pipeline, scope, session history, and per-target ROI. Cut underperforming programs quickly.',
      fallback: TargetsMockup,
      alt: 'Target detail screen showing status pipeline, scope, and session history'
    },
    {
      id: 'notes',
      title: 'Notes preview',
      description:
        'Markdown templates for SSRF, IDOR, XSS, RCE and more. Reproduction steps, impact, and remediation in one view.',
      fallback: NotesMockup,
      alt: 'Markdown note preview showing reproduction steps, impact, and remediation'
    },
    {
      id: 'stats',
      title: 'Stats dashboard',
      description:
        'Hunting time, streaks, weekly activity, and vulnerability mix derived from real session data.',
      fallback: StatsMockup,
      alt: 'Stats dashboard with hunting time, streak, weekly activity, and vulnerability charts'
    },
    {
      id: 'income',
      title: 'Income tracker',
      description:
        'Payout totals, earnings chart, tax CSV export, and per-payout rows. The data hunters actually want to see.',
      // Income view is close enough to the stats look for a graceful fallback.
      fallback: StatsMockup,
      alt: 'Income tracker with payout totals, earnings chart, tax export, and payout rows'
    }
  ];

  let active = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let prefersReducedMotion = false;

  // Track which slide IDs failed to load a real PNG so we render the
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

    <!-- 16:10 frame with `object-contain` so the real captured PNGs
         render at their full aspect ratio without cropping. The dark
         slate-950 background fills any letterbox space so it blends
         with the page. -->
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
              class="h-full w-full object-contain"
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
