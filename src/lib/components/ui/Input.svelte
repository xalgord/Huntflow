<script lang="ts" context="module">
  import type { ComponentType } from 'svelte';

  export interface InputProps {
    id?: string;
    name?: string;
    type?: string;
    value?: string;
    label?: string;
    placeholder?: string;
    error?: string;
    helper?: string;
    icon?: ComponentType;
    disabled?: boolean;
    required?: boolean;
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils';
  import { AlertCircle } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let id: InputProps['id'] = undefined;
  export let name: InputProps['name'] = undefined;
  export let type: InputProps['type'] = 'text';
  export let value = '';
  export let label = '';
  export let placeholder = '';
  export let error = '';
  export let helper = '';
  export let icon: InputProps['icon'] = undefined;
  export let disabled = false;
  export let required = false;

  const dispatch = createEventDispatcher<{ input: string; change: string }>();
  const generatedId = `input-${Math.random().toString(36).slice(2)}`;
  $: inputId = id ?? name ?? generatedId;
</script>

<label class="block" for={inputId}>
  {#if label}
    <span class="hf-label">{label}</span>
  {/if}
  <span class="relative mt-2 block">
    {#if icon}
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svelte:component this={icon} size={18} aria-hidden="true" />
      </span>
    {/if}
    <input
      id={inputId}
      {name}
      {type}
      {value}
      {placeholder}
      {disabled}
      {required}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error || helper ? `${inputId}-message` : undefined}
      class={cn(
        'hf-input',
        icon && 'pl-10',
        error && 'border-destructive ring-2 ring-destructive/20'
      )}
      on:input={(event) => {
        value = event.currentTarget.value;
        dispatch('input', value);
      }}
      on:change={() => dispatch('change', value)}
    />
  </span>
  {#if error}
    <span id={`${inputId}-message`} class="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
      <AlertCircle size={16} aria-hidden="true" />
      {error}
    </span>
  {:else if helper}
    <span id={`${inputId}-message`} class="mt-1 block text-xs text-muted-foreground">{helper}</span>
  {/if}
</label>
