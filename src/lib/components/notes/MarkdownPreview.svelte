<script lang="ts">
  export let content = '';

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderInline(value: string): string {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function flushParagraph(lines: string[], html: string[]): void {
    if (lines.length === 0) return;
    html.push(`<p>${renderInline(lines.join(' '))}</p>`);
    lines.length = 0;
  }

  function flushList(items: string[], html: string[], ordered: boolean): void {
    if (items.length === 0) return;
    const tag = ordered ? 'ol' : 'ul';
    html.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
    items.length = 0;
  }

  function renderMarkdown(markdown: string): string {
    const html: string[] = [];
    const paragraph: string[] = [];
    const listItems: string[] = [];
    let orderedList = false;
    let inCodeBlock = false;
    let codeLines: string[] = [];

    for (const line of markdown.split('\n')) {
      if (line.trim().startsWith('```')) {
        flushParagraph(paragraph, html);
        flushList(listItems, html, orderedList);

        if (inCodeBlock) {
          html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph(paragraph, html);
        flushList(listItems, html, orderedList);
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (heading) {
        flushParagraph(paragraph, html);
        flushList(listItems, html, orderedList);
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }

      const quote = /^>\s?(.+)$/.exec(trimmed);
      if (quote) {
        flushParagraph(paragraph, html);
        flushList(listItems, html, orderedList);
        html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
        continue;
      }

      const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
      const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
      if (unordered || ordered) {
        const nextOrdered = Boolean(ordered);
        if (listItems.length > 0 && nextOrdered !== orderedList) {
          flushList(listItems, html, orderedList);
        }
        orderedList = nextOrdered;
        listItems.push((ordered ?? unordered)?.[1] ?? '');
        continue;
      }

      flushList(listItems, html, orderedList);
      paragraph.push(trimmed);
    }

    flushParagraph(paragraph, html);
    flushList(listItems, html, orderedList);
    if (inCodeBlock) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);

    return html.join('\n');
  }

  $: rendered = renderMarkdown(content);
</script>

<div class="markdown-preview min-h-[28rem] rounded-b-lg bg-slate-850 p-4 text-slate-100">
  {#if content.trim()}
    {@html rendered}
  {:else}
    <p class="text-sm text-slate-500">Nothing to preview yet.</p>
  {/if}
</div>

<style>
  :global(.markdown-preview h1),
  :global(.markdown-preview h2),
  :global(.markdown-preview h3) {
    border-bottom: 1px solid #334155;
    padding-bottom: 0.25rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  :global(.markdown-preview h1) {
    margin: 0 0 1rem;
    font-size: 1.875rem;
    line-height: 1.3;
  }

  :global(.markdown-preview h2) {
    margin: 1.25rem 0 0.75rem;
    font-size: 1.5rem;
    line-height: 1.4;
  }

  :global(.markdown-preview h3) {
    margin: 1rem 0 0.5rem;
    font-size: 1.25rem;
    line-height: 1.4;
  }

  :global(.markdown-preview p) {
    margin: 0.75rem 0;
    line-height: 1.5;
  }

  :global(.markdown-preview code) {
    border-radius: 0.25rem;
    background: #0f172a;
    padding: 0.125rem 0.375rem;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 0.875rem;
    color: #86efac;
  }

  :global(.markdown-preview pre) {
    overflow-x: auto;
    border: 1px solid #1e293b;
    border-radius: 0.5rem;
    background: #020617;
    padding: 1rem;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 0.875rem;
  }

  :global(.markdown-preview pre code) {
    background: transparent;
    padding: 0;
    color: #86efac;
  }

  :global(.markdown-preview ul) {
    list-style: disc;
    padding-left: 1.25rem;
  }

  :global(.markdown-preview ol) {
    list-style: decimal;
    padding-left: 1.25rem;
  }

  :global(.markdown-preview li + li) {
    margin-top: 0.25rem;
  }

  :global(.markdown-preview a) {
    color: #4ade80;
    text-decoration: underline;
  }

  :global(.markdown-preview blockquote) {
    border-left: 4px solid #475569;
    padding-left: 1rem;
    color: #94a3b8;
    font-style: italic;
  }
</style>
