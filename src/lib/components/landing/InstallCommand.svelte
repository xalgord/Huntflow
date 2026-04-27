<script lang="ts">
  import { browser } from '$app/environment';
  import { Check, Copy, Terminal } from 'lucide-svelte';

  interface InstallOption {
    label: string;
    command: string;
    note: string;
  }

  // Three install paths covering every reasonable user — npx for casual,
  // npm -g for repeat use, and pwa for fully-online use without Node.
  const options: InstallOption[] = [
    {
      label: 'npx',
      command: 'npx huntflow@latest',
      note: 'No install. Runs once, opens in your browser.'
    },
    {
      label: 'npm',
      command: 'npm install -g huntflow && huntflow',
      note: 'Install once, run anytime as huntflow on your terminal.'
    },
    {
      label: 'pnpm',
      command: 'pnpm dlx huntflow',
      note: 'Same as npx, faster install if you already use pnpm.'
    }
  ];

  let active = 0;
  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyCommand(): Promise<void> {
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(options[active].command);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
      }, 1800);
    } catch {
      // Clipboard might be blocked (e.g. iframe) — silently swallow.
    }
  }
</script>

<div class="rounded-xl border border-slate-800 bg-slate-900/80 p-2 shadow-dark-md backdrop-blur">
  <div role="tablist" aria-label="Install method" class="flex items-center gap-1 px-1.5 pt-1.5">
    {#each options as option, index}
      <button
        type="button"
        role="tab"
        id="install-tab-{index}"
        aria-controls="install-panel-{index}"
        aria-selected={active === index}
        tabindex={active === index ? 0 : -1}
        class="relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition {active === index
          ? 'bg-slate-800 text-slate-100 shadow-inner-line'
          : 'text-slate-400 hover:text-slate-200'}"
        on:click={() => (active = index)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  <div
    role="tabpanel"
    id="install-panel-{active}"
    aria-labelledby="install-tab-{active}"
    class="mt-1.5 flex items-center gap-3 rounded-lg bg-slate-950 px-4 py-3.5"
  >
    <Terminal size={16} class="shrink-0 text-primary-400" aria-hidden="true" />
    <code
      class="flex-1 truncate font-mono text-sm text-slate-100"
      data-testid="install-command"
    >{options[active].command}</code>
    <button
      type="button"
      class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 transition hover:border-primary-500/50 hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      aria-label="Copy install command"
      on:click={copyCommand}
    >
      {#if copied}
        <Check size={14} aria-hidden="true" />
      {:else}
        <Copy size={14} aria-hidden="true" />
      {/if}
    </button>
  </div>

  <p class="px-3 pb-2.5 pt-2 text-xs text-slate-500">{options[active].note}</p>
</div>
