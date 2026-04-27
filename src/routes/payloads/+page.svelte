<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import PayloadCard from '$lib/components/payloads/PayloadCard.svelte';
  import PayloadForm from '$lib/components/payloads/PayloadForm.svelte';
  import { PAYLOAD_CATEGORIES, payloadCategoryLabel } from '$lib/seeds/payloads';
  import { payloadStore } from '$lib/stores';
  import type { Payload, PayloadCategory } from '$lib/types';
  import { Plus, Search, Star, Sword } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type CategoryFilter = PayloadCategory | 'all' | 'favorites';

  let query = '';
  let selected: CategoryFilter = 'all';
  let showForm = false;
  let editing: Payload | null = null;

  onMount(() => {
    void payloadStore.load();
  });

  $: filtered = $payloadStore.filter((p) => {
    if (selected === 'favorites' && !p.isFavorite) return false;
    if (selected !== 'all' && selected !== 'favorites' && p.category !== selected) return false;
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [p.name, p.description, p.payload, p.tags.join(' ')]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(search));
  });

  $: categoryCounts = (() => {
    const counts = new Map<string, number>();
    for (const p of $payloadStore) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return counts;
  })();

  $: favoriteCount = $payloadStore.filter((p) => p.isFavorite).length;

  function openCreate() {
    editing = null;
    showForm = true;
  }

  function handleEdit(event: CustomEvent<{ payload: Payload }>) {
    editing = event.detail.payload;
    showForm = true;
  }

  async function handleSubmit(event: CustomEvent<{ payload: Payload }>) {
    await payloadStore.put(event.detail.payload);
    await payloadStore.persistNow();
    showForm = false;
    editing = null;
  }

  async function handleFavorite(event: CustomEvent<{ id: string; favorite: boolean }>) {
    const payload = $payloadStore.find((p) => p.id === event.detail.id);
    if (!payload) return;
    await payloadStore.put({
      ...payload,
      isFavorite: event.detail.favorite,
      updatedAt: Date.now()
    });
  }

  async function handleDelete(event: CustomEvent<{ id: string }>) {
    if (!confirm('Delete this custom payload? Built-in payloads cannot be deleted.')) return;
    await payloadStore.delete(event.detail.id);
    await payloadStore.persistNow();
  }
</script>

<svelte:head>
  <title>Payloads | HuntFlow</title>
  <meta
    name="description"
    content="Categorized, searchable payload library for XSS, SQLi, SSRF, SSTI, RCE, and more."
  />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-7xl">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Battle Library</p>
        <h1 class="hf-title">Payloads</h1>
        <p class="hf-description">
          Curated XSS, SQLi, SSRF, SSTI, RCE, and bypass payloads. Tap to copy, mark favorites, and
          add your own.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={openCreate}>
        <Plus size={20} aria-hidden="true" />
        Add Payload
      </button>
    </header>

    <section class="hf-card p-4">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label class="block">
          <span class="hf-label">Search</span>
          <div
            class="mt-2 flex items-center gap-2 rounded-[14px] border border-input bg-background/70 px-3 shadow-inner-line focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
          >
            <Search size={18} class="text-muted-foreground" aria-hidden="true" />
            <input
              bind:value={query}
              class="min-h-[44px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              placeholder="Search by name, payload, tag, description"
            />
          </div>
        </label>
        <div class="flex items-end gap-2 text-sm text-muted-foreground">
          <span class="hf-pill">
            <Sword size={14} aria-hidden="true" />
            {$payloadStore.length} payloads
          </span>
          <span class="hf-pill">
            <Star size={14} aria-hidden="true" />
            {favoriteCount} favorites
          </span>
        </div>
      </div>

      <div class="mt-4 -mx-1 flex flex-wrap gap-2 px-1" role="tablist" aria-label="Category filters">
        <button
          type="button"
          role="tab"
          aria-selected={selected === 'all'}
          class="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition {selected === 'all' ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
          on:click={() => (selected = 'all')}
        >
          All ({$payloadStore.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selected === 'favorites'}
          class="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition {selected === 'favorites' ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
          on:click={() => (selected = 'favorites')}
        >
          Favorites ({favoriteCount})
        </button>
        {#each PAYLOAD_CATEGORIES as category}
          {@const count = categoryCounts.get(category.value) ?? 0}
          {#if count > 0}
            <button
              type="button"
              role="tab"
              aria-selected={selected === category.value}
              class="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition {selected === category.value ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}"
              on:click={() => (selected = category.value)}
            >
              {category.label} ({count})
            </button>
          {/if}
        {/each}
      </div>
    </section>

    {#if filtered.length > 0}
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Payloads">
        {#each filtered as payload (payload.id)}
          <PayloadCard
            {payload}
            on:favorite={handleFavorite}
            on:edit={handleEdit}
            on:delete={handleDelete}
          />
        {/each}
      </section>
    {:else}
      <section class="hf-card p-8 text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"
        >
          <Sword size={24} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-foreground">
          {#if $payloadStore.length === 0}
            Loading payload library...
          {:else if selected === 'favorites'}
            No favorites yet
          {:else if selected !== 'all'}
            No payloads in {payloadCategoryLabel(selected)}
          {:else}
            No payloads match your search
          {/if}
        </h2>
        <p class="mt-2 text-sm text-muted-foreground">
          {#if selected === 'favorites'}
            Tap the star on any payload to add it here for instant access.
          {:else}
            Adjust filters or add a custom payload.
          {/if}
        </p>
      </section>
    {/if}
  </div>
</main>

<Modal
  open={showForm}
  title={editing ? 'Edit Payload' : 'New Payload'}
  on:close={() => {
    showForm = false;
    editing = null;
  }}
>
  <PayloadForm
    payload={editing}
    submitLabel={editing ? 'Save Changes' : 'Create Payload'}
    on:submit={handleSubmit}
    on:cancel={() => {
      showForm = false;
      editing = null;
    }}
  />
</Modal>
