<script lang="ts">
  import { renderMarkdownToHtml } from '$lib/utils/reports';

  export let markdown = '';
  export let title = 'Report preview';

  $: rendered = renderMarkdownToHtml(markdown);
</script>

<section class="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-dark-sm">
  <div class="flex min-h-[52px] items-center justify-between border-b border-slate-700 px-4">
    <h2 class="text-sm font-semibold text-slate-200">{title}</h2>
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">Markdown</span>
  </div>

  <article class="report-preview min-h-[32rem] overflow-auto bg-slate-850 p-5 text-slate-100">
    {#if markdown.trim()}
      {@html rendered}
    {:else}
      <p class="text-sm text-slate-500">Nothing to preview yet.</p>
    {/if}
  </article>
</section>

<style>
  :global(.report-preview h1),
  :global(.report-preview h2),
  :global(.report-preview h3),
  :global(.report-preview h4) {
    color: #f1f5f9;
    font-weight: 700;
    line-height: 1.35;
  }

  :global(.report-preview h1) {
    margin: 0 0 1.25rem;
    font-size: 1.875rem;
  }

  :global(.report-preview h2) {
    margin: 1.5rem 0 0.75rem;
    border-bottom: 1px solid #334155;
    padding-bottom: 0.35rem;
    font-size: 1.35rem;
  }

  :global(.report-preview h3) {
    margin: 1.25rem 0 0.5rem;
    font-size: 1.125rem;
  }

  :global(.report-preview h4) {
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
  }

  :global(.report-preview p) {
    margin: 0.75rem 0;
    line-height: 1.6;
  }

  :global(.report-preview code) {
    border-radius: 0.25rem;
    background: #0f172a;
    padding: 0.125rem 0.375rem;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 0.875rem;
    color: #86efac;
  }

  :global(.report-preview pre) {
    overflow-x: auto;
    border: 1px solid #1e293b;
    border-radius: 0.5rem;
    background: #020617;
    padding: 1rem;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 0.875rem;
  }

  :global(.report-preview pre code) {
    background: transparent;
    padding: 0;
  }

  :global(.report-preview ul) {
    list-style: disc;
    padding-left: 1.25rem;
  }

  :global(.report-preview ol) {
    list-style: decimal;
    padding-left: 1.25rem;
  }

  :global(.report-preview li + li) {
    margin-top: 0.25rem;
  }

  :global(.report-preview a) {
    color: #4ade80;
    text-decoration: underline;
  }

  :global(.report-preview blockquote) {
    margin: 1rem 0;
    border-left: 4px solid #475569;
    padding-left: 1rem;
    color: #94a3b8;
    font-style: italic;
  }
</style>
