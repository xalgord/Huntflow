<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { cacheRemoteEvidenceAsset, deleteRemoteEvidenceAssetFile } from '$lib/cloud/assets';
  import EvidenceCharts from '$lib/components/assets/EvidenceCharts.svelte';
  import EvidenceGraphCanvas from '$lib/components/assets/EvidenceGraphCanvas.svelte';
  import {
    evidenceAssetStore,
    evidenceCanvasViewStore,
    evidenceLinkStore,
    getEvidenceBlob,
    putEvidenceBlob,
    sessionStore,
    targetStore,
    noteStore
  } from '$lib/stores';
  import type {
    EvidenceAsset,
    EvidenceAssetKind,
    EvidenceCanvasPosition,
    EvidenceCanvasView,
    EvidenceLink,
    EvidenceNodeType,
    EvidenceRelationship,
    Target
  } from '$lib/types';
  import { createId } from '$lib/utils/id';
  import {
    deriveEvidenceGraph,
    evidenceKindFromFile,
    formatEvidenceBytes,
    folderPathFromRelativePath,
    isPreviewableImage,
    isPreviewableText,
    normalizeEvidencePath,
    normalizeEvidenceTags,
    totalEvidenceBytes,
    validateEvidenceFile
  } from '$lib/utils/evidence';
  import {
    Archive,
    ChevronDown,
    CircleDollarSign,
    Clipboard,
    Download,
    ExternalLink,
    FileText,
    Filter,
    Folder,
    Image as ImageIcon,
    Link as LinkIcon,
    Network,
    Plus,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    UploadCloud
  } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  type KindFilter = EvidenceAssetKind | 'all';
  type LinkDestination = `${EvidenceNodeType}:${string}`;

  interface EvidenceUploadFile {
    file: File;
    relativePath?: string;
  }

  interface FileSystemEntryLike {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath?: string;
  }

  interface FileSystemFileEntryLike extends FileSystemEntryLike {
    file(successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void): void;
  }

  interface FileSystemDirectoryReaderLike {
    readEntries(successCallback: (entries: FileSystemEntryLike[]) => void, errorCallback?: (error: DOMException) => void): void;
  }

  interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
    createReader(): FileSystemDirectoryReaderLike;
  }

  const kindOptions: { label: string; value: KindFilter }[] = [
    { label: 'All types', value: 'all' },
    { label: 'Images', value: 'image' },
    { label: 'PDFs', value: 'pdf' },
    { label: 'Text', value: 'text' },
    { label: 'Requests', value: 'request' },
    { label: 'Responses', value: 'response' },
    { label: 'Archives', value: 'archive' },
    { label: 'Binary', value: 'binary' },
    { label: 'URLs', value: 'url' }
  ];

  const relationships: { label: string; value: EvidenceRelationship }[] = [
    { label: 'Proves', value: 'proves' },
    { label: 'References', value: 'references' },
    { label: 'Derived from', value: 'derived-from' },
    { label: 'Blocks', value: 'blocks' },
    { label: 'Duplicates', value: 'duplicates' },
    { label: 'Belongs to', value: 'belongs-to' }
  ];

  const kindIcons: Record<EvidenceAssetKind, typeof ImageIcon> = {
    image: ImageIcon,
    pdf: FileText,
    text: FileText,
    request: ShieldCheck,
    response: ShieldCheck,
    archive: Archive,
    binary: CircleDollarSign,
    url: LinkIcon
  };

  let loaded = false;
  let fileInput: HTMLInputElement;
  let folderInput: HTMLInputElement;
  let uploadMenuElement: HTMLDivElement;
  let uploadMenuOpen = false;
  let dragActive = false;
  let search = '';
  let kindFilter: KindFilter = 'all';
  let targetFilter = 'all';
  let folderFilter = 'all';
  let tagFilter = '';
  let selectedAssetId = '';
  let selectedTargetId = '';
  let selectedSessionId = '';
  let selectedNoteId = '';
  let tagsInput = '';
  let description = '';
  let urlInput = '';
  let urlTitle = '';
  let snippetTitle = '';
  let snippetKind: EvidenceAssetKind = 'request';
  let snippetContent = '';
  let uploadError = '';
  let previewAssetId = '';
  let previewUrl = '';
  let previewText = '';
  let previewLoading = false;
  let previewError = '';
  let linkRelationship: EvidenceRelationship = 'proves';
  let linkDestination: LinkDestination | '' = '';
  let linkLabel = '';
  let includeSessions = true;
  let includeNotes = true;
  let includeUrls = true;
  let canvasPositions: Record<string, EvidenceCanvasPosition> = {};
  let selectedGraphNodeId = '';

  $: targetOptions = $targetStore.filter((target) => target.status !== 'archived');
  $: targetById = new Map($targetStore.map((target) => [target.id, target]));
  $: sessionById = new Map($sessionStore.map((session) => [session.id, session]));
  $: noteById = new Map($noteStore.map((note) => [note.id, note]));
  $: selectedAsset = $evidenceAssetStore.find((asset) => asset.id === selectedAssetId);
  $: effectiveTargetFilter = targetFilter === 'all' ? '' : targetFilter;
  $: usedBytes = totalEvidenceBytes($evidenceAssetStore);
  $: syncedBytes = totalEvidenceBytes($evidenceAssetStore.filter((asset) => asset.storageId));
  $: folderOptions = uniqueFolders($evidenceAssetStore);
  $: folderCount = folderOptions.length;
  $: highSignalCount = $evidenceAssetStore.filter((asset) =>
    asset.tags.some((tag) => tag === 'critical' || tag === 'high')
  ).length;
  $: reportReadyCount = $evidenceAssetStore.filter((asset) => asset.tags.includes('needs-report')).length;
  $: filteredAssets = $evidenceAssetStore.filter((asset) => {
    const haystack = [
      asset.title,
      asset.fileName ?? '',
      asset.relativePath ?? '',
      asset.folderPath ?? '',
      asset.url ?? '',
      asset.description ?? '',
      asset.tags.join(' '),
      targetById.get(asset.targetId ?? '')?.name ?? ''
    ]
      .join(' ')
      .toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesKind = kindFilter === 'all' || asset.kind === kindFilter;
    const matchesTarget = targetFilter === 'all' || asset.targetId === targetFilter;
    const matchesFolder = folderFilter === 'all' || (folderFilter === 'root' ? !asset.folderPath : asset.folderPath === folderFilter);
    const matchesTag = !tagFilter.trim() || asset.tags.includes(tagFilter.trim().toLowerCase());
    return matchesSearch && matchesKind && matchesTarget && matchesFolder && matchesTag;
  });
  $: groupedAssetSections = groupAssetsByFolder(filteredAssets);
  $: connectedLinks = selectedAsset
    ? $evidenceLinkStore.filter((link) => {
        const assetType = selectedAsset.kind === 'url' ? 'url' : 'asset';
        const key = `${assetType}:${selectedAsset.id}`;
        return link.fromKey === key || link.toKey === key;
      })
    : [];
  $: graph = deriveEvidenceGraph({
    assets: filteredAssets,
    links: $evidenceLinkStore,
    targets: $targetStore,
    sessions: $sessionStore,
    notes: $noteStore,
    positions: canvasPositions,
    targetId: effectiveTargetFilter || undefined,
    includeSessions,
    includeNotes,
    includeUrls
  });
  $: destinationOptions = buildDestinationOptions(selectedAsset);
  $: if (selectedAsset?.id !== previewAssetId) {
    void loadPreview(selectedAsset);
  }

  onMount(async () => {
    await Promise.all([
      evidenceAssetStore.load(),
      evidenceLinkStore.load(),
      evidenceCanvasViewStore.load(),
      targetStore.load(),
      sessionStore.load(),
      noteStore.load()
    ]);

    selectedTargetId = $page.url.searchParams.get('target') ?? '';
    selectedSessionId = $page.url.searchParams.get('session') ?? '';
    selectedNoteId = $page.url.searchParams.get('note') ?? '';
    targetFilter = selectedTargetId || 'all';
    hydrateCanvasView();
    loaded = true;
  });

  onDestroy(() => {
    revokePreviewUrl();
  });

  function hydrateCanvasView(): void {
    const view =
      $evidenceCanvasViewStore.find((candidate) => candidate.targetId === (targetFilter === 'all' ? undefined : targetFilter)) ??
      $evidenceCanvasViewStore[0];
    if (!view) return;
    includeSessions = view.includeSessions;
    includeNotes = view.includeNotes;
    includeUrls = view.includeUrls;
    canvasPositions = { ...view.positions };
  }

  function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(timestamp)
    );
  }

  function targetName(targetId: string | undefined): string {
    if (!targetId) return 'Unassigned';
    return targetById.get(targetId)?.name ?? 'Missing target';
  }

  function assetSubtitle(asset: EvidenceAsset): string {
    return [asset.folderPath, targetName(asset.targetId), asset.kind, formatEvidenceBytes(asset.size)]
      .filter((part): part is string => Boolean(part))
      .join(' · ');
  }

  function hostFromUrl(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  function selectedTarget(): Target | undefined {
    return targetById.get(selectedTargetId);
  }

  function resetUploadMeta(): void {
    description = '';
    tagsInput = '';
  }

  function openFilePicker(): void {
    uploadMenuOpen = false;
    fileInput?.click();
  }

  function openFolderPicker(): void {
    uploadMenuOpen = false;
    folderInput?.click();
  }

  function handleWindowClick(event: MouseEvent): void {
    if (!uploadMenuOpen) return;
    const target = event.target as Node | null;
    if (target && uploadMenuElement?.contains(target)) return;
    uploadMenuOpen = false;
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') uploadMenuOpen = false;
  }

  function folderPicker(node: HTMLInputElement): { destroy: () => void } {
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');

    return {
      destroy: () => {
        node.removeAttribute('webkitdirectory');
        node.removeAttribute('directory');
      }
    };
  }

  function uploadFile(file: File, fallbackPath?: string): EvidenceUploadFile {
    const fileWithPath = file as File & { webkitRelativePath?: string };
    const relativePath = normalizeEvidencePath(fileWithPath.webkitRelativePath || fallbackPath || file.name);
    return {
      file,
      relativePath: relativePath || undefined
    };
  }

  function uniqueFolders(assets: EvidenceAsset[]): string[] {
    return Array.from(new Set(assets.flatMap((asset) => (asset.folderPath ? [asset.folderPath] : [])))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function groupAssetsByFolder(assets: EvidenceAsset[]): { key: string; label: string; assets: EvidenceAsset[] }[] {
    const groups = new Map<string, EvidenceAsset[]>();

    for (const asset of assets) {
      const key = asset.folderPath ?? '';
      groups.set(key, [...(groups.get(key) ?? []), asset]);
    }

    return Array.from(groups.entries())
      .sort(([first], [second]) => {
        if (first === second) return 0;
        if (!first) return -1;
        if (!second) return 1;
        return first.localeCompare(second);
      })
      .map(([folderPath, assetsInFolder]) => ({
        key: folderPath || 'root',
        label: folderPath || 'Root',
        assets: assetsInFolder
      }));
  }

  function revokePreviewUrl(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }

  async function loadPreview(asset: EvidenceAsset | undefined): Promise<void> {
    revokePreviewUrl();
    previewText = '';
    previewError = '';
    previewLoading = Boolean(asset);
    previewAssetId = asset?.id ?? '';

    if (!asset) {
      previewLoading = false;
      return;
    }

    try {
      if (asset.textContent) previewText = asset.textContent;

      if (asset.source !== 'url' && (isPreviewableImage(asset) || isPreviewableText(asset) || asset.kind === 'pdf')) {
        const evidenceBlob = (await getEvidenceBlob(asset.id)) ?? (await cacheRemoteEvidenceAsset(asset));
        if (previewAssetId !== asset.id || !evidenceBlob) return;

        if (isPreviewableImage(asset) || asset.kind === 'pdf') {
          previewUrl = URL.createObjectURL(evidenceBlob.blob);
        }

        if (isPreviewableText(asset) && !previewText) {
          previewText = (await evidenceBlob.blob.text()).slice(0, 100000);
        }
      }
    } catch (error) {
      previewError = error instanceof Error ? error.message : 'Unable to load preview.';
    } finally {
      if (previewAssetId === asset.id) previewLoading = false;
    }
  }

  function handleFileInput(): void {
    if (!fileInput.files) return;
    void addUploadFiles(Array.from(fileInput.files).map((file) => uploadFile(file)));
    fileInput.value = '';
  }

  function handleFolderInput(): void {
    if (!folderInput.files) return;
    const files = Array.from(folderInput.files);
    if (files.length === 0) {
      uploadError = 'No files were found in that folder.';
      return;
    }
    void addUploadFiles(files.map((file) => uploadFile(file)));
    folderInput.value = '';
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dragActive = false;
    if (!event.dataTransfer) return;
    const files = await collectDroppedFiles(event.dataTransfer);
    if (files.length === 0) {
      uploadError = 'No files were found in that drop.';
      return;
    }
    await addUploadFiles(files);
  }

  function handlePaste(event: ClipboardEvent): void {
    const files = event.clipboardData?.files ? Array.from(event.clipboardData.files) : [];
    if (files.length === 0) return;
    void addUploadFiles(files.map((file) => uploadFile(file)), 'clipboard');
  }

  async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<EvidenceUploadFile[]> {
    const entries = Array.from(dataTransfer.items)
      .map((item) => item.webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined)
      .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

    if (entries.length > 0) {
      const nestedFiles = await Promise.all(entries.map((entry) => readEntry(entry)));
      return nestedFiles.flat();
    }

    return Array.from(dataTransfer.files).map((file) => uploadFile(file));
  }

  async function readEntry(entry: FileSystemEntryLike, parentPath = ''): Promise<EvidenceUploadFile[]> {
    const fallbackPath = normalizeEvidencePath(entry.fullPath || `${parentPath}/${entry.name}`);

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntryLike;
      return new Promise((resolve, reject) => {
        fileEntry.file((file) => resolve([uploadFile(file, fallbackPath)]), reject);
      });
    }

    if (entry.isDirectory) {
      const directoryEntry = entry as FileSystemDirectoryEntryLike;
      const entries = await readDirectoryEntries(directoryEntry.createReader());
      const nestedFiles = await Promise.all(entries.map((child) => readEntry(child, fallbackPath)));
      return nestedFiles.flat();
    }

    return [];
  }

  async function readDirectoryEntries(reader: FileSystemDirectoryReaderLike): Promise<FileSystemEntryLike[]> {
    const entries: FileSystemEntryLike[] = [];

    while (true) {
      const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      entries.push(...batch);
    }

    return entries;
  }

  async function addUploadFiles(files: EvidenceUploadFile[], source: 'upload' | 'clipboard' = 'upload'): Promise<void> {
    uploadError = '';
    const errors: string[] = [];

    for (const upload of files) {
      const { file } = upload;
      const validation = validateEvidenceFile(file);
      if (!validation.valid) {
        errors.push(`${file.name || 'Unnamed file'}: ${validation.errors.join(' ')}`);
        continue;
      }

      const id = createId();
      const now = Date.now();
      const kind = evidenceKindFromFile(file);
      const textContent = isTextLike(kind, file.type) ? await file.slice(0, 100000).text() : undefined;
      const relativePath = normalizeEvidencePath(upload.relativePath);
      const folderPath = folderPathFromRelativePath(relativePath);
      const asset: EvidenceAsset = {
        id,
        title: file.name.replace(/\.[^.]+$/, '') || file.name,
        kind,
        source,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        fileName: file.name,
        relativePath: relativePath && relativePath !== file.name ? relativePath : undefined,
        folderPath,
        description: description.trim() || undefined,
        localBlobId: id,
        targetId: selectedTargetId || undefined,
        sessionId: selectedSessionId || undefined,
        noteId: selectedNoteId || undefined,
        tags: normalizeEvidenceTags(tagsInput),
        textContent,
        syncState: 'pending-upload',
        capturedAt: now,
        createdAt: now,
        updatedAt: now
      };

      await putEvidenceBlob({
        assetId: id,
        blob: file,
        mimeType: asset.mimeType,
        fileName: file.name,
        relativePath: relativePath && relativePath !== file.name ? relativePath : undefined,
        size: file.size,
        createdAt: now,
        updatedAt: now
      });
      await evidenceAssetStore.put(asset);
      selectedAssetId = id;
    }

    uploadError = errors.join(' ');
    resetUploadMeta();
  }

  function isTextLike(kind: EvidenceAssetKind, mimeType: string): boolean {
    return kind === 'text' || kind === 'request' || kind === 'response' || mimeType.startsWith('text/');
  }

  async function addUrlAsset(): Promise<void> {
    uploadError = '';
    try {
      const parsed = new URL(urlInput.trim());
      const now = Date.now();
      const id = createId();
      const asset: EvidenceAsset = {
        id,
        title: urlTitle.trim() || parsed.host,
        kind: 'url',
        source: 'url',
        mimeType: 'text/uri-list',
        size: 0,
        url: parsed.toString(),
        description: description.trim() || undefined,
        targetId: selectedTargetId || undefined,
        sessionId: selectedSessionId || undefined,
        noteId: selectedNoteId || undefined,
        tags: normalizeEvidenceTags(tagsInput),
        syncState: 'synced',
        capturedAt: now,
        createdAt: now,
        updatedAt: now
      };
      await evidenceAssetStore.put(asset);
      selectedAssetId = id;
      urlInput = '';
      urlTitle = '';
      resetUploadMeta();
    } catch {
      uploadError = 'Enter a valid URL before saving.';
    }
  }

  async function addSnippetAsset(): Promise<void> {
    uploadError = '';
    const content = snippetContent.trim();
    if (!content) {
      uploadError = 'Snippet content is required.';
      return;
    }

    const now = Date.now();
    const id = createId();
    const asset: EvidenceAsset = {
      id,
      title: snippetTitle.trim() || `${snippetKind} evidence`,
      kind: snippetKind,
      source: 'snippet',
      mimeType: 'text/plain',
      size: new Blob([content]).size,
      textContent: content,
      description: description.trim() || undefined,
      targetId: selectedTargetId || undefined,
      sessionId: selectedSessionId || undefined,
      noteId: selectedNoteId || undefined,
      tags: normalizeEvidenceTags(tagsInput),
      syncState: 'synced',
      capturedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await evidenceAssetStore.put(asset);
    selectedAssetId = id;
    snippetTitle = '';
    snippetContent = '';
    resetUploadMeta();
  }

  async function downloadSelectedAsset(): Promise<void> {
    if (!selectedAsset || !browser) return;
    if (selectedAsset.source === 'url' && selectedAsset.url) {
      window.open(selectedAsset.url, '_blank', 'noreferrer');
      return;
    }

    const evidenceBlob = (await getEvidenceBlob(selectedAsset.id)) ?? (await cacheRemoteEvidenceAsset(selectedAsset));
    if (!evidenceBlob) {
      previewError = 'No local or cloud file is available for this asset.';
      return;
    }

    const url = URL.createObjectURL(evidenceBlob.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = evidenceBlob.fileName ?? selectedAsset.fileName ?? `${selectedAsset.title}.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteSelectedAsset(): Promise<void> {
    if (!selectedAsset) return;
    if (!confirm(`Delete evidence asset "${selectedAsset.title}"?`)) return;
    await deleteRemoteEvidenceAssetFile(selectedAsset.id).catch(() => undefined);
    await evidenceAssetStore.delete(selectedAsset.id);
    selectedAssetId = '';
  }

  function buildDestinationOptions(asset: EvidenceAsset | undefined): { label: string; value: LinkDestination }[] {
    const options: { label: string; value: LinkDestination }[] = [];
    for (const target of $targetStore) options.push({ label: `Target: ${target.name}`, value: `target:${target.id}` });
    for (const session of $sessionStore) {
      const target = targetById.get(session.targetId);
      options.push({
        label: `Session: ${target?.name ?? 'Missing target'} · ${formatDate(session.startedAt)}`,
        value: `session:${session.id}`
      });
    }
    for (const note of $noteStore) options.push({ label: `Note: ${note.title}`, value: `note:${note.id}` });
    for (const other of $evidenceAssetStore) {
      if (asset && other.id === asset.id) continue;
      options.push({
        label: `${other.kind === 'url' ? 'URL' : 'Asset'}: ${other.title}`,
        value: `${other.kind === 'url' ? 'url' : 'asset'}:${other.id}`
      });
    }
    return options;
  }

  async function addEvidenceLink(): Promise<void> {
    if (!selectedAsset || !linkDestination) return;
    const [toType, toId] = linkDestination.split(':') as [EvidenceNodeType, string];
    const fromType: EvidenceNodeType = selectedAsset.kind === 'url' ? 'url' : 'asset';
    const now = Date.now();
    const link: EvidenceLink = {
      id: createId(),
      fromType,
      fromId: selectedAsset.id,
      fromKey: `${fromType}:${selectedAsset.id}`,
      toType,
      toId,
      toKey: `${toType}:${toId}`,
      relationship: linkRelationship,
      label: linkLabel.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };
    await evidenceLinkStore.put(link);
    linkDestination = '';
    linkLabel = '';
  }

  async function deleteEvidenceLink(link: EvidenceLink): Promise<void> {
    await evidenceLinkStore.delete(link.id);
  }

  function handleGraphNode(event: CustomEvent<{ node: { id: string; entityId: string; type: EvidenceNodeType } }>): void {
    const node = event.detail.node;
    selectedGraphNodeId = node.id;
    if (node.type === 'asset' || node.type === 'url') selectedAssetId = node.entityId;
  }

  function handleGraphPositions(event: CustomEvent<{ positions: Record<string, EvidenceCanvasPosition> }>): void {
    canvasPositions = event.detail.positions;
  }

  async function saveCanvasView(): Promise<void> {
    const now = Date.now();
    const targetId = targetFilter === 'all' ? undefined : targetFilter;
    const existing = $evidenceCanvasViewStore.find((view) => view.targetId === targetId);
    const view: EvidenceCanvasView = {
      id: existing?.id ?? createId(),
      name: targetId ? `${targetName(targetId)} evidence graph` : 'Evidence graph',
      targetId,
      includeSessions,
      includeNotes,
      includeUrls,
      positions: canvasPositions,
      zoom: existing?.zoom ?? 1,
      panX: existing?.panX ?? 0,
      panY: existing?.panY ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await evidenceCanvasViewStore.put(view);
  }
</script>

<svelte:head>
  <title>Evidence Assets | HuntFlow</title>
  <meta
    name="description"
    content="Manage proof files, URLs, request snippets, evidence relationships, analytics, and an interactive graph canvas in HuntFlow."
  />
  <meta property="og:title" content="Evidence Assets | HuntFlow" />
  <meta
    property="og:description"
    content="A local-first evidence vault with Convex-backed file sync and graph visualization for bug bounty workflows."
  />
</svelte:head>

<svelte:window on:click={handleWindowClick} on:keydown={handleWindowKeydown} />

<main class="hf-page" on:paste={handlePaste}>
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Evidence Command Center</p>
        <h1 class="hf-title">Evidence assets</h1>
        <p class="hf-description">
          Collect proof files, URLs, request traces, and report-ready links without losing the target context.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <div bind:this={uploadMenuElement} class="relative">
          <button
            type="button"
            class="hf-button-primary"
            aria-haspopup="menu"
            aria-expanded={uploadMenuOpen}
            on:click={() => (uploadMenuOpen = !uploadMenuOpen)}
          >
            <UploadCloud size={18} aria-hidden="true" />
            Upload evidence
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {#if uploadMenuOpen}
            <div
              class="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-[14px] border border-border/80 bg-background/95 p-1 shadow-2xl backdrop-blur"
              role="menu"
              aria-label="Evidence upload options"
            >
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-start gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                on:click={openFilePicker}
              >
                <UploadCloud class="mt-0.5 text-primary" size={18} aria-hidden="true" />
                <span>
                  <span class="block text-sm font-semibold text-foreground">Upload files</span>
                  <span class="mt-0.5 block text-xs leading-5 text-muted-foreground">Screenshots, logs, PDFs, HAR, archives</span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-start gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                on:click={openFolderPicker}
              >
                <Folder class="mt-0.5 text-primary" size={18} aria-hidden="true" />
                <span>
                  <span class="block text-sm font-semibold text-foreground">Upload folder</span>
                  <span class="mt-0.5 block text-xs leading-5 text-muted-foreground">Preserves paths and groups evidence automatically</span>
                </span>
              </button>
            </div>
          {/if}
        </div>
        <a href="/notes/new" class="hf-button-secondary">
          <FileText size={18} aria-hidden="true" />
          New note
        </a>
      </div>
    </header>

    <section class="grid gap-4 md:grid-cols-4">
      <div class="hf-card p-4">
        <p class="op-kicker">Vault</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">{$evidenceAssetStore.length}</p>
        <p class="mt-1 text-sm text-muted-foreground">assets captured</p>
      </div>
      <div class="hf-card p-4">
        <p class="op-kicker">Storage</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">{formatEvidenceBytes(usedBytes)}</p>
        <p class="mt-1 text-sm text-muted-foreground">
          {formatEvidenceBytes(syncedBytes)} cloud-backed · {folderCount} folders
        </p>
      </div>
      <div class="hf-card p-4">
        <p class="op-kicker">Signal</p>
        <p class="mt-3 text-3xl font-semibold text-primary">{highSignalCount}</p>
        <p class="mt-1 text-sm text-muted-foreground">critical or high tagged</p>
      </div>
      <div class="hf-card p-4">
        <p class="op-kicker">Report</p>
        <p class="mt-3 text-3xl font-semibold text-amber-300">{reportReadyCount}</p>
        <p class="mt-1 text-sm text-muted-foreground">marked needs-report</p>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <div class="space-y-6">
        <div
          class="hf-card border-dashed p-4 transition {dragActive ? 'border-primary bg-primary/10' : ''}"
          role="group"
          aria-label="Evidence upload drop zone"
          on:dragover|preventDefault={() => (dragActive = true)}
          on:dragleave={() => (dragActive = false)}
          on:drop={handleDrop}
        >
          <input
            bind:this={fileInput}
            class="sr-only"
            type="file"
            multiple
            aria-label="Upload evidence files"
            accept="image/*,.pdf,.txt,.log,.md,.json,.xml,.yaml,.yml,.zip,.har"
            on:change={handleFileInput}
          />
          <input
            use:folderPicker
            bind:this={folderInput}
            class="sr-only"
            type="file"
            multiple
            aria-label="Upload evidence folder"
            on:change={handleFolderInput}
          />
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
            <div class="rounded-[14px] border border-border/70 bg-background/45 p-4">
              <div class="flex items-start gap-3">
                <div class="rounded-[14px] border border-primary/30 bg-primary/10 p-3 text-primary">
                  <UploadCloud size={24} aria-hidden="true" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-foreground">Drop, paste, or select proof files</h2>
                  <p class="mt-1 text-sm leading-6 text-muted-foreground">
                    Screenshots, folders, PDFs, logs, HAR files, request traces, and archives stay local without a local
                    size cap. Cloud sync supports 100MB per file and 1GB per user.
                  </p>
                </div>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" class="hf-button-secondary" on:click={openFilePicker}>
                  <UploadCloud size={16} aria-hidden="true" />
                  Select files
                </button>
                <button type="button" class="hf-button-secondary" on:click={openFolderPicker}>
                  <Folder size={16} aria-hidden="true" />
                  Select folder
                </button>
              </div>
              <div class="mt-4 grid gap-3 2xl:grid-cols-3">
                <label>
                  <span class="hf-label">Target</span>
                  <select bind:value={selectedTargetId} class="hf-select mt-2">
                    <option value="">No target</option>
                    {#each targetOptions as target}
                      <option value={target.id}>{target.name}</option>
                    {/each}
                  </select>
                </label>
                <label>
                  <span class="hf-label">Session</span>
                  <select bind:value={selectedSessionId} class="hf-select mt-2">
                    <option value="">No session</option>
                    {#each $sessionStore.filter((session) => !selectedTargetId || session.targetId === selectedTargetId) as session}
                      <option value={session.id}>
                        {targetById.get(session.targetId)?.name ?? 'Target'} · {formatDate(session.startedAt)}
                      </option>
                    {/each}
                  </select>
                </label>
                <label>
                  <span class="hf-label">Note</span>
                  <select bind:value={selectedNoteId} class="hf-select mt-2">
                    <option value="">No note</option>
                    {#each $noteStore.filter((note) => !selectedTargetId || note.targetId === selectedTargetId) as note}
                      <option value={note.id}>{note.title}</option>
                    {/each}
                  </select>
                </label>
              </div>
              <div class="mt-3 grid gap-3 2xl:grid-cols-2">
                <label>
                  <span class="hf-label">Tags</span>
                  <input bind:value={tagsInput} class="hf-input mt-2" placeholder="high, needs-report" />
                </label>
                <label>
                  <span class="hf-label">Description</span>
                  <input bind:value={description} class="hf-input mt-2" placeholder="What this proves" />
                </label>
              </div>
              {#if selectedTarget()}
                <p class="mt-3 text-xs text-muted-foreground">Attaching to {selectedTarget()?.name}</p>
              {/if}
              {#if uploadError}
                <p class="mt-3 rounded-[14px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {uploadError}
                </p>
              {/if}
            </div>

            <div class="space-y-3">
              <div class="rounded-[14px] border border-border/70 bg-background/45 p-4">
                <div class="flex items-center gap-2">
                  <LinkIcon size={18} class="text-primary" aria-hidden="true" />
                  <h3 class="font-semibold text-foreground">Capture URL</h3>
                </div>
                <input bind:value={urlTitle} class="hf-input mt-3" placeholder="Optional label" />
                <input bind:value={urlInput} class="hf-input mt-3" placeholder="https://target.example/path" />
                <button type="button" class="hf-button-secondary mt-3 w-full" on:click={addUrlAsset}>
                  <Plus size={16} aria-hidden="true" />
                  Save URL
                </button>
              </div>
              <div class="rounded-[14px] border border-border/70 bg-background/45 p-4">
                <div class="flex items-center gap-2">
                  <Clipboard size={18} class="text-primary" aria-hidden="true" />
                  <h3 class="font-semibold text-foreground">Snippet</h3>
                </div>
                <div class="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <input bind:value={snippetTitle} class="hf-input" placeholder="Request title" />
                  <select bind:value={snippetKind} class="hf-select">
                    <option value="request">Request</option>
                    <option value="response">Response</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <textarea bind:value={snippetContent} class="hf-input mt-3 min-h-[120px]" placeholder="Paste request, response, stack trace, or log excerpt"></textarea>
                <button type="button" class="hf-button-secondary mt-3 w-full" on:click={addSnippetAsset}>
                  <Plus size={16} aria-hidden="true" />
                  Save snippet
                </button>
              </div>
            </div>
          </div>
        </div>

        <section class="hf-card p-4">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p class="op-kicker">Vault</p>
              <h2 class="mt-2 text-lg font-semibold text-foreground">Evidence index</h2>
            </div>
            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5 xl:min-w-[900px]">
              <label class="relative">
                <Search class="pointer-events-none absolute left-3 top-[38px] text-muted-foreground" size={16} aria-hidden="true" />
                <span class="hf-label">Search</span>
                <input bind:value={search} class="hf-input mt-2 pl-9" placeholder="Title, folder, tag, URL" />
              </label>
              <label>
                <span class="hf-label">Type</span>
                <select bind:value={kindFilter} class="hf-select mt-2">
                  {#each kindOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span class="hf-label">Folder</span>
                <select bind:value={folderFilter} class="hf-select mt-2">
                  <option value="all">All folders</option>
                  <option value="root">Root</option>
                  {#each folderOptions as folder}
                    <option value={folder}>{folder}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span class="hf-label">Target</span>
                <select bind:value={targetFilter} class="hf-select mt-2" on:change={hydrateCanvasView}>
                  <option value="all">All targets</option>
                  {#each $targetStore as target}
                    <option value={target.id}>{target.name}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span class="hf-label">Tag</span>
                <input bind:value={tagFilter} class="hf-input mt-2" placeholder="needs-report" />
              </label>
            </div>
          </div>

          <div class="mt-4 grid gap-3">
            {#if filteredAssets.length > 0}
              {#each groupedAssetSections as section (section.key)}
                <div class="space-y-2">
                  {#if groupedAssetSections.length > 1 || folderOptions.length > 0}
                    <div class="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <Folder size={14} aria-hidden="true" />
                      <span class="truncate">{section.label}</span>
                      <span class="text-primary">{section.assets.length}</span>
                    </div>
                  {/if}
                  {#each section.assets as asset (asset.id)}
                    {@const Icon = kindIcons[asset.kind]}
                    <button
                      type="button"
                      class="w-full rounded-[14px] border p-4 text-left transition hover:border-primary/40 hover:bg-muted/40 {selectedAssetId === asset.id
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/70 bg-background/45'}"
                      on:click={() => {
                        selectedAssetId = asset.id;
                        selectedGraphNodeId = `${asset.kind === 'url' ? 'url' : 'asset'}:${asset.id}`;
                      }}
                    >
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex min-w-0 items-start gap-3">
                          <span class="rounded-[14px] border border-primary/30 bg-primary/10 p-2 text-primary">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span class="min-w-0">
                            <span class="block truncate font-semibold text-foreground">{asset.title}</span>
                            <span class="mt-1 block truncate text-sm text-muted-foreground">
                              {assetSubtitle(asset)}
                            </span>
                          </span>
                        </div>
                        <span class="flex flex-wrap gap-2">
                          <span class="hf-pill">{asset.syncState}</span>
                          {#each asset.tags.slice(0, 3) as tag}
                            <span class="hf-pill border-primary/30 bg-primary/10 text-primary">{tag}</span>
                          {/each}
                        </span>
                      </div>
                    </button>
                  {/each}
                </div>
              {/each}
            {:else if loaded}
              <div class="rounded-[14px] border border-dashed border-border bg-background/40 p-8 text-center">
                <Filter class="mx-auto text-muted-foreground" size={28} aria-hidden="true" />
                <p class="mt-3 font-semibold text-foreground">No matching evidence</p>
                <p class="mt-1 text-sm text-muted-foreground">Adjust filters or capture the first proof item.</p>
              </div>
            {/if}
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <section class="hf-card p-4">
          {#if selectedAsset}
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="op-kicker">Inspector</p>
                <h2 class="mt-2 truncate text-xl font-semibold text-foreground">{selectedAsset.title}</h2>
                <p class="mt-1 text-sm text-muted-foreground">{targetName(selectedAsset.targetId)} · captured {formatDate(selectedAsset.capturedAt)}</p>
              </div>
              <button type="button" class="hf-button-ghost text-red-300 hover:text-red-100" on:click={deleteSelectedAsset}>
                <Trash2 size={18} aria-hidden="true" />
                Delete
              </button>
            </div>

            <div class="mt-4 overflow-hidden rounded-[14px] border border-border/70 bg-black/40">
              {#if previewLoading}
                <div class="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">Loading preview...</div>
              {:else if previewError}
                <div class="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-red-200">{previewError}</div>
              {:else if selectedAsset.kind === 'url' && selectedAsset.url}
                <div class="p-4">
                  <p class="text-sm text-muted-foreground">External URL</p>
                  <a class="mt-2 inline-flex items-center gap-2 break-all text-primary hover:underline" href={selectedAsset.url} target="_blank" rel="noreferrer">
                    {selectedAsset.url}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                </div>
              {:else if isPreviewableImage(selectedAsset) && previewUrl}
                <img src={previewUrl} alt={selectedAsset.title} class="max-h-[420px] w-full object-contain" />
              {:else if selectedAsset.kind === 'pdf' && previewUrl}
                <iframe src={previewUrl} title={selectedAsset.title} class="h-[420px] w-full"></iframe>
              {:else if previewText}
                <pre class="max-h-[420px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-200">{previewText}</pre>
              {:else}
                <div class="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Preview is not available for this file type.
                </div>
              {/if}
            </div>

            <div class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div class="hf-stat-tile">
                <p class="text-muted-foreground">File</p>
                <p class="mt-1 truncate text-foreground">
                  {selectedAsset.relativePath ?? selectedAsset.fileName ?? selectedAsset.url ?? 'Snippet'}
                </p>
              </div>
              <div class="hf-stat-tile">
                <p class="text-muted-foreground">Folder</p>
                <p class="mt-1 truncate text-foreground">{selectedAsset.folderPath ?? 'Root'}</p>
              </div>
              <div class="hf-stat-tile">
                <p class="text-muted-foreground">Size</p>
                <p class="mt-1 text-foreground">{formatEvidenceBytes(selectedAsset.size)}</p>
              </div>
              <div class="hf-stat-tile">
                <p class="text-muted-foreground">Cloud</p>
                <p class="mt-1 text-foreground">{selectedAsset.storageId ? 'File synced' : selectedAsset.source === 'url' ? 'Metadata only' : selectedAsset.syncState}</p>
              </div>
              <div class="hf-stat-tile">
                <p class="text-muted-foreground">Updated</p>
                <p class="mt-1 text-foreground">{formatDate(selectedAsset.updatedAt)}</p>
              </div>
            </div>

            {#if selectedAsset.description}
              <p class="mt-4 rounded-[14px] border border-border/70 bg-background/45 p-3 text-sm leading-6 text-muted-foreground">
                {selectedAsset.description}
              </p>
            {/if}

            <div class="mt-4 flex flex-wrap gap-2">
              {#each selectedAsset.tags as tag}
                <span class="hf-pill border-primary/30 bg-primary/10 text-primary">{tag}</span>
              {/each}
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="hf-button-secondary" on:click={downloadSelectedAsset}>
                <Download size={18} aria-hidden="true" />
                {selectedAsset.kind === 'url' ? 'Open URL' : 'Download'}
              </button>
              {#if selectedAsset.targetId}
                <a href={`/targets/${selectedAsset.targetId}`} class="hf-button-secondary">Open target</a>
              {/if}
              {#if selectedAsset.noteId}
                <a href={`/notes/${selectedAsset.noteId}`} class="hf-button-secondary">Open note</a>
              {/if}
            </div>

            <div class="mt-6 rounded-[14px] border border-border/70 bg-background/45 p-4">
              <h3 class="font-semibold text-foreground">Relationships</h3>
              <div class="mt-3 grid gap-2">
                <select bind:value={linkRelationship} class="hf-select" aria-label="Relationship">
                  {#each relationships as relationship}
                    <option value={relationship.value}>{relationship.label}</option>
                  {/each}
                </select>
                <select bind:value={linkDestination} class="hf-select" aria-label="Relationship destination">
                  <option value="">Select destination</option>
                  {#each destinationOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <input bind:value={linkLabel} class="hf-input" placeholder="Optional edge label" />
                <button type="button" class="hf-button-secondary" disabled={!linkDestination} on:click={addEvidenceLink}>
                  <Network size={16} aria-hidden="true" />
                  Add relationship
                </button>
              </div>

              <div class="mt-4 space-y-2">
                {#each connectedLinks as link (link.id)}
                  <div class="flex items-center justify-between gap-3 rounded-[14px] border border-border/60 bg-background/60 px-3 py-2 text-sm">
                    <span class="min-w-0 truncate text-muted-foreground">{link.label || link.relationship}</span>
                    <button type="button" class="text-red-300 hover:text-red-100" on:click={() => deleteEvidenceLink(link)}>Remove</button>
                  </div>
                {/each}
                {#if connectedLinks.length === 0}
                  <p class="text-sm text-muted-foreground">No explicit relationships yet.</p>
                {/if}
              </div>
            </div>
          {:else}
            <div class="flex min-h-[360px] items-center justify-center text-center">
              <div>
                <Network class="mx-auto text-muted-foreground" size={32} aria-hidden="true" />
                <h2 class="mt-3 text-lg font-semibold text-foreground">Select evidence</h2>
                <p class="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Choose an asset from the vault or a graph node to inspect proof, relationships, and cloud state.
                </p>
              </div>
            </div>
          {/if}
        </section>

        <EvidenceCharts assets={$evidenceAssetStore} targets={$targetStore} />
      </aside>
    </section>

    <section class="space-y-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="op-kicker">Graph controls</p>
          <h2 class="mt-2 text-lg font-semibold text-foreground">Visual link map</h2>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="hf-pill">
            <input bind:checked={includeSessions} type="checkbox" class="h-4 w-4" />
            Sessions
          </label>
          <label class="hf-pill">
            <input bind:checked={includeNotes} type="checkbox" class="h-4 w-4" />
            Notes
          </label>
          <label class="hf-pill">
            <input bind:checked={includeUrls} type="checkbox" class="h-4 w-4" />
            URLs
          </label>
          <button type="button" class="hf-button-secondary" on:click={saveCanvasView}>
            <Save size={16} aria-hidden="true" />
            Save view
          </button>
        </div>
      </div>
      <EvidenceGraphCanvas
        {graph}
        selectedNodeId={selectedGraphNodeId}
        on:selectNode={handleGraphNode}
        on:positions={handleGraphPositions}
      />
    </section>
  </div>
</main>
