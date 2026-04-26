<script lang="ts" context="module">
  export interface TextareaProps {
    id?: string;
    name?: string;
    value?: string;
    label?: string;
    placeholder?: string;
    error?: string;
    helper?: string;
    disabled?: boolean;
    required?: boolean;
    rows?: number;
    autoResize?: boolean;
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils';
  import { AlertCircle } from 'lucide-svelte';
  import { createEventDispatcher, onMount, tick } from 'svelte';

  export let id: TextareaProps['id'] = undefined;
  export let name: TextareaProps['name'] = undefined;
  export let value = '';
  export let label = '';
  export let placeholder = '';
  export let error = '';
  export let helper = '';
  export let disabled = false;
  export let required = false;
  export let rows = 4;
  export let autoResize = true;

  const dispatch = createEventDispatcher<{ input: string; change: string }>();
  let textarea: HTMLTextAreaElement;
  const generatedId = `textarea-${Math.random().toString(36).slice(2)}`;
  $: textareaId = id ?? name ?? generatedId;

  function resize(): void {
    if (!autoResize || !textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function handleInput(): void {
    resize();
    dispatch('input', value);
  }

  onMount(() => void tick().then(resize));
  $: if (value) void tick().then(resize);
</script>

<label class="block" for={textareaId}>
  {#if label}
    <span class="hf-label">{label}</span>
  {/if}
  <textarea
    bind:this={textarea}
    id={textareaId}
    {name}
    bind:value
    {placeholder}
    {disabled}
    {required}
    {rows}
    aria-invalid={error ? 'true' : 'false'}
    aria-describedby={error || helper ? `${textareaId}-message` : undefined}
    class={cn(
      'hf-input mt-2 min-h-[100px] resize-y',
      error && 'border-destructive ring-2 ring-destructive/20'
    )}
    on:input={handleInput}
    on:change={() => dispatch('change', value)}
  ></textarea>
  {#if error}
    <span id={`${textareaId}-message`} class="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
      <AlertCircle size={16} aria-hidden="true" />
      {error}
    </span>
  {:else if helper}
    <span id={`${textareaId}-message`} class="mt-1 block text-xs text-muted-foreground">{helper}</span>
  {/if}
</label>
