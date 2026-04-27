<script lang="ts">
  import { evaluateScope, parseScopeRules, type ScopeMatch } from '$lib/utils/scopeValidator';
  import { targetStore } from '$lib/stores';
  import type { Target } from '$lib/types';
  import { CheckCircle2, MinusCircle, ShieldCheck, ShieldX } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let selectedTargetId = '';
  let customScope = '';
  let urlsRaw = '';

  onMount(() => {
    void targetStore.load();
  });

  $: targets = $targetStore.filter((t: Target) => t.status !== 'archived');
  $: selectedTarget = targets.find((t) => t.id === selectedTargetId);

  // Resolve the active scope source: target's stored scope OR user-pasted custom.
  $: effectiveScope =
    selectedTarget && selectedTarget.scope ? selectedTarget.scope : customScope;
  $: rules = parseScopeRules(effectiveScope);
  $: urls = urlsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  $: results = urls.map((url) => ({ url, match: evaluateScope(url, rules) }));

  $: summary = results.reduce(
    (acc, r) => {
      acc[r.match.verdict] = (acc[r.match.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function verdictClass(match: ScopeMatch): string {
    if (match.verdict === 'in-scope') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    if (match.verdict === 'out-of-scope') return 'border-red-500/40 bg-red-500/10 text-red-200';
    return 'border-border/60 bg-muted/20 text-muted-foreground';
  }
</script>

<div class="space-y-4">
  <div class="grid gap-3 lg:grid-cols-2">
    <label class="block">
      <span class="hf-label">Target</span>
      <select bind:value={selectedTargetId} class="hf-select mt-2 w-full text-sm">
        <option value="">— Paste a custom scope —</option>
        {#each targets as target}
          <option value={target.id}>{target.name} ({target.platform})</option>
        {/each}
      </select>
      {#if selectedTarget}
        <p class="mt-1 text-xs text-muted-foreground">
          Using scope rules from <span class="font-medium text-foreground">{selectedTarget.name}</span>.
        </p>
      {/if}
    </label>

    <div class="flex items-end gap-3 text-xs">
      <span class="hf-pill">
        <ShieldCheck size={12} aria-hidden="true" />
        {summary['in-scope'] ?? 0} in-scope
      </span>
      <span class="hf-pill">
        <ShieldX size={12} aria-hidden="true" />
        {summary['out-of-scope'] ?? 0} out
      </span>
      <span class="hf-pill">
        <MinusCircle size={12} aria-hidden="true" />
        {summary['no-rules'] ?? 0} no rules
      </span>
    </div>
  </div>

  {#if !selectedTargetId}
    <label class="block">
      <span class="hf-label">Custom scope</span>
      <textarea
        bind:value={customScope}
        class="hf-input mt-2 min-h-[140px] font-mono text-xs leading-relaxed"
        placeholder={'+ *.example.com\n- admin.example.com\n+ api.example.com/v1/*\n- 10.0.0.0/8'}
        spellcheck="false"
      ></textarea>
      <p class="mt-1 text-xs text-muted-foreground">
        Lines starting with <code class="font-mono">+</code> include, <code class="font-mono">-</code> or
        <code class="font-mono">!</code> exclude. Wildcards, URL prefixes, and CIDR ranges supported.
      </p>
    </label>
  {/if}

  <label class="block">
    <span class="hf-label">URLs to validate (one per line)</span>
    <textarea
      bind:value={urlsRaw}
      class="hf-input mt-2 min-h-[140px] font-mono text-xs leading-relaxed"
      placeholder={'https://api.example.com/v1/users\nhttps://admin.example.com/login\n10.0.5.20'}
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
    ></textarea>
  </label>

  {#if rules.length === 0 && (selectedTarget || customScope.trim())}
    <p
      class="rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
    >
      No rules parsed from the active scope. Add at least one line.
    </p>
  {/if}

  {#if results.length > 0}
    <div class="space-y-2">
      {#each results as { url, match } (url)}
        <div
          class="flex flex-col gap-2 rounded-[14px] border px-3 py-2 sm:flex-row sm:items-center sm:gap-4 {verdictClass(
            match
          )}"
        >
          <div class="flex min-w-0 items-center gap-2">
            {#if match.verdict === 'in-scope'}
              <CheckCircle2 size={16} aria-hidden="true" />
            {:else if match.verdict === 'out-of-scope'}
              <ShieldX size={16} aria-hidden="true" />
            {:else}
              <MinusCircle size={16} aria-hidden="true" />
            {/if}
            <code class="truncate font-mono text-xs">{url}</code>
          </div>
          <div class="ml-6 text-[11px] sm:ml-auto sm:text-right">
            {#if match.matchedRule}
              <span class="font-mono">{match.matchedRule.raw}</span>
            {:else}
              {match.reason}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
