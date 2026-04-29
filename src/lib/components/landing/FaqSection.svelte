<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';

  interface Faq {
    question: string;
    answer: string;
  }

  // Plain HTML in answers (not markdown) so we can render directly without
  // pulling in a markdown lib for one component on the landing page.
  const faqs: Faq[] = [
    {
      question: 'Do I need an account to use HuntFlow?',
      answer:
        'No. Everything except cloud sync works without signing in. Your data lives in your browser via IndexedDB and stays on your device. Sign in only when you want to sync across devices.'
    },
    {
      question: 'What data is stored in the browser?',
      answer:
        'Targets, sessions, notes, recon, evidence files, payouts, submissions, settings — all of it. You can also export an encrypted backup at any time and restore it on another device.'
    },
    {
      question: 'How does cloud sync compare to a regular database?',
      answer:
        'Cloud sync is real-time. Edits made on one device appear on every other signed-in device in under a second. Conflict resolution uses last-write-wins per record, with deletions tombstoned, so you never silently lose work.'
    },
    {
      question: 'Is my data encrypted in the cloud?',
      answer:
        'Yes. Pro encrypts evidence files and note bodies client-side before they leave your device. Even we cannot read your reports.'
    },
    {
      question: 'Can I cancel Pro any time?',
      answer:
        'Yes. Cancel from your account page. You keep Pro until the end of the current period, and your local data stays intact even if you downgrade.'
    },
    {
      question: 'How is HuntFlow different from a generic note app?',
      answer:
        'It\u2019s built specifically for the bug bounty workflow: targets with scope rules, pomodoro sessions tied to programs, vulnerability-specific note templates, an evidence canvas, payout tracking, ROI per program, and a hunter toolkit (encoder/decoder, JWT, scope validator).'
    },
    {
      question: 'Can I run HuntFlow locally without ever connecting to the internet?',
      answer:
        'Yes. Install with npx huntflow, run the binary, and the app serves entirely from localhost. Works air-gapped. Cloud sync just stays disabled.'
    },
    {
      question: 'Is there a self-hosted Pro option?',
      answer:
        'Self-host coming Q3 — bring your own Convex deployment and you can run sync without our infrastructure. Use the contact form below or email <a href="mailto:huntflow@xalgorix.com" class="text-primary-300 underline-offset-4 hover:underline">huntflow@xalgorix.com</a> if you want early access.'
    }
  ];

  let openIndex = 0;

  function toggle(index: number): void {
    openIndex = openIndex === index ? -1 : index;
  }
</script>

<section id="faq" class="border-b border-slate-800 bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
  <div class="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.7fr_1.3fr]">
    <div>
      <p class="hf-eyebrow">FAQ</p>
      <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">Things people ask before they install.</h2>
      <p class="mt-3 text-sm leading-6 text-slate-400">
        Still have questions? Use the
        <a href="#contact" class="text-primary-300 underline-offset-4 hover:underline">contact form below</a>
        or email
        <a href="mailto:huntflow@xalgorix.com" class="text-primary-300 underline-offset-4 hover:underline">huntflow@xalgorix.com</a>.
      </p>
    </div>

    <ul class="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60">
      {#each faqs as faq, index}
        {@const isOpen = openIndex === index}
        <li>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-900"
            aria-expanded={isOpen}
            aria-controls="faq-panel-{index}"
            on:click={() => toggle(index)}
          >
            <span class="text-sm font-medium text-slate-100 sm:text-base">{faq.question}</span>
            <ChevronDown
              size={18}
              class="shrink-0 text-slate-500 transition-transform duration-200 {isOpen ? 'rotate-180 text-primary-300' : ''}"
              aria-hidden="true"
            />
          </button>
          {#if isOpen}
            <div id="faq-panel-{index}" class="px-5 pb-5 text-sm leading-6 text-slate-400">
              <!-- Answers are author-controlled (no user input) so HTML is safe to render. -->
              {@html faq.answer}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</section>
