<script lang="ts">
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import { ArrowLeft } from 'lucide-svelte';

  export let title: string;
  export let subtitle: string = '';
  export let footer: 'sign-in' | 'sign-up' | null = null;
</script>

<div class="auth-shell min-h-screen overflow-hidden text-foreground">
  <header class="hf-toolbar-material hf-hairline-b sticky top-0 z-10">
    <div class="mx-auto flex h-12 max-w-[1024px] items-center justify-between gap-4 px-5">
      <a href="/" class="flex items-center gap-2 text-[0.9375rem] font-semibold">
        <BrandMark size={24} />
        HuntFlow
      </a>
      <a href="/" class="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to home
      </a>
    </div>
  </header>

  <main class="flex min-h-[calc(100vh-48px)] items-center justify-center px-5 py-16">
    <div class="w-full max-w-md">
      <div class="text-center">
        <h1 class="text-[2rem] font-semibold tracking-[-0.02em] sm:text-[2.5rem]">{title}</h1>
        {#if subtitle}
          <p class="mt-3 text-[0.9375rem] leading-6 text-muted-foreground">{subtitle}</p>
        {/if}
      </div>

      <div class="hf-glass hf-glass-elevated hf-glass-blur mt-8 rounded-[24px] p-6 sm:p-8">
        <slot />
      </div>

      {#if footer === 'sign-in'}
        <p class="mt-6 text-center text-[0.875rem] text-muted-foreground">
          Don&apos;t have an account?
          <a href="/sign-up" class="font-medium text-primary underline-offset-4 hover:underline">Create one free</a>
        </p>
      {:else if footer === 'sign-up'}
        <p class="mt-6 text-center text-[0.875rem] text-muted-foreground">
          Already have an account?
          <a href="/sign-in" class="font-medium text-primary underline-offset-4 hover:underline">Sign in</a>
        </p>
      {/if}
    </div>
  </main>
</div>
