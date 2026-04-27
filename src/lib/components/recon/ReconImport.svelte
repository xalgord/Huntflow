<script lang="ts">
  import type { ReconAsset, ReconAssetSource } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import { createEventDispatcher } from 'svelte';

  export let targetId: string;

  const dispatch = createEventDispatcher<{ import: { assets: ReconAsset[] } }>();

  let raw = '';
  let format: 'auto' | 'subdomains' | 'httpx' | 'urls' = 'auto';

  function detectFormat(line: string): 'httpx' | 'urls' | 'subdomains' {
    if (/^https?:\/\//.test(line) && /\s\[/.test(line)) return 'httpx';
    if (/^https?:\/\//.test(line)) return 'urls';
    return 'subdomains';
  }

  function parseHttpxLine(line: string): Partial<ReconAsset> | null {
    // Example: https://api.example.com [200] [Cloudflare,nginx]
    const match = line.match(/^(https?:\/\/[^\s]+)(?:\s+\[(\d+)\])?(?:\s+\[([^\]]+)\])?(?:\s+\[([^\]]+)\])?/);
    if (!match) return null;
    const [, url, statusStr, second, third] = match;
    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();
    const technologies: string[] = [];
    let title: string | undefined;
    if (second) {
      // second could be tech or title; httpx outputs depend on flags
      if (/^\d+\s*$/.test(second)) {
        // ignore
      } else if (third) {
        title = second;
        technologies.push(...third.split(',').map((t) => t.trim()).filter(Boolean));
      } else {
        technologies.push(...second.split(',').map((t) => t.trim()).filter(Boolean));
      }
    }
    return {
      hostname,
      url,
      httpStatus: statusStr ? Number(statusStr) : undefined,
      technologies,
      title
    };
  }

  function buildAsset(partial: Partial<ReconAsset>, source: ReconAssetSource): ReconAsset {
    const now = Date.now();
    return {
      id: generateId(),
      targetId,
      hostname: partial.hostname ?? '',
      url: partial.url,
      ipAddress: partial.ipAddress,
      httpStatus: partial.httpStatus,
      title: partial.title,
      technologies: partial.technologies ?? [],
      ports: partial.ports,
      inScope: true,
      status: 'untested',
      notes: partial.notes,
      source,
      discoveredAt: now,
      createdAt: now,
      updatedAt: now
    };
  }

  function handleImport() {
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const assets: ReconAsset[] = [];
    for (const line of lines) {
      const lineFormat = format === 'auto' ? detectFormat(line) : format;
      if (lineFormat === 'httpx') {
        const parsed = parseHttpxLine(line);
        if (parsed?.hostname) assets.push(buildAsset(parsed, 'httpx'));
      } else if (lineFormat === 'urls') {
        try {
          const url = new URL(line);
          assets.push(
            buildAsset(
              { hostname: url.hostname, url: line },
              'import'
            )
          );
        } catch {
          assets.push(buildAsset({ hostname: line }, 'import'));
        }
      } else {
        // bare subdomain
        assets.push(buildAsset({ hostname: line }, 'subfinder'));
      }
    }

    dispatch('import', { assets });
    raw = '';
  }
</script>

<div class="space-y-3">
  <p class="text-xs text-muted-foreground leading-relaxed">
    Paste output from <span class="op-mono">subfinder</span>,
    <span class="op-mono">amass</span>, <span class="op-mono">httpx</span>, or any newline-delimited
    list. Format is auto-detected.
  </p>

  <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
    <textarea
      bind:value={raw}
      rows="6"
      class="hf-input font-mono text-[12.5px]"
      placeholder={`api.example.com\nadmin.example.com\nhttps://example.com/login\nhttps://api.example.com [200] [Cloudflare,nginx]`}
    ></textarea>
    <label class="block">
      <span class="hf-label">Format</span>
      <select bind:value={format} class="hf-select mt-2">
        <option value="auto">Auto-detect</option>
        <option value="subdomains">Subdomains</option>
        <option value="urls">URLs</option>
        <option value="httpx">httpx output</option>
      </select>
    </label>
  </div>

  <div class="flex items-center justify-end gap-2">
    <button
      type="button"
      class="hf-button-primary"
      disabled={!raw.trim()}
      on:click={handleImport}
    >
      Import assets
    </button>
  </div>
</div>
