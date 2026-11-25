<script lang="ts">
  import { Check, Copy } from 'lucide-svelte';

  const lines = [
    { prompt: true, text: 'subfinder -d acme.com -silent | huntflow push -P acme' },
    { prompt: false, text: '✓ Sent 1,204 lines to HuntFlow for acme.' },
    { prompt: true, text: 'httpx -l hosts.txt -json | huntflow push -P acme' },
    { prompt: false, text: '✓ Sent 318 lines to HuntFlow for acme.' },
    { prompt: true, text: 'nuclei -l live.txt -jsonl | huntflow push -P acme' },
    { prompt: false, text: '✓ Sent 7 lines to HuntFlow for acme.' }
  ];

  let copied = false;
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText('subfinder -d acme.com -silent | huntflow push -P acme');
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }
</script>

<div class="overflow-hidden rounded-[14px] bg-[#1c1c1e] text-left shadow-[0_24px_64px_rgb(0_0_0/0.35)] ring-1 ring-white/10">
  <div class="flex items-center gap-2 border-b border-white/10 px-4 py-3">
    <span class="h-3 w-3 rounded-full bg-[#ff5f57]"></span>
    <span class="h-3 w-3 rounded-full bg-[#febc2e]"></span>
    <span class="h-3 w-3 rounded-full bg-[#28c840]"></span>
    <span class="ml-2 flex-1 text-center text-xs font-medium text-white/40">zsh — recon</span>
    <button
      type="button"
      class="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-medium text-white/80 transition hover:bg-white/15"
      on:click={copy}
      aria-label="Copy the first command"
    >
      {#if copied}<Check size={12} aria-hidden="true" />Copied{:else}<Copy size={12} aria-hidden="true" />Copy{/if}
    </button>
  </div>
  <pre class="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-7 sm:text-[13px]"><code>{#each lines as line}<span class="block {line.prompt ? 'text-white' : 'text-[#30d158]'}">{#if line.prompt}<span class="select-none text-white/35">$ </span>{/if}{line.text}</span>{/each}</code></pre>
</div>
