<script lang="ts">
  import EncoderPanel from '$lib/components/tools/EncoderPanel.svelte';
  import HashPanel from '$lib/components/tools/HashPanel.svelte';
  import JwtPanel from '$lib/components/tools/JwtPanel.svelte';
  import RandomPanel from '$lib/components/tools/RandomPanel.svelte';
  import ScopeValidatorPanel from '$lib/components/tools/ScopeValidatorPanel.svelte';
  import {
    Binary,
    Dices,
    KeyRound,
    ShieldCheck,
    Wrench
  } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';

  type Tab = {
    id: string;
    label: string;
    description: string;
    icon: ComponentType;
    component: ComponentType;
  };

  const tabs: Tab[] = [
    {
      id: 'encoder',
      label: 'Encoder / Decoder',
      description: 'URL, Base64, Hex, HTML entities, Unicode escapes — live two-way conversion.',
      icon: Wrench,
      component: EncoderPanel
    },
    {
      id: 'jwt',
      label: 'JWT',
      description: 'Inspect headers, claims, expiry, and algorithm of any JSON Web Token.',
      icon: KeyRound,
      component: JwtPanel
    },
    {
      id: 'hash',
      label: 'Hash',
      description: 'SHA-1 / 256 / 384 / 512 digests via Web Crypto, all four computed live.',
      icon: Binary,
      component: HashPanel
    },
    {
      id: 'random',
      label: 'Random',
      description: 'UUIDs and cryptographically random tokens for fixtures and PoCs.',
      icon: Dices,
      component: RandomPanel
    },
    {
      id: 'scope',
      label: 'Scope Validator',
      description: 'Paste URLs, instantly see which target rule includes or excludes them.',
      icon: ShieldCheck,
      component: ScopeValidatorPanel
    }
  ];

  let activeId = tabs[0].id;
  $: active = tabs.find((t) => t.id === activeId) ?? tabs[0];
</script>

<svelte:head>
  <title>Hunter Toolkit | HuntFlow</title>
  <meta
    name="description"
    content="Encoders, JWT decoder, hashing, random tokens, and an in-scope URL validator — all running locally in your browser."
  />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-6xl">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Utilities</p>
        <h1 class="hf-title">Hunter Toolkit</h1>
        <p class="hf-description">
          Stop alt-tabbing to CyberChef. Encoders, decoders, JWT and hash inspectors, random
          generators, and a real scope validator — all offline, all in one place.
        </p>
      </div>
    </header>

    <nav
      class="hf-card flex flex-wrap gap-2 p-2"
      aria-label="Toolkit sections"
      role="tablist"
    >
      {#each tabs as tab}
        {@const Icon = tab.icon}
        <button
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          aria-controls="tool-panel-{tab.id}"
          id="tool-tab-{tab.id}"
          class="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-[12px] px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 {activeId ===
          tab.id
            ? 'bg-primary/15 text-foreground shadow-inner-line'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
          on:click={() => (activeId = tab.id)}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      {/each}
    </nav>

    <section
      class="hf-card p-5"
      id="tool-panel-{active.id}"
      role="tabpanel"
      aria-labelledby="tool-tab-{active.id}"
    >
      <p class="mb-4 text-sm text-muted-foreground">{active.description}</p>
      <svelte:component this={active.component} />
    </section>
  </div>
</main>
