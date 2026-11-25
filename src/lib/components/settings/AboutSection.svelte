<script lang="ts">
  import { APP_VERSION } from '$lib/buildTarget';
  import { ChevronRight, Github, Lock, MessageCircle } from 'lucide-svelte';

  const REPO = 'https://github.com/xalgord/huntflow';
</script>

<section class="hf-card overflow-hidden" aria-labelledby="about-heading">
  <div class="px-4 pb-2 pt-4">
    <h2 id="about-heading" class="hf-section-title">About</h2>
  </div>
  <ul class="hf-list border-t-[0.5px] border-zinc-900">
    <li class="hf-list-row justify-between">
      <span class="text-zinc-100">HuntFlow</span>
      <span class="text-xs text-zinc-500">Version {APP_VERSION}</span>
    </li>
    <li>
      <a class="hf-list-row" href={`${REPO}/issues/new`} target="_blank" rel="noreferrer">
        <MessageCircle size={17} class="text-blue-500" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block text-zinc-100">Send feedback</span>
          <span class="block text-xs text-zinc-500">Report a bug or ask for a feature on GitHub</span>
        </span>
        <ChevronRight size={15} class="text-zinc-600" aria-hidden="true" />
      </a>
    </li>
    <li>
      <a class="hf-list-row" href={REPO} target="_blank" rel="noreferrer">
        <Github size={17} class="text-zinc-400" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block text-zinc-100">Source code</span>
          <span class="block text-xs text-zinc-500">Open source under the MIT license</span>
        </span>
        <ChevronRight size={15} class="text-zinc-600" aria-hidden="true" />
      </a>
    </li>
    <li class="hf-list-row">
      <Lock size={17} class="text-green-500" aria-hidden="true" />
      <span class="min-w-0 flex-1">
        <span class="block text-zinc-100">Privacy</span>
        <span class="block text-xs text-zinc-500">Your workspace stays on this device unless you export it or turn on sync. No telemetry.</span>
      </span>
    </li>
  </ul>
</section>
