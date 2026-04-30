<script lang="ts">
  import type { EvidenceAsset, HttpExchangeMeta } from '$lib/types';
  import { toCurl } from '$lib/utils/http';
  import type { HttpRequest } from '$lib/utils/http';
  import {
    ChevronDown,
    ChevronRight,
    Clipboard,
    Code,
    Copy,
    Globe,
    Terminal
  } from 'lucide-svelte';

  export let asset: EvidenceAsset;

  $: meta = asset.httpExchange;
  $: requestHeaders = meta?.requestRaw ? parseHeadersFromRaw(meta.requestRaw) : [];
  $: responseHeaders = meta?.responseRaw ? parseHeadersFromRaw(meta.responseRaw) : [];
  $: requestBody = meta?.requestRaw ? extractBody(meta.requestRaw) : '';
  $: responseBody = meta?.responseRaw ? extractBody(meta.responseRaw) : '';
  $: statusClass = statusColorClass(meta?.statusCode);

  let showRequestHeaders = false;
  let showResponseHeaders = false;
  let copyFeedback = '';

  function parseHeadersFromRaw(raw: string): Array<{ name: string; value: string }> {
    const normalized = raw.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const headers: Array<{ name: string; value: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === '' || line.trim() === '') break;
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const name = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (name) headers.push({ name, value });
    }
    return headers;
  }

  function extractBody(raw: string): string {
    const normalized = raw.replace(/\r\n/g, '\n');
    const parts = normalized.split('\n\n');
    if (parts.length < 2) return '';
    return parts.slice(1).join('\n\n').replace(/\n+$/, '');
  }

  function statusColorClass(code: number | undefined): string {
    if (!code) return 'text-muted-foreground';
    if (code >= 200 && code < 300) return 'text-emerald-400';
    if (code >= 300 && code < 400) return 'text-amber-400';
    if (code >= 400 && code < 500) return 'text-orange-400';
    if (code >= 500) return 'text-red-400';
    return 'text-muted-foreground';
  }

  function methodBadgeClass(method: string | undefined): string {
    const m = (method ?? '').toUpperCase();
    if (m === 'GET') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (m === 'POST') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (m === 'PUT' || m === 'PATCH') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (m === 'DELETE') return 'bg-red-500/20 text-red-300 border-red-500/30';
    return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
  }

  async function copyText(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = label;
      setTimeout(() => (copyFeedback = ''), 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => (copyFeedback = ''), 2000);
    }
  }

  async function copyAsCurl(): Promise<void> {
    if (!meta) return;
    const headers = requestHeaders.map((h) => ({ name: h.name, value: h.value }));
    const request: HttpRequest = {
      method: meta.method,
      url: meta.url,
      headers,
      body: requestBody || undefined
    };
    await copyText(toCurl(request), 'Copied as cURL');
  }

  async function copyRawRequest(): Promise<void> {
    if (!meta?.requestRaw) return;
    await copyText(meta.requestRaw, 'Copied request');
  }

  async function copyRawResponse(): Promise<void> {
    if (!meta?.responseRaw) return;
    await copyText(meta.responseRaw, 'Copied response');
  }

  async function copyFullExchange(): Promise<void> {
    if (!asset.textContent) return;
    await copyText(asset.textContent, 'Copied full exchange');
  }
</script>

{#if meta}
  <div class="http-exchange-inspector">
    <!-- Method + URL + Status hero -->
    <div class="hero-bar">
      <span class="method-badge {methodBadgeClass(meta.method)}">{meta.method}</span>
      <span class="url-text" title={meta.url}>{meta.url}</span>
      {#if meta.statusCode}
        <span class="status-badge {statusClass}">
          {meta.statusCode}
          {#if meta.statusText}
            <span class="status-text">{meta.statusText}</span>
          {/if}
        </span>
      {/if}
    </div>

    {#if meta.host || meta.httpVersion || meta.durationMs}
      <div class="meta-row">
        {#if meta.host}
          <span class="meta-chip">
            <Globe size={12} aria-hidden="true" />
            {meta.host}
          </span>
        {/if}
        {#if meta.httpVersion}
          <span class="meta-chip">{meta.httpVersion}</span>
        {/if}
        {#if meta.durationMs}
          <span class="meta-chip">{meta.durationMs}ms</span>
        {/if}
      </div>
    {/if}

    <!-- Action buttons -->
    <div class="actions-row">
      <button type="button" class="action-btn" on:click={copyAsCurl} title="Copy as cURL command">
        <Terminal size={14} aria-hidden="true" />
        cURL
      </button>
      {#if meta.requestRaw}
        <button type="button" class="action-btn" on:click={copyRawRequest} title="Copy raw request">
          <Copy size={14} aria-hidden="true" />
          Request
        </button>
      {/if}
      {#if meta.responseRaw}
        <button type="button" class="action-btn" on:click={copyRawResponse} title="Copy raw response">
          <Copy size={14} aria-hidden="true" />
          Response
        </button>
      {/if}
      {#if asset.textContent}
        <button type="button" class="action-btn" on:click={copyFullExchange} title="Copy full exchange">
          <Clipboard size={14} aria-hidden="true" />
          Full
        </button>
      {/if}
      {#if copyFeedback}
        <span class="copy-feedback">{copyFeedback}</span>
      {/if}
    </div>

    <!-- Request section -->
    {#if meta.requestRaw}
      <div class="section">
        <button
          type="button"
          class="section-header"
          on:click={() => (showRequestHeaders = !showRequestHeaders)}
        >
          {#if showRequestHeaders}
            <ChevronDown size={14} aria-hidden="true" />
          {:else}
            <ChevronRight size={14} aria-hidden="true" />
          {/if}
          <span class="section-title">Request headers</span>
          <span class="header-count">{requestHeaders.length}</span>
        </button>
        {#if showRequestHeaders}
          <div class="headers-table">
            {#each requestHeaders as header}
              <div class="header-row">
                <span class="header-name">{header.name}</span>
                <span class="header-value">{header.value}</span>
              </div>
            {/each}
          </div>
        {/if}
        {#if requestBody}
          <div class="body-block">
            <div class="body-label">
              <Code size={12} aria-hidden="true" />
              Request body
            </div>
            <pre class="body-content">{requestBody}</pre>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Response section -->
    {#if meta.responseRaw}
      <div class="section">
        <button
          type="button"
          class="section-header"
          on:click={() => (showResponseHeaders = !showResponseHeaders)}
        >
          {#if showResponseHeaders}
            <ChevronDown size={14} aria-hidden="true" />
          {:else}
            <ChevronRight size={14} aria-hidden="true" />
          {/if}
          <span class="section-title">Response headers</span>
          <span class="header-count">{responseHeaders.length}</span>
        </button>
        {#if showResponseHeaders}
          <div class="headers-table">
            {#each responseHeaders as header}
              <div class="header-row">
                <span class="header-name">{header.name}</span>
                <span class="header-value">{header.value}</span>
              </div>
            {/each}
          </div>
        {/if}
        {#if responseBody}
          <div class="body-block">
            <div class="body-label">
              <Code size={12} aria-hidden="true" />
              Response body
            </div>
            <pre class="body-content">{responseBody}</pre>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{:else if asset.textContent}
  <!-- Fallback: raw text when no structured httpExchange metadata -->
  <pre class="max-h-[420px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-200">{asset.textContent}</pre>
{/if}

<style>
  .http-exchange-inspector {
    padding: 0;
    overflow: hidden;
  }

  .hero-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .method-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 6px;
    border: 1px solid;
    font-size: 0.75rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .url-text {
    font-size: 0.8125rem;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    color: var(--foreground, #e4e4e7);
    word-break: break-all;
    min-width: 0;
    flex: 1;
  }

  .status-badge {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  }

  .status-text {
    font-weight: 500;
    margin-left: 0.25rem;
    opacity: 0.7;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    flex-wrap: wrap;
  }

  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--muted-foreground, #a1a1aa);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
  }

  .actions-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--muted-foreground, #a1a1aa);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    color: var(--foreground, #e4e4e7);
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .copy-feedback {
    font-size: 0.6875rem;
    color: #34d399;
    animation: fadeIn 0.2s ease;
  }

  .section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .section:last-child {
    border-bottom: none;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted-foreground, #a1a1aa);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: color 0.15s ease;
  }

  .section-header:hover {
    color: var(--foreground, #e4e4e7);
  }

  .section-title {
    flex: 1;
  }

  .header-count {
    font-size: 0.625rem;
    color: var(--muted-foreground, #a1a1aa);
    background: rgba(255, 255, 255, 0.06);
    padding: 0 0.375rem;
    border-radius: 9999px;
    font-weight: 500;
  }

  .headers-table {
    padding: 0 1rem 0.5rem;
  }

  .header-row {
    display: grid;
    grid-template-columns: minmax(120px, auto) 1fr;
    gap: 0.75rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    font-size: 0.6875rem;
    line-height: 1.4;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  }

  .header-row:last-child {
    border-bottom: none;
  }

  .header-name {
    color: #818cf8;
    font-weight: 500;
    word-break: break-all;
  }

  .header-value {
    color: var(--foreground, #e4e4e7);
    word-break: break-all;
    opacity: 0.85;
  }

  .body-block {
    padding: 0 1rem 0.75rem;
  }

  .body-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--muted-foreground, #a1a1aa);
    margin-bottom: 0.375rem;
  }

  .body-content {
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    line-height: 1.5;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    color: #d4d4d8;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    margin: 0;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
