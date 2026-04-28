<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getEvidenceBlob } from '$lib/stores';
  import type { EvidenceAsset } from '$lib/types';
  import {
    FileText as FileTextIcon,
    Image as ImageIcon,
    Link2,
    Network,
    Package,
    ShieldAlert
  } from 'lucide-svelte';

  /**
   * Inline reference tile for `[[evidence:id]]` markers in note markdown.
   *
   * Three states:
   *   1. **Image / screenshot** — render an actual thumbnail loaded
   *      from the evidence blob store (object URL, revoked on destroy).
   *   2. **Other kinds** — render a typed icon + title + kind badge.
   *   3. **Asset missing** — render a faded "deleted" pill so the
   *      reference doesn't silently disappear from the rendered note.
   *
   * The tile is a real anchor pointing to the assets page so the
   * hunter can jump into the inspector without losing the note.
   */

  export let evidenceId: string;
  export let asset: EvidenceAsset | undefined = undefined;

  let thumbnailUrl: string | null = null;

  $: kind = asset?.kind ?? 'binary';
  $: title = asset?.title ?? `Evidence ${evidenceId.slice(0, 6)}`;
  $: href = asset ? `/assets?asset=${asset.id}` : '/assets';

  $: void hydrateThumbnail(asset);

  async function hydrateThumbnail(current: EvidenceAsset | undefined): Promise<void> {
    revokeThumbnail();
    if (!current) return;
    if (current.kind !== 'image') return;
    try {
      const record = await getEvidenceBlob(current.id);
      if (!record) return;
      // Tolerate both the canonical `blob` field and the legacy `data`
      // alias so screenshots saved before the schema rename still hydrate.
      const source = (record.blob ?? record.data) as Blob | undefined;
      if (!source) return;
      thumbnailUrl = URL.createObjectURL(source);
    } catch (error) {
      console.error('[v0] evidence thumbnail load failed', error);
    }
  }

  function revokeThumbnail(): void {
    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
      thumbnailUrl = null;
    }
  }

  onDestroy(revokeThumbnail);

  function iconForKind(value: string) {
    switch (value) {
      case 'image':
        return ImageIcon;
      case 'request':
      case 'response':
      case 'http-exchange':
        return Network;
      case 'url':
        return Link2;
      case 'pdf':
      case 'text':
        return FileTextIcon;
      case 'archive':
      case 'binary':
        return Package;
      default:
        return FileTextIcon;
    }
  }

  $: Icon = iconForKind(kind);
</script>

{#if !asset}
  <a
    href={href}
    class="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 align-middle text-xs font-medium text-rose-200 transition hover:border-rose-400/50 hover:text-rose-100"
    title="The referenced evidence asset was deleted or hasn't synced yet."
  >
    <ShieldAlert size={12} aria-hidden="true" />
    Missing evidence ({evidenceId.slice(0, 6)})
  </a>
{:else if thumbnailUrl}
  <a
    href={href}
    class="inline-flex max-w-full items-stretch gap-2 overflow-hidden rounded-md border border-slate-700 bg-slate-900/80 align-middle text-left transition hover:border-primary-400/50 hover:bg-slate-900"
  >
    <img
      src={thumbnailUrl}
      alt={asset.title}
      class="h-12 w-16 shrink-0 object-cover"
    />
    <span class="flex min-w-0 flex-col justify-center pr-2 py-1">
      <span class="truncate text-xs font-medium text-slate-100">{title}</span>
      <span class="text-[10px] uppercase tracking-wide text-slate-500">screenshot</span>
    </span>
  </a>
{:else}
  <a
    href={href}
    class="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1.5 align-middle transition hover:border-primary-400/50 hover:bg-slate-900"
  >
    <span class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-800 text-primary-200">
      <Icon size={14} aria-hidden="true" />
    </span>
    <span class="flex min-w-0 flex-col">
      <span class="max-w-[14rem] truncate text-xs font-medium text-slate-100">{title}</span>
      <span class="text-[10px] uppercase tracking-wide text-slate-500">{kind.replace('-', ' ')}</span>
    </span>
  </a>
{/if}
