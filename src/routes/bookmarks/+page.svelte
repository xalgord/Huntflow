<script lang="ts">
  import { bookmarkStore } from '$lib/stores';
  import type { Bookmark, BookmarkCategory, PayloadCategory } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import {
    BookOpen,
    BookmarkPlus,
    ExternalLink,
    Pencil,
    Plus,
    Search,
    Trash2,
    X
  } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type CategoryFilter = BookmarkCategory | 'all';

  const categoryOptions: { value: BookmarkCategory; label: string }[] = [
    { value: 'writeup', label: 'Writeup' },
    { value: 'cve', label: 'CVE' },
    { value: 'tool', label: 'Tool' },
    { value: 'docs', label: 'Docs' },
    { value: 'cheatsheet', label: 'Cheatsheet' },
    { value: 'video', label: 'Video' },
    { value: 'paper', label: 'Paper' },
    { value: 'blog', label: 'Blog' },
    { value: 'other', label: 'Other' }
  ];

  const vulnClassOptions: { value: PayloadCategory; label: string }[] = [
    { value: 'xss', label: 'XSS' },
    { value: 'sqli', label: 'SQL Injection' },
    { value: 'ssrf', label: 'SSRF' },
    { value: 'xxe', label: 'XXE' },
    { value: 'ssti', label: 'SSTI' },
    { value: 'lfi', label: 'LFI' },
    { value: 'rce', label: 'RCE' },
    { value: 'cmd-injection', label: 'Cmd Injection' },
    { value: 'auth-bypass', label: 'Auth Bypass' },
    { value: 'open-redirect', label: 'Open Redirect' },
    { value: 'idor', label: 'IDOR' },
    { value: 'csrf', label: 'CSRF' },
    { value: 'deserialization', label: 'Deserialization' },
    { value: 'graphql', label: 'GraphQL' },
    { value: 'jwt', label: 'JWT' },
    { value: 'header-injection', label: 'Header Injection' },
    { value: 'race-condition', label: 'Race Condition' },
    { value: 'recon', label: 'Recon' },
    { value: 'wordlist', label: 'Wordlist' },
    { value: 'other', label: 'Other' }
  ];

  let query = '';
  let categoryFilter: CategoryFilter = 'all';
  let showForm = false;
  let editing: Bookmark | null = null;

  let formTitle = '';
  let formUrl = '';
  let formCategory: BookmarkCategory = 'writeup';
  let formVulnClass: PayloadCategory | '' = '';
  let formDescription = '';
  let formTags = '';
  let formError = '';

  onMount(async () => {
    // bookmarkStore.load() seeds the built-in library on first run automatically.
    await bookmarkStore.load();
  });

  $: filtered = $bookmarkStore
    .filter((bookmark) => {
      if (categoryFilter !== 'all' && bookmark.category !== categoryFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return (
        bookmark.title.toLowerCase().includes(search) ||
        bookmark.url.toLowerCase().includes(search) ||
        (bookmark.description ?? '').toLowerCase().includes(search) ||
        (bookmark.vulnClass ?? '').toLowerCase().includes(search) ||
        bookmark.tags.some((tag) => tag.includes(search))
      );
    })
    .sort((a, b) => {
      if (a.isBuiltIn !== b.isBuiltIn) return a.isBuiltIn ? 1 : -1;
      return b.updatedAt - a.updatedAt;
    });

  $: counts = $bookmarkStore.reduce<Record<string, number>>((acc, bookmark) => {
    acc[bookmark.category] = (acc[bookmark.category] ?? 0) + 1;
    acc.all = (acc.all ?? 0) + 1;
    return acc;
  }, {});

  function categoryBadge(category: BookmarkCategory): string {
    const map: Record<BookmarkCategory, string> = {
      writeup: 'border-primary/30 bg-primary/10 text-primary',
      cve: 'border-red-500/30 bg-red-500/15 text-red-300',
      tool: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
      docs: 'border-slate-500/30 bg-slate-700/30 text-slate-300',
      cheatsheet: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300',
      video: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
      paper: 'border-purple-500/30 bg-purple-500/15 text-purple-300',
      blog: 'border-teal-500/30 bg-teal-500/15 text-teal-300',
      other: 'border-slate-500/30 bg-slate-700/30 text-slate-300'
    };
    return map[category] ?? map.other;
  }

  function startCreate(): void {
    editing = null;
    formTitle = '';
    formUrl = '';
    formCategory = 'writeup';
    formVulnClass = '';
    formDescription = '';
    formTags = '';
    formError = '';
    showForm = true;
  }

  function startEdit(bookmark: Bookmark): void {
    editing = bookmark;
    formTitle = bookmark.title;
    formUrl = bookmark.url;
    formCategory = bookmark.category;
    formVulnClass = bookmark.vulnClass ?? '';
    formDescription = bookmark.description ?? '';
    formTags = bookmark.tags.join(', ');
    formError = '';
    showForm = true;
  }

  async function saveBookmark(event: Event): Promise<void> {
    event.preventDefault();
    formError = '';

    if (!formTitle.trim() || !formUrl.trim()) {
      formError = 'Title and URL are required';
      return;
    }

    try {
      new URL(formUrl);
    } catch {
      formError = 'Provide a valid URL';
      return;
    }

    const now = Date.now();
    const tags = formTags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    const bookmark: Bookmark = {
      id: editing?.id ?? generateId(),
      title: formTitle.trim(),
      url: formUrl.trim(),
      category: formCategory,
      vulnClass: formVulnClass || undefined,
      description: formDescription.trim() || undefined,
      tags,
      isBuiltIn: editing?.isBuiltIn ?? false,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now
    };

    await bookmarkStore.put(bookmark);
    await bookmarkStore.persistNow();
    showForm = false;
    editing = null;
  }

  async function deleteBookmark(bookmark: Bookmark): Promise<void> {
    if (!confirm(`Delete "${bookmark.title}"?`)) return;
    await bookmarkStore.delete(bookmark.id);
    await bookmarkStore.persistNow();
  }

  function hostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
</script>

<svelte:head>
  <title>Bookmarks | HuntFlow</title>
  <meta name="description" content="Personal library of writeups, CVEs, tools, cheatsheets, and references for bug bounty hunting." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Knowledge base</p>
        <h1 class="hf-title">Bookmarks</h1>
        <p class="hf-description">
          Writeups, CVEs, tools, cheatsheets, and references organised by vuln class.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={startCreate}>
        <Plus size={20} aria-hidden="true" />
        Add Bookmark
      </button>
    </header>

    <section class="hf-card flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
      <label class="block flex-1">
        <span class="hf-label">Search</span>
        <span class="relative mt-2 block">
          <Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input bind:value={query} class="hf-input pl-9" placeholder="Title, URL, tag, vuln class" />
        </span>
      </label>

      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-medium transition {categoryFilter === 'all'
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'}"
          on:click={() => (categoryFilter = 'all')}
        >
          All ({counts.all ?? 0})
        </button>
        {#each categoryOptions as option}
          <button
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition {categoryFilter === option.value
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'}"
            on:click={() => (categoryFilter = option.value)}
          >
            {option.label} ({counts[option.value] ?? 0})
          </button>
        {/each}
      </div>
    </section>

    {#if showForm}
      <section class="hf-card p-4">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-100">{editing ? 'Edit Bookmark' : 'New Bookmark'}</h2>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-100"
            on:click={() => (showForm = false)}
            aria-label="Close form"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form class="space-y-4" on:submit={saveBookmark}>
          <label class="block">
            <span class="hf-label">Title</span>
            <input bind:value={formTitle} class="hf-input mt-2" maxlength="200" required />
          </label>

          <label class="block">
            <span class="hf-label">URL</span>
            <input bind:value={formUrl} type="url" class="hf-input mt-2" required />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="hf-label">Category</span>
              <select bind:value={formCategory} class="hf-select mt-2">
                {#each categoryOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>

            <label class="block">
              <span class="hf-label">Vuln class</span>
              <select bind:value={formVulnClass} class="hf-select mt-2">
                <option value="">— None —</option>
                {#each vulnClassOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
          </div>

          <label class="block">
            <span class="hf-label">Tags</span>
            <input bind:value={formTags} class="hf-input mt-2" placeholder="comma, separated" />
          </label>

          <label class="block">
            <span class="hf-label">Description</span>
            <textarea
              bind:value={formDescription}
              rows={2}
              class="mt-2 min-h-[80px] w-full resize-y rounded-md border border-slate-600 bg-slate-850 px-3 py-2.5 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
            ></textarea>
          </label>

          {#if formError}
            <p class="text-sm text-red-400" role="alert">{formError}</p>
          {/if}

          <div class="flex justify-end gap-2">
            <button type="button" class="hf-button-secondary" on:click={() => (showForm = false)}>Cancel</button>
            <button type="submit" class="hf-button-primary">{editing ? 'Save' : 'Add Bookmark'}</button>
          </div>
        </form>
      </section>
    {/if}

    {#if filtered.length > 0}
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each filtered as bookmark (bookmark.id)}
          <article class="hf-card flex flex-col gap-3 p-4">
            <div class="flex items-start justify-between gap-2">
              <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide {categoryBadge(bookmark.category)}">
                {bookmark.category}
              </span>
              <div class="flex items-center gap-1">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700 hover:text-primary"
                  aria-label="Open"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
                {#if !bookmark.isBuiltIn}
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700 hover:text-slate-100"
                    aria-label="Edit"
                    on:click={() => startEdit(bookmark)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
                    aria-label="Delete"
                    on:click={() => deleteBookmark(bookmark)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                {/if}
              </div>
            </div>

            <a
              href={bookmark.url}
              target="_blank"
              rel="noreferrer"
              class="block text-sm font-semibold text-slate-100 transition hover:text-primary"
            >
              {bookmark.title}
            </a>

            <p class="truncate text-xs text-slate-500" title={bookmark.url}>{hostname(bookmark.url)}</p>

            {#if bookmark.description}
              <p class="text-xs text-slate-400 line-clamp-3">{bookmark.description}</p>
            {/if}

            {#if bookmark.tags.length > 0 || bookmark.vulnClass}
              <div class="mt-auto flex flex-wrap gap-1">
                {#if bookmark.vulnClass}
                  <span class="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    {bookmark.vulnClass}
                  </span>
                {/if}
                {#each bookmark.tags as tag}
                  <span class="rounded-md border border-slate-700 bg-slate-850 px-1.5 py-0.5 text-[11px] text-slate-400">{tag}</span>
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      </section>
    {:else}
      <section class="hf-card p-8 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-slate-600">
          <BookOpen size={28} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-slate-300">No bookmarks match</h2>
        <p class="mt-2 text-sm text-slate-500">Adjust the filter or add a new bookmark.</p>
        <button type="button" class="mt-5 hf-button-primary" on:click={startCreate}>
          <BookmarkPlus size={20} aria-hidden="true" />
          Add Bookmark
        </button>
      </section>
    {/if}
  </div>
</main>
