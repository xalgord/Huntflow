<script lang="ts">
  /** A textarea that grows with its content, like Apple Notes. */
  import { onMount, tick } from 'svelte';

  export let value = '';
  export let placeholder = '';
  export let label = '';
  export let id: string | undefined = undefined;
  export let minRows = 3;
  export let mono = false;
  export let className = '';

  let element: HTMLTextAreaElement;

  async function resize(): Promise<void> {
    await tick();
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }

  $: value, void resize();
  onMount(() => void resize());
</script>

<textarea
  bind:this={element}
  bind:value
  {id}
  {placeholder}
  aria-label={label || undefined}
  rows={minRows}
  spellcheck="true"
  class="hf-input block w-full resize-none overflow-hidden leading-6 {mono ? 'font-mono text-[0.78rem]' : ''} {className}"
  on:input
  on:blur
  on:paste
></textarea>
