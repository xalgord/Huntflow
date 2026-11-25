<script lang="ts">
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import FaqSection from '$lib/components/landing/FaqSection.svelte';
  import ProductShot from '$lib/components/landing/ProductShot.svelte';
  import TerminalDemo from '$lib/components/landing/TerminalDemo.svelte';
  import {
    ArrowRight,
    Check,
    CircleDollarSign,
    Copy as CopyIcon,
    DatabaseBackup,
    Gauge,
    Github,
    HardDrive,
    Layers,
    Lock,
    ScanSearch,
    ShieldCheck,
    Timer,
    WifiOff
  } from 'lucide-svelte';

  const REPO = 'https://github.com/xalgord/huntflow';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HuntFlow',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web, Windows, macOS, Linux',
    description:
      'Local-first workspace for bug bounty hunters and pentesters: scope and recon imports, findings that export to HackerOne, Bugcrowd, Intigriti and YesWeHack, engagement reports and payouts.',
    url: 'https://huntflow.xalgorix.com',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'xalgorix', url: 'https://huntflow.xalgorix.com' }
  };
  const jsonLdScript = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  const steps = [
    {
      eyebrow: 'Scope & recon',
      title: 'Bring your scope and recon in.',
      body: 'Drop in a HackerOne scope CSV or paste a Bugcrowd table, then pipe in subfinder, httpx, nuclei, nmap or Burp. Every host is checked against the program’s rules first, so out-of-scope assets never reach your test list.',
      points: ['HackerOne, Bugcrowd and Intigriti scope', 'subfinder, amass, httpx, nmap', 'nuclei and Burp become draft findings'],
      shot: 'import',
      alt: 'Import sheet previewing httpx and subfinder output with out-of-scope hosts skipped'
    },
    {
      eyebrow: 'Write-ups',
      title: 'Reports triage accepts the first time.',
      body: 'Start from one of 29 templates, score with CVSS 3.1 or 4.0, attach the exact request and response, and get warned about likely duplicates. Then copy each field straight into the platform’s form.',
      points: ['HackerOne, Bugcrowd, Intigriti, YesWeHack', 'CVSS 3.1 and 4.0 calculators', 'Duplicate warnings before you submit'],
      shot: 'findings',
      alt: 'Findings editor with an IDOR write-up, severity and CWE'
    },
    {
      eyebrow: 'Deliver',
      title: 'A client-ready report in one click.',
      body: 'For pentests and VDPs, HuntFlow writes the engagement report for you: executive summary, scope, findings overview and every finding with its evidence — exported as a clean PDF or Markdown.',
      points: ['Executive summary written from your findings', 'Severity overview and overall risk', 'PDF and Markdown export'],
      shot: 'report',
      alt: 'Engagement report preview with cover page and executive summary'
    }
  ];

  const features = [
    { icon: ShieldCheck, title: 'Scope guard', body: 'Wildcards, exclusions, CIDRs and URL paths. Check any URL in a keystroke.' },
    { icon: Timer, title: 'Focused sessions', body: 'Time-box your hunting per program and see where the hours actually go.' },
    { icon: Layers, title: 'Evidence vault', body: 'Screenshots, requests and notes linked to the findings they prove.' },
    { icon: ScanSearch, title: 'Duplicate warnings', body: 'Similar findings surface before you submit, not after triage closes them.' },
    { icon: CircleDollarSign, title: 'Payouts & taxes', body: 'Bounties by program and platform, with a year-end export for your accountant.' },
    { icon: Gauge, title: 'Today view', body: 'What needs you next: overdue triage, drafts, unpaid bounties, untested targets.' }
  ];

  let copied = false;
  async function copyInstall(): Promise<void> {
    try {
      await navigator.clipboard.writeText('npx huntflow');
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }
</script>

<svelte:head>
  <title>HuntFlow — The workspace for bug bounty hunters and pentesters</title>
  <link rel="canonical" href="https://huntflow.xalgorix.com/" />
  <meta name="robots" content="index,follow" />
  {@html `<script type="application/ld+json">${jsonLdScript}</script>`}
</svelte:head>

<div class="min-h-screen text-foreground" style="background: var(--hf-window)">
  <header class="hf-toolbar-material sticky top-0 z-50 border-b-[0.5px] border-zinc-800">
    <nav class="mx-auto flex h-12 max-w-[1024px] items-center justify-between px-5" aria-label="Main">
      <a href="/" class="flex items-center gap-2 text-[0.9375rem] font-semibold">
        <BrandMark size={24} />
        HuntFlow
      </a>
      <div class="hidden items-center gap-7 text-[0.8125rem] text-muted-foreground md:flex">
        <a class="transition hover:text-foreground" href="/#workflow">Workflow</a>
        <a class="transition hover:text-foreground" href="/#terminal">Terminal</a>
        <a class="transition hover:text-foreground" href="/#private">Privacy</a>
        <a class="transition hover:text-foreground" href="/#faq">FAQ</a>
        <a class="transition hover:text-foreground" href="/pricing">Pricing</a>
      </div>
      <div class="flex items-center gap-1.5">
        <a href={REPO} class="hf-icon-button" target="_blank" rel="noreferrer" aria-label="HuntFlow on GitHub">
          <Github size={17} aria-hidden="true" />
        </a>
        <a href="/dashboard" class="hf-button-primary h-8 min-h-0 px-3.5 text-[0.8125rem]">Open App</a>
      </div>
    </nav>
  </header>

  <main>
    <!-- Hero -->
    <section class="overflow-hidden px-5 pb-16 pt-16 text-center sm:pt-24">
      <p class="text-[0.9375rem] font-semibold text-primary">For bug bounty hunters and pentesters</p>
      <h1 class="mx-auto mt-3 max-w-[900px] text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[4rem] lg:text-[5rem]">
        Recon to report.<br />One calm workspace.
      </h1>
      <p class="mx-auto mt-6 max-w-[640px] text-[1.0625rem] leading-7 text-muted-foreground sm:text-[1.1875rem] sm:leading-8">
        HuntFlow keeps scope, targets, findings and payouts together. Pipe in your tools, write reports triage accepts,
        and never lose a lead — all on your own machine.
      </p>
      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="/demo?go=/dashboard" class="hf-button-primary h-11 px-6 text-[0.9375rem]">
          Try the Demo
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        <button
          type="button"
          class="hf-button-secondary h-11 px-5 font-mono text-[0.875rem]"
          on:click={copyInstall}
          aria-label="Copy install command: npx huntflow"
        >
          <span class="select-none text-zinc-500">$</span> npx huntflow
          {#if copied}<Check size={15} class="text-green-500" aria-hidden="true" />{:else}<CopyIcon size={15} class="text-zinc-500" aria-hidden="true" />{/if}
        </button>
      </div>
      <p class="mt-4 text-[0.8125rem] text-zinc-500">Free and open source · No account · Works offline</p>

      <div class="mx-auto mt-14 max-w-[1100px] sm:mt-20">
        <ProductShot name="today" alt="HuntFlow Today view: hunting time, findings in flight, acceptance rate, earnings and what needs attention" eager />
      </div>
    </section>

    <!-- Workflow -->
    <section id="workflow" class="px-5 py-20 sm:py-28" style="background: var(--hf-surface)">
      <div class="mx-auto max-w-[1024px] text-center">
        <h2 class="text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[3rem]">Built around how you actually hunt.</h2>
        <p class="mx-auto mt-4 max-w-[620px] text-[1.0625rem] leading-7 text-muted-foreground">
          Not a notes app with a security skin. Every screen follows the path from a program’s scope to a paid report.
        </p>
      </div>

      <div class="mx-auto mt-16 max-w-[1100px] space-y-24 sm:mt-24 sm:space-y-32">
        {#each steps as step, index}
          <article class="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
            <div class={index % 2 === 1 ? 'lg:order-2' : ''}>
              <p class="text-[0.9375rem] font-semibold text-primary">{step.eyebrow}</p>
              <h3 class="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">{step.title}</h3>
              <p class="mt-4 text-[1rem] leading-7 text-muted-foreground">{step.body}</p>
              <ul class="mt-6 space-y-2.5">
                {#each step.points as point}
                  <li class="flex items-start gap-2.5 text-[0.9375rem]">
                    <Check size={18} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    {point}
                  </li>
                {/each}
              </ul>
            </div>
            <div class={index % 2 === 1 ? 'lg:order-1' : ''}>
              <ProductShot name={step.shot} alt={step.alt} />
            </div>
          </article>
        {/each}
      </div>
    </section>

    <!-- Terminal -->
    <section id="terminal" class="dark bg-black px-5 py-20 text-white sm:py-28">
      <div class="mx-auto grid max-w-[1024px] items-center gap-12 lg:grid-cols-2">
        <div>
          <p class="text-[0.9375rem] font-semibold text-[#ff6482]">huntflow push</p>
          <h2 class="mt-2 text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[3rem]">Pipe it in.</h2>
          <p class="mt-4 text-[1.0625rem] leading-7 text-white/65">
            Recon happens in the terminal, so that’s where HuntFlow listens. Add <code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]">| huntflow push</code>
            to any command. The output waits for your review with the program already picked, the scope already checked and
            duplicates already merged.
          </p>
          <p class="mt-4 text-[0.875rem] text-white/45">If HuntFlow isn’t running, it’s queued for next time.</p>
        </div>
        <TerminalDemo />
      </div>
    </section>

    <!-- Features -->
    <section class="px-5 py-20 sm:py-28">
      <div class="mx-auto max-w-[1024px]">
        <h2 class="text-center text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[3rem]">The details matter.</h2>
        <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each features as feature}
            <article class="rounded-[18px] p-6" style="background: var(--hf-surface); box-shadow: var(--hf-shadow-sm)">
              <svelte:component this={feature.icon} size={26} strokeWidth={1.8} class="text-primary" aria-hidden="true" />
              <h3 class="mt-4 text-[1.0625rem] font-semibold">{feature.title}</h3>
              <p class="mt-1.5 text-[0.9375rem] leading-6 text-muted-foreground">{feature.body}</p>
            </article>
          {/each}
        </div>
        <div class="mt-14">
          <ProductShot name="scope" alt="Program scope with in-scope and out-of-scope rules and a URL checker" />
        </div>
      </div>
    </section>

    <!-- Privacy -->
    <section id="private" class="px-5 py-20 sm:py-28" style="background: var(--hf-surface)">
      <div class="mx-auto max-w-[1024px] text-center">
        <Lock size={40} strokeWidth={1.6} class="mx-auto text-primary" aria-hidden="true" />
        <h2 class="mt-5 text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[3rem]">Your findings stay yours.</h2>
        <p class="mx-auto mt-4 max-w-[640px] text-[1.0625rem] leading-7 text-muted-foreground">
          Unreported vulnerabilities are the most sensitive thing you own. HuntFlow keeps them on your machine, with no
          account and no telemetry.
        </p>
        <div class="mt-12 grid gap-4 text-left sm:grid-cols-3">
          <article class="rounded-[18px] p-6" style="background: var(--hf-window)">
            <HardDrive size={24} strokeWidth={1.8} class="text-primary" aria-hidden="true" />
            <h3 class="mt-4 text-[1.0625rem] font-semibold">Local first</h3>
            <p class="mt-1.5 text-[0.9375rem] leading-6 text-muted-foreground">Everything lives in your browser on your device. Nothing phones home.</p>
          </article>
          <article class="rounded-[18px] p-6" style="background: var(--hf-window)">
            <DatabaseBackup size={24} strokeWidth={1.8} class="text-primary" aria-hidden="true" />
            <h3 class="mt-4 text-[1.0625rem] font-semibold">Backed up to disk</h3>
            <p class="mt-1.5 text-[0.9375rem] leading-6 text-muted-foreground">Run from <code class="font-mono text-[0.875em]">npx huntflow</code> and rotating backups are written to your home folder.</p>
          </article>
          <article class="rounded-[18px] p-6" style="background: var(--hf-window)">
            <WifiOff size={24} strokeWidth={1.8} class="text-primary" aria-hidden="true" />
            <h3 class="mt-4 text-[1.0625rem] font-semibold">Works offline</h3>
            <p class="mt-1.5 text-[0.9375rem] leading-6 text-muted-foreground">Installable and air-gap friendly. Sync across devices only if you choose Pro.</p>
          </article>
        </div>
        <a href="/pricing" class="hf-link mt-8 inline-flex items-center gap-1 text-[0.9375rem]">
          Compare Free and Pro
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
    </section>

    <FaqSection />

    <!-- Final CTA -->
    <section class="px-5 pb-24 text-center sm:pb-32">
      <div class="mx-auto max-w-[760px]">
        <h2 class="text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[3rem]">Start your next hunt here.</h2>
        <p class="mt-4 text-[1.0625rem] leading-7 text-muted-foreground">Open it in your browser, or run it locally with one command.</p>
        <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/dashboard" class="hf-button-primary h-11 px-6 text-[0.9375rem]">
            Open HuntFlow
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href={REPO} target="_blank" rel="noreferrer" class="hf-button-secondary h-11 px-5 text-[0.9375rem]">
            <Github size={16} aria-hidden="true" />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  </main>

  <footer class="border-t-[0.5px] border-zinc-800 px-5 py-8 text-[0.75rem] text-zinc-500">
    <div class="mx-auto flex max-w-[1024px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p>© 2026 HuntFlow by xalgorix · MIT License · For authorised testing only.</p>
      <nav class="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
        <a class="hover:text-foreground" href="/dashboard">Open App</a>
        <a class="hover:text-foreground" href="/pricing">Pricing</a>
        <a class="hover:text-foreground" href="/sign-in">Sign In</a>
        <a class="hover:text-foreground" href={REPO} rel="noreferrer">GitHub</a>
        <a class="hover:text-foreground" href="mailto:huntflow@xalgorix.com">Contact</a>
      </nav>
    </div>
  </footer>
</div>
