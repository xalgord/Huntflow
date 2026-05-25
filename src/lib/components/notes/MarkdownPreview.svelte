<script lang="ts">
  import { evidenceAssetStore } from '$lib/stores';
  import EvidenceReferenceTile from './EvidenceReferenceTile.svelte';

  export let content = '';

  /**
   * Per-render counter for code blocks so each preview gets stable
   * `data-code-id` attributes the post-render handler can use to wire
   * up "copy" buttons on click.
   */
  let codeBlockSeq = 0;

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Inline tokens. Order matters: handle code spans first (so their
   * contents aren't further parsed), then emphasis, then references.
   * `[[evidence:id]]` is a placeholder we replace with a typed marker
   * the Svelte template can swap for the EvidenceReferenceTile component.
   */
  function renderInline(value: string): string {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\[\[evidence:([a-zA-Z0-9_-]+)\]\]/g, '<span data-evidence-ref="$1"></span>');
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

  /**
   * Render a fenced code block with a header showing the language and
   * a copy button. The HTML carries `data-code-id` so the post-render
   * effect can attach a click handler that copies the raw source.
   */
  function renderCodeBlock(language: string, source: string): string {
    codeBlockSeq += 1;
    const id = String(codeBlockSeq);
    const langLabel = language.trim() || 'text';
    return `<div class="code-block" data-code-id="${id}">
      <div class="code-block__header">
        <span class="code-block__lang">${escapeHtml(langLabel)}</span>
        <button type="button" class="code-block__copy" data-copy-for="${id}" aria-label="Copy code to clipboard">Copy</button>
      </div>
      <pre><code data-code-source="${id}">${escapeHtml(source)}</code></pre>
    </div>`;
  }

  function renderMarkdown(markdown: string): string {
    codeBlockSeq = 0;
    const html: string[] = [];
    const paragraph: string[] = [];
    const listItems: string[] = [];
    let orderedList = false;
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];

    for (const line of markdown.split('\n')) {
      const fence = /^```(.*)$/.exec(line.trim());
      if (fence) {
        flushParagraph(paragraph, html);
        flushList(listItems, html, orderedList);

        if (inCodeBlock) {
          html.push(renderCodeBlock(codeLanguage, codeLines.join('\n')));
          codeLines = [];
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = fence[1] ?? '';
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
    if (inCodeBlock) html.push(renderCodeBlock(codeLanguage, codeLines.join('\n')));

    return html.join('\n');
  }

  $: rendered = renderMarkdown(content);

  /**
   * After the HTML is mounted, find every `[[evidence:id]]` placeholder
   * and replace it with a hydrated tile referencing the live evidence
   * asset. Re-runs whenever the rendered content or store changes so
   * deletions / new captures stay in sync.
   */
  let host: HTMLDivElement | undefined;

  type ResolvedRef = {
    target: HTMLSpanElement;
    id: string;
  };

  $: resolved = (() => {
    if (!host) return [] as ResolvedRef[];
    const placeholders = host.querySelectorAll<HTMLSpanElement>('[data-evidence-ref]');
    return Array.from(placeholders).map((target) => ({
      target,
      id: target.dataset.evidenceRef ?? ''
    }));
  })();

  $: assetMap = new Map($evidenceAssetStore.map((asset) => [asset.id, asset]));

  // Mount tile components imperatively. We do this rather than use a
  // Svelte each-block because the tiles need to land at arbitrary
  // positions inside the rendered HTML string. The post-render hook
  // hydrates each placeholder with a real component and tears down on
  // change so we don't leak component instances.
  let mounted: Array<{ destroy: () => void }> = [];

  $: if (host) {
    for (const m of mounted) m.destroy();
    mounted = [];
    void rendered;
    queueMicrotask(() => {
      if (!host) return;
      const placeholders = host.querySelectorAll<HTMLSpanElement>('[data-evidence-ref]');
      placeholders.forEach((node) => {
        const id = node.dataset.evidenceRef ?? '';
        const asset = assetMap.get(id);
        const wrapper = document.createElement('span');
        wrapper.className = 'evidence-ref-mount';
        node.replaceWith(wrapper);
        const instance = new EvidenceReferenceTile({
          target: wrapper,
          props: { evidenceId: id, asset }
        });
        mounted.push(instance as unknown as { destroy: () => void });
      });

      // Wire copy-to-clipboard on every code-block "Copy" button.
      const buttons = host.querySelectorAll<HTMLButtonElement>('.code-block__copy');
      buttons.forEach((button) => {
        const codeId = button.dataset.copyFor ?? '';
        const codeNode = host?.querySelector<HTMLElement>(`[data-code-source="${codeId}"]`);
        button.onclick = async () => {
          if (!codeNode) return;
          const original = button.textContent;
          try {
            await navigator.clipboard.writeText(codeNode.textContent ?? '');
            button.textContent = 'Copied';
          } catch {
            button.textContent = 'Failed';
          }
          setTimeout(() => {
            if (button.textContent !== original) button.textContent = original;
          }, 1400);
        };
      });
    });
  }

  import { onDestroy } from 'svelte';
  onDestroy(() => {
    for (const m of mounted) m.destroy();
    mounted = [];
  });
</script>

<div bind:this={host} class="markdown-preview min-h-[28rem] rounded-b-lg bg-zinc-850 p-4 text-zinc-100">
  {#if content.trim()}
    {@html rendered}
  {:else}
    <p class="text-sm text-zinc-500">Nothing to preview yet.</p>
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

  :global(.markdown-preview .code-block) {
    margin: 1rem 0;
    overflow: hidden;
    border-radius: 0.5rem;
    border: 1px solid #1e293b;
    background: #020617;
  }

  :global(.markdown-preview .code-block__header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #1e293b;
    padding: 0.375rem 0.75rem;
    background: #0b1224;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 0.75rem;
    text-transform: lowercase;
    color: #94a3b8;
  }

  :global(.markdown-preview .code-block__lang) {
    letter-spacing: 0.04em;
  }

  :global(.markdown-preview .code-block__copy) {
    cursor: pointer;
    border-radius: 0.25rem;
    border: 1px solid transparent;
    background: transparent;
    padding: 0.125rem 0.5rem;
    font: inherit;
    color: #cbd5e1;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  :global(.markdown-preview .code-block__copy:hover) {
    border-color: #334155;
    background: #0f172a;
    color: #f1f5f9;
  }

  :global(.markdown-preview .code-block pre) {
    margin: 0;
    overflow-x: auto;
    border-radius: 0;
    border: none;
    background: transparent;
    padding: 1rem;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 0.875rem;
  }

  :global(.markdown-preview .code-block pre code) {
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

  :global(.markdown-preview .evidence-ref-mount) {
    display: inline-block;
    vertical-align: middle;
  }
</style>
