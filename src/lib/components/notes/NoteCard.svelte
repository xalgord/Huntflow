<script lang="ts">
  import type { Note, NoteTemplate, Target } from '$lib/types';
  import { ChevronRight, FileText, Tag } from 'lucide-svelte';

  export let note: Note;
  export let target: Target | undefined;
  export let template: NoteTemplate | undefined;

  function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(timestamp));
  }

  $: excerpt = note.content
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/[#>*_`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
</script>

<a
  href={`/notes/${note.id}`}
  class="hf-card hf-interactive group block p-4 active:scale-[0.99]"
>
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <FileText class="shrink-0 text-primary" size={18} aria-hidden="true" />
        <h2 class="truncate text-lg font-semibold text-foreground">{note.title}</h2>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">{target?.name ?? 'Missing target'}</p>
    </div>
    <ChevronRight class="mt-1 shrink-0 text-muted-foreground transition group-hover:text-primary" size={20} />
  </div>

  <p class="mt-4 min-h-[42px] text-sm leading-6 text-muted-foreground">
    {excerpt || 'No content yet.'}
  </p>

  <div class="mt-4 flex flex-wrap items-center gap-2">
    {#if template}
      <span class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {template.name}
      </span>
    {/if}
    {#each note.tags.slice(0, 4) as tagName}
      <span class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        <Tag size={12} aria-hidden="true" />
        {tagName}
      </span>
    {/each}
  </div>

  <p class="mt-4 text-xs text-muted-foreground">Updated {formatDate(note.updatedAt)}</p>
</a>
