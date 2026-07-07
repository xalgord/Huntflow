<script lang="ts">
  // Marketing carousel that shows the real product UI.
  //
  // Each slide loads a real captured PNG from /screenshots/<id>.png
  // (committed under static/screenshots/ so SvelteKit serves them as
  // hashed static assets). If a PNG ever fails to load we fall back to
  // a CSS mockup so the page never looks broken in dev or fresh clones.
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
  // from the running app with seeded sample engagement data. Order follows
  // the natural testing workflow: see the day, focus, pick a target,
  // write findings, attach proof, look up payloads, run utilities,
  // ship the report, then reach for references.
  const shots: Shot[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description:
        'Local vault overview: today\u2019s focused time, active targets, evidence captured, and pending reports. Pick up the timer where you paused yesterday.',
      fallback: DashboardMockup,
      alt: 'HuntFlow dashboard with Acme engagement workspace, stats, and exploit chain status'
    },
    {
      id: 'timer',
      title: 'Focus timer',
      description:
        'Pomodoro-style focus sessions tied to a target. Track streaks, completed sessions, and best run, so deep work compounds instead of slipping away.',
      fallback: DashboardMockup,
      alt: 'Focus session timer running 12:43 against Acme engagement with streak and session counters'
    },
    {
      id: 'targets',
      title: 'Targets',
      description:
        'Engagement tracker for internal pentests, client work, bug bounty, and self-hosted scopes. Sort by priority and status so you spend time on what matters.',
      fallback: TargetsMockup,
      alt: 'Targets list with Acme engagement, Globex Public, and Initech Lite ranked by priority'
    },
    {
      id: 'notes',
      title: 'Notes',
      description:
        'Markdown templates for IDOR, SSRF, JWT, race conditions and more. Reproduction steps, impact, and remediation captured per target while it\u2019s fresh.',
      fallback: NotesMockup,
      alt: 'Notes grid showing IDOR, JWT alg=none, and race-condition findings filtered by target'
    },
    {
      id: 'evidence',
      title: 'Evidence',
      description:
        'Drop, paste, or capture proof files, request traces, and report-ready URLs. Vault metrics flag what is critical, high, or marked needs-report.',
      fallback: DashboardMockup,
      alt: 'Evidence command center with drag-drop vault, capture URL, snippet capture, and analytics'
    },
    {
      id: 'payloads',
      title: 'Payloads',
      description:
        'Curated battle library of XSS, SQLi, SSRF, SSTI, RCE, IDOR, and bypass payloads. Tag favorites and copy in one click without alt-tabbing to a wiki.',
      fallback: DashboardMockup,
      alt: 'Payload library with category filters and copy-ready 2nd-order SQLi, attribute breakout XSS, and CSRF form payloads'
    },
    {
      id: 'toolkit',
      title: 'Toolkit',
      description:
        'Encoder/decoder, JWT inspector, hash tools, random generators, and a real scope validator \u2014 all offline. Stop alt-tabbing to CyberChef.',
      fallback: DashboardMockup,
      alt: 'Pentest toolkit utilities with Encoder/Decoder, JWT, Hash, Random, and Scope Validator tabs'
    },
    {
      id: 'submissions',
      title: 'Findings',
      description:
        'Track every finding from draft through triage, resolution, and sign-off. Weekly recap shows findings logged, triaged, resolved, and hours tested.',
      fallback: StatsMockup,
      alt: 'Findings pipeline with 4 reports, 2 in triage, 2 resolved, and weekly recap'
    },
    {
      id: 'references',
      title: 'References',
      description:
        'Knowledge base of writeups, CVEs, tools, cheatsheets, and videos organised by vuln class. Build a personal corpus that travels with you.',
      fallback: NotesMockup,
      alt: 'Bookmarks grid with recon, tools, and CVE references including Burp, Caido, and crt.sh'
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
  <div class="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-dark-xl">
    <!-- Window chrome makes the slide feel like a real product frame. -->
    <div class="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/95 px-4 py-3">
      <span class="h-2.5 w-2.5 rounded-full bg-rose-500/70" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-amber-400/70" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-emerald-500/70" aria-hidden="true"></span>
      <div class="ml-3 hidden truncate font-mono text-xs text-zinc-500 sm:block">
        huntflow.xalgorix.com/{activeShot.id}
      </div>
    </div>

    <!-- The captured PNGs are roughly 1903x854 (~ 20:9). We match that
         aspect ratio exactly so the screenshots fill the frame edge-to-edge
         with no clipping and no visible letterboxing. `object-contain`
         guarantees the entire UI is always visible (Add Target button,
         right-most cards, etc.) even if a future capture has a slightly
         different ratio. The CSS-mockup fallbacks use the same frame so
         layout never jumps when an image fails to load. -->
    <div class="relative aspect-[1903/854] overflow-hidden bg-zinc-950">
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
              class="h-full w-full object-contain object-top"
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
      <h3 class="mt-1.5 text-xl font-semibold text-zinc-100">{activeShot.title}</h3>
      <p class="mt-1.5 text-sm leading-6 text-zinc-400">{activeShot.description}</p>
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
            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}"
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
