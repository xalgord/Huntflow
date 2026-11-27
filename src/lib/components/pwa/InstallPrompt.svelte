<script lang="ts">
  import { browser } from '$app/environment';
  import { Download, X } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  type BeforeInstallPromptEvent = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };

  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  let visible = false;
  let isStandalone = false;

  function storageKey(key: string): string {
    return `huntflow-pwa-${key}`;
  }

  function shouldShow(): boolean {
    if (!browser || isStandalone) return false;
    if (localStorage.getItem(storageKey('dismissed')) === 'true') return false;
    return Number(localStorage.getItem(storageKey('visits')) ?? '0') >= 2;
  }

  function handleBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    visible = shouldShow();
  }

  async function install(): Promise<void> {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') localStorage.setItem(storageKey('dismissed'), 'true');
    deferredPrompt = null;
    visible = false;
  }

  function dismiss(): void {
    localStorage.setItem(storageKey('dismissed'), 'true');
    visible = false;
  }

  onMount(() => {
    if (!browser) return;
    isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    const visits = Number(localStorage.getItem(storageKey('visits')) ?? '0') + 1;
    localStorage.setItem(storageKey('visits'), String(visits));
    visible = shouldShow() && /iphone|ipad|ipod/i.test(navigator.userAgent);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  });
</script>

{#if visible}
  <section
    class="hf-material hf-rim hf-floating-pane fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-[22px] p-4 lg:bottom-4"
  >
    <div class="flex gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
        <Download size={20} aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-zinc-100">Add HuntFlow to Home Screen</h2>
        <p class="mt-1 text-sm leading-6 text-zinc-400">
          Install the offline-first app for faster access during hunts.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          {#if deferredPrompt}
            <button
              type="button"
              class="hf-button-primary"
              on:click={install}
            >
              Install
            </button>
          {:else}
            <p class="hf-card-muted px-3 py-2 text-xs text-zinc-400">
              Use Share, then Add to Home Screen.
            </p>
          {/if}
          <button
            type="button"
            class="hf-button-secondary"
            on:click={dismiss}
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex h-10 min-h-[40px] w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-[var(--hf-fill)] hover:text-zinc-100"
        aria-label="Dismiss install prompt"
        on:click={dismiss}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  </section>
{/if}
