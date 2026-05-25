<script lang="ts">
  import { Crosshair, FileText, Hash } from 'lucide-svelte';

  const notes = [
    { title: 'SSRF in image proxy', target: 'Tesla', active: true },
    { title: 'IDOR on /api/users/:id', target: 'GitLab', active: false },
    { title: 'Auth bypass via JWT alg=none', target: 'Coinbase', active: false },
    { title: 'XSS in search bar (reflected)', target: 'Shopify', active: false },
    { title: 'Race condition in checkout', target: 'GitHub', active: false }
  ];
</script>

<div class="grid h-full grid-cols-[180px_220px_1fr] bg-zinc-950 text-zinc-200">
  <aside class="flex flex-col gap-1 border-r border-zinc-900 bg-zinc-950 p-3">
    <div class="mb-3 flex items-center gap-2 px-1.5 py-1.5">
      <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-zinc-950">
        <Crosshair size={14} aria-hidden="true" />
      </span>
      <span class="text-xs font-semibold tracking-tight text-zinc-100">HuntFlow</span>
    </div>
    {#each ['Dashboard', 'Timer', 'Targets', 'Notes', 'Evidence', 'Stats', 'Income'] as item, i}
      <div
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] {i === 3
          ? 'bg-primary-500/10 text-primary-200'
          : 'text-zinc-500'}"
      >
        <span class="h-1 w-1 rounded-full {i === 3 ? 'bg-primary-400' : 'bg-zinc-700'}"></span>
        {item}
      </div>
    {/each}
  </aside>

  <div class="overflow-hidden border-r border-zinc-900 bg-zinc-950 p-3">
    <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Vault &middot; 24 notes</p>
    {#each notes as n}
      <div
        class="mb-1.5 rounded-md border p-2 {n.active
          ? 'border-primary-500/30 bg-primary-500/5'
          : 'border-zinc-800 bg-zinc-900'}"
      >
        <div class="flex items-center gap-1.5">
          <FileText size={10} class={n.active ? 'text-primary-300' : 'text-zinc-500'} aria-hidden="true" />
          <p class="truncate text-[11px] {n.active ? 'text-zinc-100' : 'text-zinc-300'}">{n.title}</p>
        </div>
        <p class="mt-0.5 truncate pl-3.5 text-[9px] text-zinc-500">{n.target}</p>
      </div>
    {/each}
  </div>

  <div class="overflow-hidden p-5">
    <div class="flex items-center gap-2">
      <h2 class="text-base font-semibold text-zinc-100">SSRF in image proxy</h2>
      <span class="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-200">High</span>
    </div>
    <div class="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-500">
      <Hash size={10} aria-hidden="true" />
      <span>tesla &middot; ssrf &middot; recon &middot; image-proxy</span>
    </div>

    <div class="mt-4 space-y-2.5 text-[11px] leading-5 text-zinc-300">
      <p class="text-xs font-semibold text-zinc-100">Steps to reproduce</p>
      <ol class="ml-3 list-decimal space-y-0.5 text-[11px] text-zinc-300">
        <li>Authenticate as a regular user.</li>
        <li>POST to <span class="rounded bg-zinc-800 px-1 font-mono text-[10px] text-emerald-300">/api/image-proxy</span> with a crafted URL.</li>
        <li>Observe the server fetches arbitrary internal endpoints.</li>
      </ol>

      <pre class="mt-2 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[10px] leading-4 text-zinc-300"><span class="text-emerald-300">curl</span> -X POST https://target.tld/api/image-proxy \
  -H <span class="text-amber-300">"Authorization: Bearer $TOKEN"</span> \
  -d <span class="text-amber-300">'&#123;"url":"http://169.254.169.254/latest/meta-data/"&#125;'</span></pre>

      <p class="text-xs font-semibold text-zinc-100">Impact</p>
      <p>Internal metadata service exposed; potential pivot to credentials.</p>
    </div>
  </div>
</div>
