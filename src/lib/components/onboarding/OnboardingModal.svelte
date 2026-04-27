<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { loadDemoWorkspace } from '$lib/seeds/demoWorkspace';
  import { settingsStore } from '$lib/stores';
  import { goto } from '$app/navigation';
  import {
    BarChart3,
    CheckCircle2,
    FileText,
    Flame,
    Sparkles,
    Target,
    Timer
  } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';

  interface OnboardingStep {
    title: string;
    description: string;
    icon: ComponentType;
    accent: string;
  }

  export let open = false;

  let stepIndex = 0;
  let touchStartX = 0;
  let saving = false;
  let loadingDemo = false;
  let demoError = '';

  const steps: OnboardingStep[] = [
    {
      title: 'Welcome to HuntFlow',
      description: 'Hunt smarter. Stay consistent. Get paid.',
      icon: Flame,
      accent: 'text-primary-400 bg-primary-500/10 border-primary-500/30'
    },
    {
      title: 'Start focused hunting sessions',
      description: 'Use timed sessions to stay locked in, track actual hunting time, and keep your workflow moving.',
      icon: Timer,
      accent: 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    },
    {
      title: 'Track your bug bounty programs',
      description: 'Keep targets, scope, platform, priority, and status in one place from recon through payout.',
      icon: Target,
      accent: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    },
    {
      title: 'Take structured security notes',
      description: 'Start from vulnerability templates so findings stay organized and easier to turn into reports.',
      icon: FileText,
      accent: 'text-violet-400 bg-violet-500/10 border-violet-500/30'
    },
    {
      title: 'Build consistency with streaks',
      description: 'Watch daily streaks, hunting time, templates, and active hours to find your best rhythm.',
      icon: BarChart3,
      accent: 'text-green-400 bg-green-500/10 border-green-500/30'
    },
    {
      title: 'Start your first session',
      description: 'Pick a target, choose a duration, and begin your first focused hunt.',
      icon: CheckCircle2,
      accent: 'text-primary-400 bg-primary-500/10 border-primary-500/30'
    }
  ];

  $: currentStep = steps[stepIndex];
  $: isLastStep = stepIndex === steps.length - 1;

  function goToStep(index: number): void {
    stepIndex = Math.min(Math.max(index, 0), steps.length - 1);
  }

  function next(): void {
    if (isLastStep) {
      void finish(true);
      return;
    }
    goToStep(stepIndex + 1);
  }

  function previous(): void {
    goToStep(stepIndex - 1);
  }

  async function finish(startSession = false): Promise<void> {
    if (saving) return;
    saving = true;

    try {
      await settingsStore.setValue('onboardingCompleted', true);
      if (startSession) await goto('/timer');
    } finally {
      saving = false;
    }
  }

  async function loadDemoAndContinue(): Promise<void> {
    if (loadingDemo) return;
    loadingDemo = true;
    demoError = '';
    try {
      await loadDemoWorkspace();
      await settingsStore.setValue('onboardingCompleted', true);
      await goto('/');
    } catch (error) {
      demoError = error instanceof Error ? error.message : 'Could not load the demo workspace.';
    } finally {
      loadingDemo = false;
    }
  }

  function handleTouchStart(event: TouchEvent): void {
    touchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;

    if (Math.abs(deltaX) < 48) return;
    if (deltaX < 0) next();
    if (deltaX > 0) previous();
  }
</script>

<Modal {open} closeOnOverlay={false} title={currentStep.title} on:close={() => finish(false)}>
  <div class="space-y-5" on:touchstart={handleTouchStart} on:touchend={handleTouchEnd}>
    <div class="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border {currentStep.accent}">
        <svelte:component this={currentStep.icon} size={30} aria-hidden="true" />
      </div>

      <p class="mt-5 text-center text-sm leading-6 text-slate-400">{currentStep.description}</p>

      {#if isLastStep}
        <button
          type="button"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-sm font-medium text-primary-200 transition hover:bg-primary-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          on:click={loadDemoAndContinue}
          disabled={loadingDemo || saving}
        >
          <Sparkles size={16} aria-hidden="true" />
          {loadingDemo ? 'Loading sample workspace…' : 'Try with sample data instead'}
        </button>
        <p class="mt-2 text-center text-xs text-slate-500">
          Loads 3 demo programs, sessions, notes, recon assets, and a paid submission so you can explore every screen.
        </p>
        {#if demoError}
          <p class="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {demoError}
          </p>
        {/if}
      {/if}

      <div class="mt-5 flex justify-center gap-2" aria-label="Onboarding steps">
        {#each steps as step, index}
          <button
            type="button"
            class="h-3 min-h-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 {index === stepIndex
              ? 'w-8 bg-primary-500'
              : 'w-3 bg-slate-600 hover:bg-slate-500'}"
            aria-label={`Go to step ${index + 1}: ${step.title}`}
            aria-current={index === stepIndex ? 'step' : undefined}
            on:click={() => goToStep(index)}
          ></button>
        {/each}
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <button
        type="button"
        class="inline-flex min-h-[44px] items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-700 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        on:click={() => finish(false)}
      >
        Skip
      </button>

      <div class="flex items-center gap-2">
        {#if stepIndex > 0}
          <Button variant="secondary" on:click={previous}>Back</Button>
        {/if}
        <Button loading={saving} on:click={next}>
          {isLastStep ? 'Start your first session' : 'Next'}
        </Button>
      </div>
    </div>
  </div>
</Modal>
