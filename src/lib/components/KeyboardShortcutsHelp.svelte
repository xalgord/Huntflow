<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import {
    navTargets,
    shortcutsHelpStore,
    utilityShortcuts,
    type NavShortcut
  } from '$lib/utils/shortcuts';
  import { Keyboard } from 'lucide-svelte';

  type Group = NavShortcut['group'];

  // Combine nav and utility shortcuts then bucket by group so the cheatsheet
  // renders as ordered sections instead of a flat list.
  $: rows = [...navTargets, ...utilityShortcuts] as NavShortcut[];
  $: groups = (['Navigation', 'Actions', 'Help'] as Group[]).map((name) => ({
    name,
    items: rows.filter((row) => row.group === name)
  }));

  function close(): void {
    shortcutsHelpStore.set(false);
  }
</script>

<Modal
  open={$shortcutsHelpStore}
  title="Keyboard shortcuts"
  description="Two-key sequences fire when the second key arrives within 1.2 seconds. None of the shortcuts trigger while you're typing in a field."
  on:close={close}
>
  <div class="-mt-1 space-y-5">
    {#each groups as group}
      {#if group.items.length > 0}
        <section>
          <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {#if group.name === 'Help'}
              <Keyboard size={14} aria-hidden="true" />
            {/if}
            {group.name}
          </h3>
          <ul class="mt-2 space-y-1.5">
            {#each group.items as item}
              <li class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <div class="min-w-0">
                  <p class="truncate text-sm text-foreground">{item.label}</p>
                  {#if item.hint}
                    <p class="mt-0.5 truncate text-xs text-muted-foreground">{item.hint}</p>
                  {/if}
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  {#each item.keys as key, index}
                    <kbd
                      class="inline-flex min-w-[24px] items-center justify-center rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-inner-line"
                    >
                      {key}
                    </kbd>
                    {#if index < item.keys.length - 1 && item.keys[0].toLowerCase() === 'g'}
                      <span class="text-[10px] text-muted-foreground">then</span>
                    {/if}
                  {/each}
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>
</Modal>
