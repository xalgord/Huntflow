<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import {
    bookmarkStore,
    checklistInstanceStore,
    evidenceAssetStore,
    noteStore,
    payloadStore,
    reconAssetStore,
    settingsStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { navItems } from '$lib/components/layout/navItems';
  import { fuzzyMatch } from '$lib/utils/fuzzy';
  import {
    BookMarked,
    Crosshair,
    FileText,
    Flag,
    LayoutDashboard,
    ListChecks,
    Network,
    Plus,
    Send,
    Settings as SettingsIcon,
    Sword,
    Timer as TimerIcon,
    Sparkles,
    Search
  } from 'lucide-svelte';
  import { onMount, tick } from 'svelte';

  type IconComponent = typeof Search;

  interface CommandItem {
    id: string;
    section: 'Navigate' | 'Actions' | 'Targets' | 'Notes' | 'Payloads' | 'Submissions' | 'Recon' | 'Evidence' | 'Bookmarks' | 'Checklists';
    title: string;
    subtitle?: string;
    icon: IconComponent;
    keywords?: string;
    href?: string;
    perform?: () => void | Promise<void>;
  }

  interface ScoredItem extends CommandItem {
    score: number;
    matchIndexes: number[];
  }

  const RECENT_KEY = 'huntflow:cmdk-recent';
  const RECENT_MAX = 8;

  let query = '';
  let activeIndex = 0;
  let inputEl: HTMLInputElement | undefined;
  let listEl: HTMLDivElement | undefined;
  let recentIds: string[] = [];

  $: open = $commandPaletteStore.open;

  // Hydrate recent ids on first mount
  onMount(() => {
    if (!browser) return;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) recentIds = JSON.parse(raw) as string[];
    } catch {
      recentIds = [];
    }
  });

  // When the palette opens, focus the input and seed the query
  $: if (open && browser) {
    query = $commandPaletteStore.initialQuery;
    activeIndex = 0;
    void tick().then(() => inputEl?.focus());
  }

  function rememberRecent(id: string): void {
    if (!browser) return;
    recentIds = [id, ...recentIds.filter((r) => r !== id)].slice(0, RECENT_MAX);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds));
    } catch {
      /* ignore quota */
    }
  }

  function close(): void {
    commandPaletteStore.close();
    query = '';
  }

  async function execute(item: CommandItem): Promise<void> {
    rememberRecent(item.id);
    close();
    if (item.perform) {
      await item.perform();
    } else if (item.href) {
      await goto(item.href);
    }
  }

  // ─── Static actions ───────────────────────────────────────────────────────
  function buildActions(): CommandItem[] {
    return [
      {
        id: 'action:start-hunt',
        section: 'Actions',
        title: 'Start hunting session',
        subtitle: 'Open the focus timer',
        icon: TimerIcon,
        keywords: 'pomodoro focus session start',
        href: '/timer'
      },
      {
        id: 'action:new-target',
        section: 'Actions',
        title: 'Create new target',
        subtitle: 'Add a program to your queue',
        icon: Plus,
        keywords: 'add program platform create',
        href: '/targets?new=1'
      },
      {
        id: 'action:new-note',
        section: 'Actions',
        title: 'Create new note',
        subtitle: 'Capture findings or methodology',
        icon: Plus,
        keywords: 'add write capture',
        href: '/notes?new=1'
      },
      {
        id: 'action:new-submission',
        section: 'Actions',
        title: 'Log new submission',
        subtitle: 'Track a report through triage',
        icon: Send,
        keywords: 'add report triage hackerone',
        href: '/submissions?new=1'
      },
      {
        id: 'action:new-payout',
        section: 'Actions',
        title: 'Log new payout',
        subtitle: 'Record a bounty you earned',
        icon: Plus,
        keywords: 'income bounty money paid',
        href: '/income?new=1'
      },
      {
        id: 'action:toggle-theme',
        section: 'Actions',
        title:
          $settingsStore.theme === 'dark'
            ? 'Switch to light theme'
            : $settingsStore.theme === 'light'
              ? 'Match system theme'
              : 'Switch to dark theme',
        subtitle: `Currently: ${$settingsStore.theme}`,
        icon: Sparkles,
        keywords: 'theme dark light system color mode',
        perform: () => {
          const next: 'light' | 'dark' | 'system' =
            $settingsStore.theme === 'dark'
              ? 'light'
              : $settingsStore.theme === 'light'
                ? 'system'
                : 'dark';
          void settingsStore.update((s) => ({ ...s, theme: next }));
        }
      },
      {
        id: 'action:settings',
        section: 'Actions',
        title: 'Open settings',
        icon: SettingsIcon,
        keywords: 'preferences config sync export',
        href: '/settings'
      }
    ];
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  function buildNavigation(): CommandItem[] {
    const iconForHref = new Map<string, IconComponent>([
      ['/', LayoutDashboard],
      ['/timer', Crosshair],
      ['/targets', Flag],
      ['/payloads', Sword],
      ['/notes', FileText],
      ['/submissions', Send],
      ['/income', Plus],
      ['/assets', Network],
      ['/bookmarks', BookMarked],
      ['/settings', SettingsIcon],
      ['/stats', Sparkles]
    ]);
    const items: CommandItem[] = navItems.map((nav) => ({
      id: `nav:${nav.href}`,
      section: 'Navigate',
      title: `Go to ${nav.label}`,
      icon: iconForHref.get(nav.href) ?? Search,
      keywords: nav.label.toLowerCase(),
      href: nav.href
    }));
    items.push({
      id: 'nav:/stats',
      section: 'Navigate',
      title: 'Go to Stats',
      icon: Sparkles,
      keywords: 'analytics charts streak',
      href: '/stats'
    });
    items.push({
      id: 'nav:/income',
      section: 'Navigate',
      title: 'Go to Income',
      icon: Plus,
      keywords: 'bounty payout money paid earnings',
      href: '/income'
    });
    return items;
  }

  // ─── Build the universe of commands reactively ────────────────────────────
  $: items = (() => {
    const list: CommandItem[] = [...buildActions(), ...buildNavigation()];

    for (const target of $targetStore) {
      list.push({
        id: `target:${target.id}`,
        section: 'Targets',
        title: target.name,
        subtitle: `${target.platform} · ${target.status} · P${target.priority}`,
        icon: Flag,
        keywords: `${target.platform} ${target.status} ${target.notes ?? ''}`,
        href: `/targets/${target.id}`
      });
    }

    for (const note of $noteStore) {
      list.push({
        id: `note:${note.id}`,
        section: 'Notes',
        title: note.title || 'Untitled note',
        subtitle: note.content.slice(0, 80).replace(/\s+/g, ' ').trim(),
        icon: FileText,
        keywords: (note.tags ?? []).join(' '),
        href: `/notes/${note.id}`
      });
    }

    for (const payload of $payloadStore) {
      list.push({
        id: `payload:${payload.id}`,
        section: 'Payloads',
        title: payload.name,
        subtitle: `${payload.category}${payload.context ? ` · ${payload.context}` : ''}`,
        icon: Sword,
        keywords: `${payload.category} ${(payload.tags ?? []).join(' ')} ${payload.payload.slice(0, 80)}`,
        href: `/payloads?id=${payload.id}`
      });
    }

    for (const submission of $submissionStore) {
      list.push({
        id: `submission:${submission.id}`,
        section: 'Submissions',
        title: submission.title,
        subtitle: `${submission.status} · ${submission.severity}`,
        icon: Send,
        keywords: `${submission.platform} ${submission.vulnerabilityType ?? ''} ${(submission.tags ?? []).join(' ')}`,
        href: `/submissions?id=${submission.id}`
      });
    }

    for (const asset of $reconAssetStore) {
      list.push({
        id: `recon:${asset.id}`,
        section: 'Recon',
        title: asset.hostname,
        subtitle: asset.title || asset.url || asset.ipAddress || asset.status,
        icon: Network,
        keywords: `${asset.status} ${asset.technologies.join(' ')} ${asset.notes ?? ''}`,
        href: `/targets/${asset.targetId}/recon?focus=${asset.id}`
      });
    }

    for (const evidence of $evidenceAssetStore) {
      list.push({
        id: `evidence:${evidence.id}`,
        section: 'Evidence',
        title: evidence.title,
        subtitle: `${evidence.kind} · ${evidence.fileName ?? evidence.mimeType}`,
        icon: Network,
        keywords: (evidence.tags ?? []).join(' '),
        href: `/assets?id=${evidence.id}`
      });
    }

    for (const bookmark of $bookmarkStore) {
      list.push({
        id: `bookmark:${bookmark.id}`,
        section: 'Bookmarks',
        title: bookmark.title,
        subtitle: bookmark.url,
        icon: BookMarked,
        keywords: `${bookmark.category} ${(bookmark.tags ?? []).join(' ')} ${bookmark.description ?? ''}`,
        perform: () => {
          if (browser) window.open(bookmark.url, '_blank', 'noopener,noreferrer');
        }
      });
    }

    for (const checklist of $checklistInstanceStore) {
      list.push({
        id: `checklist:${checklist.id}`,
        section: 'Checklists',
        title: checklist.templateName,
        subtitle: `${checklist.templateKind} · ${Object.keys(checklist.itemStates).length} items`,
        icon: ListChecks,
        keywords: checklist.templateKind,
        href: `/targets/${checklist.targetId}/methodology?id=${checklist.id}`
      });
    }

    return list;
  })();

  // ─── Filter + score ───────────────────────────────────────────────────────
  $: filtered = (() => {
    if (!query.trim()) {
      // Empty query → show recent items first, then a curated "starter" set.
      const recents = recentIds
        .map((id) => items.find((i) => i.id === id))
        .filter((x): x is CommandItem => Boolean(x))
        .map((item) => ({ ...item, score: 0, matchIndexes: [], section: 'Recent' as never }));

      const starters = items
        .filter((i) => i.section === 'Actions' || i.section === 'Navigate')
        .map((item) => ({ ...item, score: 0, matchIndexes: [] }));

      return [...recents, ...starters].slice(0, 40);
    }

    const scored: ScoredItem[] = [];
    for (const item of items) {
      const haystack = `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`;
      const match = fuzzyMatch(query, haystack);
      if (!match) continue;
      // Prefer matches that hit the title itself
      const titleMatch = fuzzyMatch(query, item.title);
      const score = (titleMatch ? titleMatch.score * 1.5 : 0) + match.score;
      scored.push({
        ...item,
        score,
        matchIndexes: titleMatch ? titleMatch.indexes : []
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40);
  })();

  // ─── Group for rendering ──────────────────────────────────────────────────
  $: groups = (() => {
    const order = [
      'Recent',
      'Actions',
      'Navigate',
      'Targets',
      'Submissions',
      'Notes',
      'Payloads',
      'Recon',
      'Evidence',
      'Checklists',
      'Bookmarks'
    ];
    const buckets = new Map<string, ScoredItem[]>();
    for (const item of filtered as ScoredItem[]) {
      const key = (item as { section: string }).section;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    return order
      .map((label) => ({ label, items: buckets.get(label) ?? [] }))
      .filter((g) => g.items.length > 0);
  })();

  // Flat list mirrors render order so ↑/↓ navigates correctly across groups.
  $: flat = groups.flatMap((g) => g.items);
  $: if (activeIndex >= flat.length) activeIndex = Math.max(0, flat.length - 1);

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, flat.length - 1);
      scrollActiveIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = flat[activeIndex];
      if (item) void execute(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Home') {
      event.preventDefault();
      activeIndex = 0;
      scrollActiveIntoView();
    } else if (event.key === 'End') {
      event.preventDefault();
      activeIndex = flat.length - 1;
      scrollActiveIntoView();
    }
  }

  function scrollActiveIntoView(): void {
    void tick().then(() => {
      const el = listEl?.querySelector<HTMLElement>(`[data-cmdk-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  // Highlight matched characters inside the title
  function highlight(title: string, indexes: number[]): { char: string; on: boolean }[] {
    const set = new Set(indexes);
    return Array.from(title).map((char, i) => ({ char, on: set.has(i) }));
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-[70] flex items-start justify-center bg-background/80 px-4 pb-4 pt-16 backdrop-blur-md sm:pt-24"
    role="presentation"
    on:click|self={close}
  >
    <div
      class="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card/95 shadow-dark-xl backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div class="flex items-center gap-3 border-b border-border/70 px-4">
        <Search size={18} class="text-muted-foreground" aria-hidden="true" />
        <input
          bind:this={inputEl}
          bind:value={query}
          on:input={() => (activeIndex = 0)}
          type="text"
          placeholder="Search targets, notes, payloads, submissions, actions…"
          class="flex-1 bg-transparent py-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          autocomplete="off"
          spellcheck="false"
          aria-label="Command palette query"
        />
        <kbd class="hidden rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ESC
        </kbd>
      </div>

      <div bind:this={listEl} class="max-h-[60vh] overflow-y-auto py-2">
        {#if flat.length === 0}
          <div class="px-6 py-10 text-center text-sm text-muted-foreground">
            No matches for <span class="font-medium text-foreground">{query}</span>
          </div>
        {:else}
          {#each groups as group}
            <div class="px-2 py-1">
              <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.label}
              </div>
              <ul class="space-y-0.5">
                {#each group.items as item}
                  {@const flatIdx = flat.indexOf(item)}
                  {@const active = flatIdx === activeIndex}
                  <li>
                    <button
                      type="button"
                      data-cmdk-index={flatIdx}
                      class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition {active
                        ? 'bg-primary/15 text-foreground ring-1 ring-primary/40'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
                      on:click={() => execute(item)}
                      on:mousemove={() => (activeIndex = flatIdx)}
                    >
                      <span
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 {active
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted/40 text-muted-foreground'}"
                      >
                        <svelte:component this={item.icon} size={16} aria-hidden="true" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-medium {active ? 'text-foreground' : 'text-foreground/90'}">
                          {#each highlight(item.title, item.matchIndexes) as part}
                            {#if part.on}
                              <span class="text-primary">{part.char}</span>
                            {:else}
                              {part.char}
                            {/if}
                          {/each}
                        </span>
                        {#if item.subtitle}
                          <span class="block truncate text-xs text-muted-foreground/80">{item.subtitle}</span>
                        {/if}
                      </span>
                      {#if active}
                        <kbd class="hidden rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary sm:inline-flex">
                          ↵
                        </kbd>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        {/if}
      </div>

      <div class="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground/80">
        <span class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <kbd class="rounded border border-border/60 bg-muted px-1.5 py-0.5">↑↓</kbd>
            navigate
          </span>
          <span class="flex items-center gap-1">
            <kbd class="rounded border border-border/60 bg-muted px-1.5 py-0.5">↵</kbd>
            open
          </span>
          <span class="hidden items-center gap-1 sm:flex">
            <kbd class="rounded border border-border/60 bg-muted px-1.5 py-0.5">esc</kbd>
            close
          </span>
        </span>
        <span class="hidden items-center gap-1 sm:flex">
          {flat.length} result{flat.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  </div>
{/if}
