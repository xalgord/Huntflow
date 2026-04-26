<script lang="ts" context="module">
  export type ToolbarAction =
    | 'bold'
    | 'italic'
    | 'inline-code'
    | 'code-block'
    | 'link'
    | 'bullet-list'
    | 'numbered-list';
</script>

<script lang="ts">
  import { Bold, Code, FileCode2, Italic, Link, List, ListOrdered } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ action: ToolbarAction }>();

  const actions: { id: ToolbarAction; label: string; icon: typeof Bold }[] = [
    { id: 'bold', label: 'Bold', icon: Bold },
    { id: 'italic', label: 'Italic', icon: Italic },
    { id: 'inline-code', label: 'Inline code', icon: Code },
    { id: 'code-block', label: 'Code block', icon: FileCode2 },
    { id: 'link', label: 'Link', icon: Link },
    { id: 'bullet-list', label: 'Bullet list', icon: List },
    { id: 'numbered-list', label: 'Numbered list', icon: ListOrdered }
  ];
</script>

<div class="flex flex-wrap gap-1 border-b border-slate-700 bg-slate-850 p-2" aria-label="Markdown toolbar">
  {#each actions as action}
    <button
      type="button"
      class="inline-flex h-10 min-h-[40px] w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 active:bg-slate-900"
      title={action.label}
      aria-label={action.label}
      on:click={() => dispatch('action', action.id)}
    >
      <svelte:component this={action.icon} size={18} aria-hidden="true" />
    </button>
  {/each}
</div>
