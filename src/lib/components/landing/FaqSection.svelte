<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';

  interface Faq {
    question: string;
    answer: string;
  }

  // Plain HTML in answers (not markdown) so we can render directly without
  // pulling in a markdown lib for one component on the landing page.
  const link = (href: string, label: string) => `<a href="${href}" class="text-primary underline-offset-4 hover:underline">${label}</a>`;

  const faqs: Faq[] = [
    {
      question: 'Is HuntFlow free?',
      answer:
        'Yes. Everything that runs on your machine is free and open source under the MIT license. Pro is optional and adds cloud sync between your devices.'
    },
    {
      question: 'Do I need an account?',
      answer:
        'No. Everything except cloud sync works without signing in. Sign in only when you want the same workspace on another device.'
    },
    {
      question: 'Where is my data stored?',
      answer:
        'In your browser (IndexedDB), on your machine. When you run <code>npx huntflow</code>, HuntFlow also writes rotating backups to <code>~/.huntflow/backups</code>, so clearing the browser never means losing findings. You can export a full backup from Settings at any time.'
    },
    {
      question: 'Which platforms and tools does it work with?',
      answer:
        'Findings export field by field for HackerOne, Bugcrowd, Intigriti and YesWeHack, or as Markdown and PDF. Scope imports from HackerOne CSV and pasted Bugcrowd or Intigriti tables; recon imports from subfinder, amass, httpx, nuclei, nmap and Burp Suite, by paste, file or <code>huntflow push</code>.'
    },
    {
      question: 'Is it only for bug bounty?',
      answer:
        'No. Solo pentesters use the same workspace for engagements: scope, time-boxed sessions, findings with CVSS 3.1 and 4.0, and a client-ready engagement report you can export as PDF.'
    },
    {
      question: 'Does it work offline or air-gapped?',
      answer:
        'Yes. Run <code>npx huntflow</code> and the app is served from localhost. It also installs as an offline-capable web app. Cloud sync simply stays off.'
    },
    {
      question: 'Is my data encrypted in the cloud?',
      answer:
        'Yes, in transit and at rest. Synced records and evidence files are stored per account, and only your signed-in account can read them. Without Pro, nothing leaves your device at all.'
    },
    {
      question: 'Can I cancel Pro any time?',
      answer:
        'Yes. Cancel from your account page. You keep Pro until the end of the current period, and your local data stays intact if you downgrade.'
    },
    {
      question: 'Can I self-host sync?',
      answer: `Not yet. If you need it, email ${link('mailto:huntflow@xalgorix.com', 'huntflow@xalgorix.com')}.`
    }
  ];

  let openIndex = 0;

  function toggle(index: number): void {
    openIndex = openIndex === index ? -1 : index;
  }
</script>

<section id="faq" class="px-5 py-24 sm:py-32">
  <div class="mx-auto grid max-w-[1024px] gap-10 lg:grid-cols-[0.8fr_1.2fr]">
    <div>
      <h2 class="text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[2.5rem]">Questions</h2>
      <p class="mt-3 text-[0.9375rem] leading-7 text-muted-foreground">
        Anything else? Email
        <a href="mailto:huntflow@xalgorix.com" class="text-primary underline-offset-4 hover:underline">huntflow@xalgorix.com</a>.
      </p>
    </div>

    <ul class="hf-list overflow-hidden rounded-[14px]" style="background: var(--hf-surface); box-shadow: var(--hf-shadow-sm)">
      {#each faqs as faq, index}
        {@const isOpen = openIndex === index}
        <li>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            aria-expanded={isOpen}
            aria-controls="faq-panel-{index}"
            on:click={() => toggle(index)}
          >
            <span class="text-[0.9375rem] font-medium text-foreground">{faq.question}</span>
            <ChevronDown
              size={18}
              class="shrink-0 text-zinc-500 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
              aria-hidden="true"
            />
          </button>
          {#if isOpen}
            <div id="faq-panel-{index}" class="hf-faq-answer px-5 pb-5 text-[0.875rem] leading-6 text-muted-foreground">
              <!-- Answers are author-controlled (no user input) so HTML is safe to render. -->
              {@html faq.answer}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .hf-faq-answer :global(code) {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.8125rem;
    background: var(--hf-fill);
    border-radius: 5px;
    padding: 1px 5px;
  }
</style>
