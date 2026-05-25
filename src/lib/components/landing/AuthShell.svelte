<script lang="ts">
  import { ArrowLeft, Crosshair } from 'lucide-svelte';

  export let title: string;
  export let subtitle: string = '';
  export let footer: 'sign-in' | 'sign-up' | null = null;
</script>

<div class="auth-shell min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
  <header class="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
      <a href="/" class="flex min-h-[44px] items-center gap-2.5 text-zinc-100">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Crosshair size={18} aria-hidden="true" />
        </span>
        <span class="text-base font-semibold tracking-tight">HuntFlow</span>
      </a>

      <a href="/" class="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to home
      </a>
    </div>
  </header>

  <main class="relative isolate flex min-h-[calc(100vh-69px)] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
    <!-- Same hero glow as the landing page so auth feels part of the marketing world -->
    <div class="absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-0 bg-zinc-950"></div>
      <div class="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.18),_transparent_55%)]"></div>
    </div>

    <div class="w-full max-w-md">
      <div class="text-center">
        <h1 class="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">{title}</h1>
        {#if subtitle}
          <p class="mt-3 text-sm leading-6 text-zinc-400">{subtitle}</p>
        {/if}
      </div>

      <div class="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-dark-xl backdrop-blur sm:p-8">
        <slot />
      </div>

      {#if footer === 'sign-in'}
        <p class="mt-6 text-center text-sm text-zinc-400">
          Don&apos;t have an account?
          <a href="/sign-up" class="font-medium text-primary-300 underline-offset-4 hover:underline">Create one free</a>
        </p>
      {:else if footer === 'sign-up'}
        <p class="mt-6 text-center text-sm text-zinc-400">
          Already have an account?
          <a href="/sign-in" class="font-medium text-primary-300 underline-offset-4 hover:underline">Sign in</a>
        </p>
      {/if}
    </div>
  </main>
</div>
