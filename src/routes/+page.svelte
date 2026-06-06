<script lang="ts">
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import { ArrowRight, Github, Lock, ShieldCheck, Terminal, Timer, WifiOff } from 'lucide-svelte';
</script>

<svelte:head>
  <title>HuntFlow — Local-First Bug Bounty Workflow App</title>
  <meta
    name="description"
    content="HuntFlow is a local-first bug bounty command center for tracking programs, targets, hunt sessions, evidence, report drafts, and payouts."
  />
  <link rel="canonical" href="https://huntflow.xalgorix.com/" />
  <meta name="robots" content="index,follow" />
  <meta property="og:title" content="HuntFlow — Local-First Bug Bounty Workflow App" />
  <meta
    property="og:description"
    content="Track programs, targets, hunt sessions, evidence, report drafts, and payouts without spreadsheets or cloud lock-in."
  />
  <meta property="og:image" content="https://huntflow.xalgorix.com/brand/huntflow-mark.jpg" />
  <meta property="og:url" content="https://huntflow.xalgorix.com/" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="HuntFlow — Local-First Bug Bounty Workflow App" />
  <meta
    name="twitter:description"
    content="A local-first command center for authorized bug bounty work."
  />
  <meta name="twitter:image" content="https://huntflow.xalgorix.com/brand/huntflow-mark.jpg" />
</svelte:head>

<main class="min-h-screen bg-black text-zinc-50">
  <nav class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
    <a href="/" class="flex items-center gap-3">
      <BrandMark size={30} />
      <span>
        <span class="block text-sm font-semibold">HuntFlow</span>
        <span class="block text-[11px] text-zinc-500">bug bounty command center</span>
      </span>
    </a>
    <div class="flex items-center gap-2">
      <a href="https://github.com/xalgord" class="hf-button-ghost hidden sm:inline-flex" target="_blank" rel="noreferrer">
        <Github size={16} aria-hidden="true" />
        GitHub
      </a>
      <a href="/dashboard" class="hf-button-primary min-h-[40px]">Start using</a>
    </div>
  </nav>

  <section class="relative overflow-hidden border-y border-zinc-900 bg-black">
    <div class="mx-auto flex min-h-[calc(100vh-88px)] max-w-7xl flex-col justify-between px-5 py-14 sm:py-16">
      <div class="mx-auto max-w-5xl text-center">
        <p class="text-sm font-medium text-zinc-400">HuntFlow by xalgord</p>
        <h1 class="mx-auto mt-4 max-w-5xl text-5xl font-semibold leading-tight tracking-normal text-white sm:text-6xl lg:text-7xl">
          Your local-first command center for bug bounty hunting.
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          Track programs, targets, hunt sessions, evidence, report drafts, and payouts without spreadsheets or cloud lock-in.
        </p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/dashboard" class="hf-button-primary">
            Start using
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href="https://github.com/xalgord" target="_blank" rel="noreferrer" class="hf-button-secondary">
            <Github size={16} aria-hidden="true" />
            View GitHub
          </a>
        </div>
        <div class="mx-auto mt-6 inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-zinc-300">
          <Terminal size={15} aria-hidden="true" />
          <span class="truncate">npx huntflow</span>
        </div>
      </div>

      <div class="mt-12 overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div class="flex items-center justify-between border-b border-zinc-900 bg-zinc-950 px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-zinc-700"></span>
            <span class="h-2.5 w-2.5 rounded-full bg-zinc-700"></span>
            <span class="h-2.5 w-2.5 rounded-full bg-zinc-700"></span>
          </div>
          <span class="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-600">Local workspace</span>
        </div>
        <div class="relative max-h-[42vh] min-h-[260px] overflow-hidden bg-black">
          <img
            src="/screenshots/dashboard-command-center.png"
            alt="HuntFlow bug bounty command center dashboard"
            class="h-full min-h-[260px] w-full object-cover object-top opacity-[0.78]"
          />
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-black/80"></div>
        </div>
      </div>
    </div>
  </section>

  <section class="mx-auto grid max-w-7xl gap-4 px-5 py-16 md:grid-cols-3">
    <article class="hf-card p-5">
      <ShieldCheck class="text-zinc-400" size={22} aria-hidden="true" />
      <h2 class="mt-4 text-lg font-semibold text-zinc-100">Workflow-relevant</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-500">Programs, scope, targets, sessions, notes, findings, reports, and payouts are first-class hunting objects.</p>
    </article>
    <article class="hf-card p-5">
      <WifiOff class="text-zinc-400" size={22} aria-hidden="true" />
      <h2 class="mt-4 text-lg font-semibold text-zinc-100">Local-first</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-500">Your workspace lives in the browser on your machine by default. Export, backup, and restore when you need portability.</p>
    </article>
    <article class="hf-card p-5">
      <Timer class="text-zinc-400" size={22} aria-hidden="true" />
      <h2 class="mt-4 text-lg font-semibold text-zinc-100">Built for focus</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-500">Start a timed session, capture evidence as you work, and turn confirmed bugs into structured report drafts.</p>
    </article>
  </section>

  <section class="border-y border-zinc-900 bg-zinc-950/40">
    <div class="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
      <div>
        <p class="hf-eyebrow">Workflow</p>
        <h2 class="mt-3 text-3xl font-semibold text-zinc-50">From program scope to payout outcome.</h2>
        <p class="mt-4 text-sm leading-7 text-zinc-500">
          HuntFlow follows the actual bug bounty loop: choose a program, add in-scope assets, start a hunt, capture notes and evidence, triage findings, draft reports, track submissions, and review what paid off.
        </p>
      </div>
      <ol class="grid gap-3 sm:grid-cols-2">
        {#each ['Choose program', 'Add targets', 'Start session', 'Capture evidence', 'Track findings', 'Draft report', 'Track payout', 'Review analytics'] as step, index}
          <li class="rounded-xl border border-zinc-800 bg-black p-4">
            <span class="font-mono text-xs text-zinc-600">0{index + 1}</span>
            <p class="mt-2 text-sm font-medium text-zinc-100">{step}</p>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-5 py-16">
    <div class="max-w-2xl">
      <p class="hf-eyebrow">Features</p>
      <h2 class="mt-3 text-3xl font-semibold text-zinc-50">A serious daily workspace for security researchers.</h2>
    </div>
    <div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each [
        'Program and policy tracking',
        'Scope and target asset management',
        'Timed hunt sessions',
        'Markdown notes and snippets',
        'Evidence vault and copy actions',
        'Finding triage and report drafts',
        'Payout and outcome tracking',
        'Local import, export, backup, restore',
        'Keyboard command palette'
      ] as feature}
        <div class="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-sm text-zinc-300">{feature}</div>
      {/each}
    </div>
  </section>

  <section class="border-y border-zinc-900 bg-zinc-950/40">
    <div class="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-2">
      <div>
        <Lock class="text-zinc-400" size={24} aria-hidden="true" />
        <h2 class="mt-4 text-3xl font-semibold text-zinc-50">Private by default.</h2>
        <p class="mt-4 text-sm leading-7 text-zinc-500">
          HuntFlow does not require a login for local use and does not add telemetry. Optional hosted account features are isolated from the local-first app workflow.
        </p>
      </div>
      <div class="rounded-2xl border border-zinc-800 bg-black p-5">
        <p class="text-sm font-medium text-zinc-100">Responsible use</p>
        <p class="mt-3 text-sm leading-7 text-zinc-500">
          Use HuntFlow to organize authorized security research and bug bounty work. It does not grant permission to test third-party systems.
        </p>
        <p class="mt-4 text-xs leading-6 text-zinc-600">
          HuntFlow for bug bounty is unrelated to recruitment or ATS software using a similar name.
        </p>
      </div>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-5 py-16">
    <div class="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p class="hf-eyebrow">Quickstart</p>
        <h2 class="mt-3 text-3xl font-semibold text-zinc-50">Run it locally.</h2>
        <p class="mt-4 text-sm leading-7 text-zinc-500">HuntFlow ships as a local app. Start from npm, then export or back up your workspace from Settings.</p>
      </div>
      <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <pre class="overflow-x-auto font-mono text-sm leading-7 text-zinc-200">npx huntflow

npm install -g huntflow
huntflow --port 4000</pre>
      </div>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-5 pb-16">
    <div class="grid gap-4 md:grid-cols-3">
      {#each [
        ['Does HuntFlow sync to the cloud?', 'Local use does not require sync. Optional hosted sync remains separate from the offline-first workspace.'],
        ['Can I import and export data?', 'Yes. Settings includes export, backup, restore, and local data management flows.'],
        ['Is this an AI security scanner?', 'No. HuntFlow organizes authorized research workflows; it does not perform testing or grant permission.']
      ] as item}
        <article class="hf-card p-5">
          <h3 class="text-sm font-semibold text-zinc-100">{item[0]}</h3>
          <p class="mt-2 text-sm leading-6 text-zinc-500">{item[1]}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="border-t border-zinc-900 px-5 py-12">
    <div class="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-semibold text-zinc-50">Start hunting with a cleaner workspace.</h2>
        <p class="mt-2 text-sm text-zinc-500">Local-first bug bounty workflow management by xalgord.</p>
      </div>
      <a href="/dashboard" class="hf-button-primary">
        Start using
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </div>
  </section>
</main>
