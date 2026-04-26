<script lang="ts">
  import type { Platform, Priority, Target } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let target: Target | undefined = undefined;
  export let submitLabel = 'Save Target';

  const dispatch = createEventDispatcher<{
    submit: { target: Target };
    cancel: void;
  }>();

  const platforms: { label: string; value: Platform }[] = [
    { label: 'HackerOne', value: 'hackerone' },
    { label: 'Bugcrowd', value: 'bugcrowd' },
    { label: 'Intigriti', value: 'intigriti' },
    { label: 'Synack', value: 'synack' },
    { label: 'YesWeHack', value: 'yeswehack' },
    { label: 'Self-hosted', value: 'self-hosted' },
    { label: 'Other', value: 'other' }
  ];

  let loadedTargetId = '';
  let name = '';
  let platform: Platform = 'hackerone';
  let programUrl = '';
  let scope = '';
  let notes = '';
  let priority: Priority = 2;
  let errors: Record<string, string> = {};

  $: if ((target?.id ?? '') !== loadedTargetId) {
    loadedTargetId = target?.id ?? '';
    name = target?.name ?? '';
    platform = target?.platform ?? 'hackerone';
    programUrl = target?.programUrl ?? '';
    scope = target?.scope ?? '';
    notes = target?.notes ?? '';
    priority = target?.priority ?? 2;
    errors = {};
  }

  function isValidUrl(value: string): boolean {
    if (!value.trim()) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (name.trim().length > 100) nextErrors.name = 'Name must be 100 characters or fewer';
    if (!isValidUrl(programUrl)) nextErrors.programUrl = 'Enter a valid URL';
    if (scope.length > 5000) nextErrors.scope = 'Scope must be 5000 characters or fewer';
    if (notes.length > 10000) nextErrors.notes = 'Notes must be 10000 characters or fewer';
    errors = nextErrors;
    return Object.keys(nextErrors).length === 0;
  }

  function submit() {
    if (!validate()) return;

    const now = Date.now();
    dispatch('submit', {
      target: {
        id: target?.id ?? crypto.randomUUID(),
        name: name.trim(),
        platform,
        programUrl: programUrl.trim() || undefined,
        scope,
        notes,
        priority,
        status: target?.status ?? 'recon',
        createdAt: target?.createdAt ?? now,
        updatedAt: now,
        lastSessionAt: target?.lastSessionAt,
        sessionCount: target?.sessionCount ?? 0
      }
    });
  }
</script>

<form class="grid gap-4" on:submit|preventDefault={submit}>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="hf-label">Name</span>
      <input
        bind:value={name}
        class="mt-2 w-full rounded-md border bg-slate-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 {errors.name
          ? 'border-red-500 ring-1 ring-red-500/50'
          : 'border-slate-600'}"
        placeholder="Example Corp"
      />
      {#if errors.name}<span class="mt-1 block text-xs text-red-400">{errors.name}</span>{/if}
    </label>

    <label class="block">
      <span class="hf-label">Platform</span>
      <select
        bind:value={platform}
        class="hf-select mt-2"
      >
        {#each platforms as item}
          <option value={item.value}>{item.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="grid gap-4 sm:grid-cols-[1fr_160px]">
    <label class="block">
      <span class="hf-label">Program URL</span>
      <input
        bind:value={programUrl}
        class="mt-2 w-full rounded-md border bg-slate-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 {errors.programUrl
          ? 'border-red-500 ring-1 ring-red-500/50'
          : 'border-slate-600'}"
        placeholder="https://hackerone.com/example"
      />
      {#if errors.programUrl}<span class="mt-1 block text-xs text-red-400">{errors.programUrl}</span>{/if}
    </label>

    <label class="block">
      <span class="hf-label">Priority</span>
      <select
        bind:value={priority}
        class="hf-select mt-2"
      >
        <option value={0}>P0 Critical</option>
        <option value={1}>P1 High</option>
        <option value={2}>P2 Medium</option>
        <option value={3}>P3 Low</option>
      </select>
    </label>
  </div>

  <label class="block">
    <span class="hf-label">Scope</span>
    <textarea
      bind:value={scope}
      class="mt-2 min-h-[120px] w-full resize-y rounded-md border bg-slate-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 {errors.scope
        ? 'border-red-500 ring-1 ring-red-500/50'
        : 'border-slate-600'}"
      placeholder="*.example.com&#10;api.example.com"
    />
    {#if errors.scope}<span class="mt-1 block text-xs text-red-400">{errors.scope}</span>{/if}
  </label>

  <label class="block">
    <span class="hf-label">Notes</span>
    <textarea
      bind:value={notes}
      class="mt-2 min-h-[120px] w-full resize-y rounded-md border bg-slate-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 {errors.notes
        ? 'border-red-500 ring-1 ring-red-500/50'
        : 'border-slate-600'}"
      placeholder="Program notes"
    />
    {#if errors.notes}<span class="mt-1 block text-xs text-red-400">{errors.notes}</span>{/if}
  </label>

  <div class="flex flex-wrap justify-end gap-3">
    <button
      type="button"
      class="min-h-[44px] rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
      on:click={() => dispatch('cancel')}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="min-h-[44px] rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
    >
      {submitLabel}
    </button>
  </div>
</form>
