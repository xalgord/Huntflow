<script lang="ts">
  import type {
    PayoutSeverity,
    Platform,
    Submission,
    SubmissionStatus,
    Target
  } from '$lib/types';
  import { generateId } from '$lib/utils/id';
  import { createEventDispatcher } from 'svelte';

  export let submission: Submission | null = null;
  export let targets: Target[] = [];
  export let submitLabel = 'Save';

  const dispatch = createEventDispatcher<{
    submit: { submission: Submission };
    cancel: void;
  }>();

  const platformOptions: { value: Platform; label: string }[] = [
    { value: 'hackerone', label: 'HackerOne' },
    { value: 'bugcrowd', label: 'Bugcrowd' },
    { value: 'intigriti', label: 'Intigriti' },
    { value: 'synack', label: 'Synack' },
    { value: 'yeswehack', label: 'YesWeHack' },
    { value: 'self-hosted', label: 'Self-hosted' },
    { value: 'other', label: 'Other' }
  ];

  const severityOptions: { value: PayoutSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Informational' }
  ];

  const statusOptions: { value: SubmissionStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'triaged', label: 'Triaged' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'informational', label: 'Informational' },
    { value: 'not-applicable', label: 'Not Applicable' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'rewarded', label: 'Rewarded' },
    { value: 'closed', label: 'Closed' }
  ];

  let title = submission?.title ?? '';
  let targetId = submission?.targetId ?? targets[0]?.id ?? '';
  let platform: Platform = submission?.platform ?? 'hackerone';
  let vulnerabilityType = submission?.vulnerabilityType ?? '';
  let severity: PayoutSeverity = submission?.severity ?? 'medium';
  let cvssScore: number | undefined = submission?.cvssScore;
  let cvssVector = submission?.cvssVector ?? '';
  let reportUrl = submission?.reportUrl ?? '';
  let status: SubmissionStatus = submission?.status ?? 'draft';
  let submittedAtInput = submission?.submittedAt
    ? new Date(submission.submittedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  let bountyAmount: number | undefined = submission?.bountyAmount;
  let notes = submission?.notes ?? '';
  let tagsInput = (submission?.tags ?? []).join(', ');

  let errorMessage = '';

  $: targetOptions = targets;

  function handleSubmit(event: Event): void {
    event.preventDefault();
    errorMessage = '';

    if (!title.trim()) {
      errorMessage = 'Title is required';
      return;
    }
    if (!targetId) {
      errorMessage = 'Pick a target';
      return;
    }

    const now = Date.now();
    const submittedAt = submittedAtInput ? new Date(submittedAtInput).getTime() : undefined;
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

    const previousTimeline = submission?.timeline ?? [];
    const lastEntry = previousTimeline[previousTimeline.length - 1];
    const timeline = [...previousTimeline];

    if (!lastEntry || lastEntry.status !== status) {
      timeline.push({
        id: generateId(),
        status,
        at: now
      });
    }

    // Coerce cleared/invalid number inputs to undefined so we never persist
    // empty strings or NaN into the typed store.
    const normalizedCvssScore =
      cvssScore == null || Number.isNaN(Number(cvssScore))
        ? undefined
        : Math.max(0, Math.min(10, Number(cvssScore)));
    const normalizedBounty =
      bountyAmount == null || Number.isNaN(Number(bountyAmount))
        ? undefined
        : Math.max(0, Number(bountyAmount));

    // Use `||` (not `??`) so an empty id from a "draft from note" prefill
    // is treated as a new submission rather than persisting with id "".
    const next: Submission = {
      id: submission?.id || generateId(),
      title: title.trim(),
      targetId,
      noteId: submission?.noteId,
      platform,
      vulnerabilityType: vulnerabilityType.trim() || undefined,
      severity,
      cvssScore: normalizedCvssScore,
      cvssVector: cvssVector.trim() || undefined,
      reportUrl: reportUrl.trim() || undefined,
      reportMarkdown: submission?.reportMarkdown,
      status,
      submittedAt: status === 'draft' ? undefined : submittedAt ?? now,
      triagedAt:
        submission?.triagedAt ??
        (['triaged', 'accepted', 'resolved', 'rewarded', 'closed'].includes(status) ? now : undefined),
      resolvedAt:
        submission?.resolvedAt ??
        (['resolved', 'rewarded', 'closed'].includes(status) ? now : undefined),
      rewardedAt:
        submission?.rewardedAt ?? (status === 'rewarded' ? now : undefined),
      bountyAmount: normalizedBounty,
      payoutIds: submission?.payoutIds ?? [],
      duplicateOf: submission?.duplicateOf,
      notes: notes.trim() || undefined,
      tags,
      timeline,
      createdAt: submission?.createdAt ?? now,
      updatedAt: now
    };

    dispatch('submit', { submission: next });
  }
</script>

<form class="space-y-4" on:submit={handleSubmit}>
  <label class="block">
    <span class="hf-label">Report Title</span>
    <input bind:value={title} class="hf-input mt-2" maxlength="200" placeholder="Stored XSS in product reviews" required />
  </label>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="hf-label">Target</span>
      <select bind:value={targetId} class="hf-select mt-2" required>
        {#each targetOptions as target}
          <option value={target.id}>{target.name}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Platform</span>
      <select bind:value={platform} class="hf-select mt-2">
        {#each platformOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="hf-label">Vulnerability Type</span>
      <input bind:value={vulnerabilityType} class="hf-input mt-2" maxlength="80" placeholder="IDOR, SSRF, XSS..." />
    </label>

    <label class="block">
      <span class="hf-label">Severity</span>
      <select bind:value={severity} class="hf-select mt-2">
        {#each severityOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="hf-label">CVSS Score</span>
      <input
        bind:value={cvssScore}
        type="number"
        step="0.1"
        min="0"
        max="10"
        class="hf-input mt-2"
        placeholder="7.5"
      />
    </label>

    <label class="block">
      <span class="hf-label">CVSS Vector</span>
      <input
        bind:value={cvssVector}
        class="hf-input mt-2 font-mono text-xs"
        placeholder="CVSS:3.1/AV:N/AC:L/..."
      />
    </label>
  </div>

  <label class="block">
    <span class="hf-label">Report URL</span>
    <input bind:value={reportUrl} type="url" class="hf-input mt-2" placeholder="https://hackerone.com/reports/..." />
  </label>

  <div class="grid gap-4 sm:grid-cols-3">
    <label class="block">
      <span class="hf-label">Status</span>
      <select bind:value={status} class="hf-select mt-2">
        {#each statusOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="hf-label">Submitted Date</span>
      <input bind:value={submittedAtInput} type="date" class="hf-input mt-2" />
    </label>

    <label class="block">
      <span class="hf-label">Bounty (USD)</span>
      <input bind:value={bountyAmount} type="number" min="0" step="0.01" class="hf-input mt-2" placeholder="500" />
    </label>
  </div>

  <label class="block">
    <span class="hf-label">Tags</span>
    <input bind:value={tagsInput} class="hf-input mt-2" placeholder="comma, separated, tags" />
  </label>

  <label class="block">
    <span class="hf-label">Notes</span>
    <textarea
      bind:value={notes}
      rows={3}
      class="mt-2 min-h-[96px] w-full resize-y rounded-md border border-zinc-600 bg-zinc-850 px-3 py-2.5 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
      placeholder="Internal notes, triage timeline observations, dupes..."
    ></textarea>
  </label>

  {#if errorMessage}
    <p class="text-sm text-red-400" role="alert">{errorMessage}</p>
  {/if}

  <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
    <button type="button" class="hf-button-secondary" on:click={() => dispatch('cancel')}>
      Cancel
    </button>
    <button type="submit" class="hf-button-primary">{submitLabel}</button>
  </div>
</form>
