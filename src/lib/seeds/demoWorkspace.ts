/**
 * Demo workspace generator. Builds a small but realistic dataset across
 * targets, sessions, notes, recon assets, submissions, payouts, and a
 * checklist instance — so first-run users immediately see HuntFlow's value
 * instead of an empty UI.
 *
 * Important: this is additive. It does NOT clear existing data — callers
 * decide whether to wipe first (the onboarding `Load demo` flow does, the
 * DataSettings button asks for confirmation).
 */

import {
  bookmarkStore,
  checklistInstanceStore,
  noteStore,
  payoutStore,
  reconAssetStore,
  sessionStore,
  submissionStore,
  targetStore
} from '$lib/stores';
import type {
  ChecklistInstance,
  Note,
  Payout,
  ReconAsset,
  Session,
  Submission,
  Target
} from '$lib/types';

const DAY = 24 * 60 * 60 * 1000;

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function makeTarget(name: string, partial: Partial<Target> & Pick<Target, 'platform'>): Target {
  const now = Date.now();
  return {
    id: randomId('demo-tgt'),
    name,
    platform: partial.platform,
    programUrl: partial.programUrl,
    scope: partial.scope ?? '',
    notes: partial.notes ?? '',
    priority: partial.priority ?? 1,
    status: partial.status ?? 'testing',
    createdAt: partial.createdAt ?? now - 14 * DAY,
    updatedAt: partial.updatedAt ?? now,
    lastSessionAt: partial.lastSessionAt,
    sessionCount: partial.sessionCount ?? 0
  };
}

function makeSession(
  targetId: string,
  startedAtOffset: number,
  partial: Partial<Session> = {}
): Session {
  const now = Date.now();
  const startedAt = now - startedAtOffset;
  const planned = partial.durationPlanned ?? 1500;
  const actual = partial.durationActual ?? planned;
  return {
    id: randomId('demo-ses'),
    targetId,
    templateId: partial.templateId,
    durationPlanned: planned,
    durationActual: actual,
    startedAt,
    endedAt: startedAt + actual * 1000,
    status: partial.status ?? 'completed',
    quickNote: partial.quickNote,
    tags: partial.tags ?? []
  };
}

function makeNote(targetId: string, title: string, content: string, daysAgo: number): Note {
  const now = Date.now() - daysAgo * DAY;
  return {
    id: randomId('demo-note'),
    title,
    content,
    targetId,
    tags: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeRecon(targetId: string, hostname: string, partial: Partial<ReconAsset> = {}): ReconAsset {
  const now = Date.now();
  return {
    id: randomId('demo-rec'),
    targetId,
    hostname,
    url: partial.url,
    ipAddress: partial.ipAddress,
    status: partial.status ?? 'untested',
    inScope: partial.inScope ?? true,
    httpStatus: partial.httpStatus,
    title: partial.title,
    technologies: partial.technologies ?? [],
    ports: partial.ports,
    notes: partial.notes,
    source: partial.source ?? 'manual',
    discoveredAt: partial.discoveredAt ?? now - 5 * DAY,
    lastTestedAt: partial.lastTestedAt,
    createdAt: now - 5 * DAY,
    updatedAt: now
  };
}

function makeSubmission(
  targetId: string,
  partial: Partial<Submission> & Pick<Submission, 'title' | 'platform' | 'severity'>
): Submission {
  const now = Date.now();
  return {
    id: randomId('demo-sub'),
    title: partial.title,
    targetId,
    noteId: partial.noteId,
    platform: partial.platform,
    vulnerabilityType: partial.vulnerabilityType,
    severity: partial.severity,
    cvssScore: partial.cvssScore,
    cvssVector: partial.cvssVector,
    reportUrl: partial.reportUrl,
    reportMarkdown: partial.reportMarkdown,
    status: partial.status ?? 'submitted',
    submittedAt: partial.submittedAt ?? now - 10 * DAY,
    triagedAt: partial.triagedAt,
    resolvedAt: partial.resolvedAt,
    rewardedAt: partial.rewardedAt,
    bountyAmount: partial.bountyAmount,
    payoutIds: partial.payoutIds ?? [],
    duplicateOf: partial.duplicateOf,
    notes: partial.notes,
    tags: partial.tags ?? [],
    timeline: partial.timeline ?? [
      { id: randomId('tl'), status: 'submitted', at: now - 10 * DAY, note: 'Report sent.' }
    ],
    createdAt: now - 11 * DAY,
    updatedAt: now
  };
}

export interface DemoLoadOptions {
  /**
   * If true, append to existing data without prompting. The DataSettings
   * caller is expected to have already confirmed with the user.
   */
  silent?: boolean;
}

export interface DemoLoadResult {
  targets: number;
  sessions: number;
  notes: number;
  reconAssets: number;
  submissions: number;
  payouts: number;
  checklistInstances: number;
}

export async function loadDemoWorkspace(_options: DemoLoadOptions = {}): Promise<DemoLoadResult> {
  // Build a coherent storyline across three targets at different stages.
  const targets: Target[] = [
    makeTarget('Acme Bug Bounty', {
      platform: 'hackerone',
      programUrl: 'https://hackerone.com/acme',
      scope: '+ *.acme.com\n+ api.acme.com/v1/*\n- admin.acme.com\n- *.staging.acme.com',
      priority: 0,
      status: 'testing',
      sessionCount: 7,
      lastSessionAt: Date.now() - 1 * DAY,
      notes: 'IDOR-prone account API, JWT auth. Triagers respond within 48h.'
    }),
    makeTarget('Globex Public', {
      platform: 'bugcrowd',
      programUrl: 'https://bugcrowd.com/globex',
      scope: '+ globex.com\n+ *.globex.com\n+ shop.globex.com/api/*\n- legacy.globex.com',
      priority: 1,
      status: 'testing',
      sessionCount: 4,
      lastSessionAt: Date.now() - 3 * DAY,
      notes: 'Shopify-style storefront. Promotion logic looks tasty.'
    }),
    makeTarget('Initech Lite', {
      platform: 'self-hosted',
      programUrl: 'https://security.initech.io',
      scope: '+ initech.io\n+ *.initech.io',
      priority: 2,
      status: 'testing',
      sessionCount: 1,
      notes: 'Recently launched. Smaller surface, less competition.'
    })
  ];

  // Sessions distributed across the past two weeks for streak/heatmap data.
  const sessions: Session[] = [];
  const dayOffsets = [0.4, 1, 1.2, 2, 4, 5, 5.3, 7, 8, 9, 10, 12];
  dayOffsets.forEach((d, i) => {
    const target = targets[i % 3];
    sessions.push(
      makeSession(target.id, d * DAY, {
        durationPlanned: i % 3 === 0 ? 2700 : 1500,
        durationActual: i % 3 === 0 ? 2700 : 1500,
        tags: i % 4 === 0 ? ['high'] : i % 5 === 0 ? ['informative'] : []
      })
    );
  });
  // One paused session — proves the timer page handles resume correctly.
  sessions.push(
    makeSession(targets[0].id, 0.05 * DAY, {
      durationPlanned: 1500,
      durationActual: 612,
      status: 'paused'
    })
  );

  const notes: Note[] = [
    makeNote(
      targets[0].id,
      'IDOR on /v1/users/{id}/orders',
      [
        '## Summary',
        'Authenticated users can read other users\' order history by changing the `id` path parameter.',
        '',
        '## Reproduction',
        '1. Login as user A and capture session cookie',
        '2. GET /v1/users/<userB_id>/orders',
        '3. Server returns 200 with userB\'s orders',
        '',
        '## Impact',
        'Sensitive PII disclosure across tenants.'
      ].join('\n'),
      1
    ),
    makeNote(
      targets[0].id,
      'JWT alg=none acceptance',
      'Backend appears to honor JWTs with `alg: none` — high impact, draft report in progress.',
      2
    ),
    makeNote(
      targets[1].id,
      'Discount stacking via race condition',
      'Two parallel POSTs to /apply-promo allow multiple single-use coupons to apply.',
      4
    ),
    makeNote(
      targets[2].id,
      'Initial recon notes',
      'Wappalyzer flags Next.js 14 + Stripe Checkout. No subdomain takeovers found.',
      6
    )
  ];

  const recon: ReconAsset[] = [
    makeRecon(targets[0].id, 'api.acme.com', {
      url: 'https://api.acme.com',
      httpStatus: 200,
      title: 'Acme API',
      technologies: ['nginx', 'Node.js', 'GraphQL'],
      ports: [443],
      status: 'in-progress',
      source: 'httpx'
    }),
    makeRecon(targets[0].id, 'auth.acme.com', {
      url: 'https://auth.acme.com',
      httpStatus: 200,
      title: 'Acme Identity',
      technologies: ['Auth0'],
      ports: [443],
      status: 'tested',
      source: 'subfinder'
    }),
    makeRecon(targets[0].id, 'cdn.acme.com', {
      url: 'https://cdn.acme.com',
      httpStatus: 403,
      technologies: ['CloudFront'],
      ports: [443],
      status: 'untested',
      source: 'crt-sh'
    }),
    makeRecon(targets[1].id, 'shop.globex.com', {
      url: 'https://shop.globex.com',
      httpStatus: 200,
      title: 'Globex Shop',
      technologies: ['Shopify'],
      ports: [443],
      status: 'vulnerable',
      source: 'manual',
      notes: 'Race-condition coupon stacking confirmed.'
    }),
    makeRecon(targets[1].id, 'legacy.globex.com', {
      url: 'https://legacy.globex.com',
      httpStatus: 200,
      technologies: ['Apache 2.2'],
      ports: [80, 443],
      status: 'out-of-scope',
      inScope: false,
      source: 'wayback'
    }),
    makeRecon(targets[2].id, 'initech.io', {
      url: 'https://initech.io',
      httpStatus: 200,
      title: 'Initech',
      technologies: ['Next.js', 'Vercel'],
      ports: [443],
      status: 'untested',
      source: 'manual'
    })
  ];

  const payoutId = randomId('demo-pay');
  const submissions: Submission[] = [
    makeSubmission(targets[1].id, {
      title: 'Race condition allows coupon stacking',
      platform: 'bugcrowd',
      severity: 'medium',
      vulnerabilityType: 'Business Logic',
      cvssScore: 5.3,
      status: 'rewarded',
      submittedAt: Date.now() - 12 * DAY,
      triagedAt: Date.now() - 10 * DAY,
      resolvedAt: Date.now() - 5 * DAY,
      rewardedAt: Date.now() - 4 * DAY,
      bountyAmount: 500,
      payoutIds: [payoutId],
      tags: ['logic', 'rewarded'],
      timeline: [
        { id: randomId('tl'), status: 'submitted', at: Date.now() - 12 * DAY },
        { id: randomId('tl'), status: 'triaged', at: Date.now() - 10 * DAY, note: 'Reproduced by triage.' },
        { id: randomId('tl'), status: 'resolved', at: Date.now() - 5 * DAY },
        { id: randomId('tl'), status: 'rewarded', at: Date.now() - 4 * DAY, note: '$500 paid.' }
      ]
    }),
    makeSubmission(targets[0].id, {
      title: 'IDOR on /v1/users/{id}/orders',
      platform: 'hackerone',
      severity: 'high',
      vulnerabilityType: 'IDOR',
      cvssScore: 7.5,
      status: 'triaged',
      submittedAt: Date.now() - 2 * DAY,
      triagedAt: Date.now() - 1 * DAY,
      tags: ['idor', 'pii'],
      timeline: [
        { id: randomId('tl'), status: 'submitted', at: Date.now() - 2 * DAY },
        { id: randomId('tl'), status: 'triaged', at: Date.now() - 1 * DAY, note: 'Bumped to high.' }
      ]
    })
  ];

  const payouts: Payout[] = [
    {
      id: payoutId,
      program: 'Globex Public',
      platform: 'bugcrowd',
      severity: 'medium',
      amount: 500,
      date: Date.now() - 4 * DAY,
      status: 'paid',
      submissionId: submissions[0].id,
      createdAt: Date.now() - 4 * DAY,
      updatedAt: Date.now() - 4 * DAY
    }
  ];

  // One in-progress checklist instance attached to a built-in template if one
  // exists. We do not assume any specific template id; we just create a
  // standalone instance the user can wire to a real template later.
  const now = Date.now();
  const checklistInstance: ChecklistInstance = {
    id: randomId('demo-ck'),
    templateId: 'demo-template',
    targetId: targets[0].id,
    templateName: 'Demo · Account Security',
    templateKind: 'web',
    itemStates: {
      'item-1': { status: 'done', updatedAt: now - 1 * DAY, notes: 'IDOR confirmed and reported.' },
      'item-2': { status: 'in-progress', updatedAt: now - 2 * DAY },
      'item-3': { status: 'todo', updatedAt: now - 3 * DAY }
    },
    notes: 'Demo checklist showing how the methodology view tracks coverage.',
    createdAt: now - 5 * DAY,
    updatedAt: now
  };

  // Make sure stores are loaded before we batch-insert (load is idempotent).
  await Promise.all([
    targetStore.load(),
    sessionStore.load(),
    noteStore.load(),
    payoutStore.load(),
    submissionStore.load(),
    reconAssetStore.load(),
    bookmarkStore.load(),
    checklistInstanceStore.load()
  ]);

  for (const t of targets) await targetStore.put(t);
  for (const s of sessions) await sessionStore.put(s);
  for (const n of notes) await noteStore.put(n);
  for (const r of recon) await reconAssetStore.put(r);
  for (const sub of submissions) await submissionStore.put(sub);
  for (const p of payouts) await payoutStore.put(p);
  await checklistInstanceStore.put(checklistInstance);

  // Persist immediately so a tab close right after demo load still saves.
  await Promise.all([
    targetStore.persistNow(),
    sessionStore.persistNow(),
    noteStore.persistNow(),
    reconAssetStore.persistNow(),
    submissionStore.persistNow(),
    payoutStore.persistNow(),
    checklistInstanceStore.persistNow()
  ]);

  return {
    targets: targets.length,
    sessions: sessions.length,
    notes: notes.length,
    reconAssets: recon.length,
    submissions: submissions.length,
    payouts: payouts.length,
    checklistInstances: 1
  };
}
