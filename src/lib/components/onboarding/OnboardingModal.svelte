<script lang="ts">
  import { goto } from '$app/navigation';
  import { IS_WEB } from '$lib/buildTarget';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { settingsStore } from '$lib/stores';
  import { Download, FileText, Loader2, Lock, Sparkles, Wallet } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';

  export let open = false;
  /** True right after a Pro checkout, so the sheet confirms sync is on. */
  export let isPro = false;

  interface Feature {
    icon: ComponentType;
    title: string;
    body: string;
    tint: string;
  }

  // One Apple-style welcome sheet: what HuntFlow does, then straight to work.
  const features: Feature[] = [
    {
      icon: Download,
      title: 'Bring scope and recon in',
      body: 'Import a HackerOne scope CSV or pipe in subfinder, httpx and nuclei. Out-of-scope hosts are flagged for you.',
      tint: 'text-blue-500'
    },
    {
      icon: FileText,
      title: 'Write reports triage accepts',
      body: 'Templates, CVSS 3.1 and 4.0, attached requests, and copy-ready fields for every platform.',
      tint: 'text-orange-500'
    },
    {
      icon: Wallet,
      title: 'Follow every finding to payout',
      body: 'Track triage, bounties and hunting time, and export a client-ready report when you’re done.',
      tint: 'text-green-500'
    },
    {
      icon: Lock,
      title: 'Your data stays on this device',
      body: 'No account needed. Download a backup from Settings at any time.',
      tint: 'text-primary'
    }
  ];

  let saving = false;
  let loadingDemo = false;
  let demoError = '';

  async function finish(destination?: string): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await settingsStore.setValue('onboardingCompleted', true);
      await settingsStore.persistNow();
      if (destination) await goto(destination);
    } finally {
      saving = false;
    }
  }

  async function loadDemoAndContinue(): Promise<void> {
    if (loadingDemo) return;
    loadingDemo = true;
    demoError = '';
    try {
      // Dynamic import keeps the demo seeder out of the app build, where
      // this button never renders (see the IS_WEB guard below).
      const { loadDemoWorkspace } = await import('$lib/seeds/demoWorkspace');
      await loadDemoWorkspace();
      await settingsStore.setValue('onboardingCompleted', true);
      await settingsStore.persistNow();
      await goto('/dashboard');
    } catch (error) {
      demoError = error instanceof Error ? error.message : 'Could not load the sample workspace.';
    } finally {
      loadingDemo = false;
    }
  }
</script>

<Modal {open} closeOnOverlay={false} on:close={() => finish()} labelledBy="welcome-title">
  <div class="px-1 pb-1 pt-2 text-center sm:px-4">
    <h2 id="welcome-title" class="text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-foreground">Welcome to HuntFlow</h2>
    <p class="mt-1.5 text-[0.9375rem] text-muted-foreground">Recon to report, in one calm workspace.</p>
  </div>

  {#if isPro}
    <p class="mt-4 flex items-start gap-2 rounded-[10px] bg-green-500/[0.12] px-3 py-2.5 text-[0.8125rem] text-green-600 dark:text-green-400" role="status">
      <Sparkles size={15} class="mt-0.5 shrink-0" aria-hidden="true" />
      <span><span class="font-semibold">Your Pro plan is active.</span> Cloud sync keeps this workspace up to date on every signed-in device.</span>
    </p>
  {/if}

  <ul class="mt-6 space-y-5 px-1 sm:px-4">
    {#each features as feature}
      <li class="flex items-start gap-4">
        <svelte:component this={feature.icon} size={30} strokeWidth={1.7} class="mt-0.5 shrink-0 {feature.tint}" aria-hidden="true" />
        <div>
          <p class="text-[0.9375rem] font-semibold text-foreground">{feature.title}</p>
          <p class="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">{feature.body}</p>
        </div>
      </li>
    {/each}
  </ul>

  {#if demoError}
    <p class="mt-5 rounded-[10px] bg-red-500/[0.12] px-3 py-2 text-center text-xs text-red-500" role="alert">{demoError}</p>
  {/if}

  <div class="mt-8 flex flex-col gap-2 sm:px-4">
    <button type="button" class="hf-button-primary h-11 w-full text-[0.9375rem]" disabled={saving || loadingDemo} on:click={() => finish('/programs?new=1')}>
      {#if saving}<Loader2 size={16} class="animate-spin" aria-hidden="true" />{/if}
      Add Your First Program
    </button>
    {#if IS_WEB}
      <button type="button" class="hf-button-secondary h-11 w-full text-[0.9375rem]" disabled={saving || loadingDemo} on:click={loadDemoAndContinue}>
        {#if loadingDemo}<Loader2 size={16} class="animate-spin" aria-hidden="true" />{/if}
        {loadingDemo ? 'Loading Sample Data…' : 'Explore with Sample Data'}
      </button>
    {/if}
    <button type="button" class="hf-button-ghost h-10 w-full text-[0.875rem]" disabled={saving || loadingDemo} on:click={() => finish()}>Not Now</button>
  </div>
</Modal>
