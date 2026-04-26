import type { EvidenceAsset, EvidenceLink, Note, Session, Target } from '$lib/types';
import {
  cloudEvidenceQuotaError,
  deriveEvidenceGraph,
  EVIDENCE_CLOUD_MAX_FILE_SIZE,
  EVIDENCE_CLOUD_MAX_SYNC_BYTES,
  evidenceKindFromFile,
  folderPathFromRelativePath,
  normalizeEvidencePath,
  totalEvidenceBytes,
  validateEvidenceFile
} from './evidence';
import { describe, expect, it } from 'vitest';

const target: Target = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'NeonBank',
  platform: 'hackerone',
  scope: '*.neonbank.test',
  notes: '',
  priority: 1,
  status: 'testing',
  createdAt: 1,
  updatedAt: 2,
  sessionCount: 1
};

const session: Session = {
  id: '22222222-2222-4222-8222-222222222222',
  targetId: target.id,
  durationPlanned: 1500,
  durationActual: 900,
  startedAt: 3,
  endedAt: 4,
  status: 'completed',
  tags: ['high']
};

const note: Note = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'OAuth proof',
  content: 'Replay proof',
  targetId: target.id,
  sessionId: session.id,
  tags: ['needs-report'],
  createdAt: 5,
  updatedAt: 6
};

function asset(overrides: Partial<EvidenceAsset> = {}): EvidenceAsset {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Replay screenshot',
    kind: 'image',
    source: 'upload',
    mimeType: 'image/png',
    size: 1234,
    fileName: 'replay.png',
    targetId: target.id,
    sessionId: session.id,
    noteId: note.id,
    tags: ['high', 'needs-report'],
    syncState: 'pending-upload',
    capturedAt: 7,
    createdAt: 7,
    updatedAt: 7,
    ...overrides
  };
}

describe('evidence utilities', () => {
  it('normalizes file types into evidence kinds', () => {
    expect(evidenceKindFromFile({ name: 'proof.png', type: 'image/png' } as File)).toBe('image');
    expect(evidenceKindFromFile({ name: 'report.pdf', type: 'application/pdf' } as File)).toBe('pdf');
    expect(evidenceKindFromFile({ name: 'request.log', type: 'text/plain' } as File)).toBe('text');
    expect(evidenceKindFromFile({ name: 'bundle.zip', type: 'application/zip' } as File)).toBe('archive');
  });

  it('allows local files without size quotas and reports cloud quota limits separately', () => {
    expect(validateEvidenceFile({ name: 'huge-proof.bin', size: EVIDENCE_CLOUD_MAX_FILE_SIZE * 2 }).valid).toBe(true);
    expect(cloudEvidenceQuotaError(EVIDENCE_CLOUD_MAX_FILE_SIZE + 1, 0)).toBe(
      'Cloud sync supports evidence files up to 100MB.'
    );
    expect(cloudEvidenceQuotaError(2, EVIDENCE_CLOUD_MAX_SYNC_BYTES)).toBe(
      'Cloud evidence storage quota is 1GB per user.'
    );
  });

  it('normalizes folder paths for organized evidence uploads', () => {
    expect(normalizeEvidencePath('\\neonbank//oauth/replay.png')).toBe('neonbank/oauth/replay.png');
    expect(folderPathFromRelativePath('neonbank/oauth/replay.png')).toBe('neonbank/oauth');
    expect(folderPathFromRelativePath('replay.png')).toBeUndefined();
  });

  it('sums non-url asset bytes only', () => {
    expect(totalEvidenceBytes([asset(), asset({ id: '66666666-6666-4666-8666-666666666666', kind: 'url', source: 'url', size: 0 })])).toBe(1234);
  });

  it('derives target, session, note, asset, URL nodes and explicit edges', () => {
    const screenshot = asset();
    const url = asset({
      id: '66666666-6666-4666-8666-666666666666',
      title: 'Callback URL',
      kind: 'url',
      source: 'url',
      mimeType: 'text/uri-list',
      size: 0,
      url: 'https://app.neonbank.test/callback'
    });
    const link: EvidenceLink = {
      id: '77777777-7777-4777-8777-777777777777',
      fromType: 'asset',
      fromId: screenshot.id,
      fromKey: `asset:${screenshot.id}`,
      toType: 'url',
      toId: url.id,
      toKey: `url:${url.id}`,
      relationship: 'proves',
      createdAt: 8,
      updatedAt: 8
    };

    const graph = deriveEvidenceGraph({
      assets: [screenshot, url],
      links: [link],
      targets: [target],
      sessions: [session],
      notes: [note]
    });

    expect(graph.nodes.map((node) => node.type).sort()).toEqual(['asset', 'note', 'session', 'target', 'url']);
    expect(graph.edges.some((edge) => edge.relationship === 'proves')).toBe(true);
    expect(graph.edges.some((edge) => edge.relationship === 'belongs-to')).toBe(true);
  });

  it('adds visible folder connectors for assets from the same folder', () => {
    const first = asset({
      id: '88888888-8888-4888-8888-888888888888',
      title: 'request trace',
      targetId: undefined,
      sessionId: undefined,
      noteId: undefined,
      relativePath: 'exports/request.log',
      folderPath: 'exports'
    });
    const second = asset({
      id: '99999999-9999-4999-8999-999999999999',
      title: 'response trace',
      targetId: undefined,
      sessionId: undefined,
      noteId: undefined,
      relativePath: 'exports/response.log',
      folderPath: 'exports'
    });

    const graph = deriveEvidenceGraph({
      assets: [first, second],
      links: [],
      targets: [],
      sessions: [],
      notes: []
    });

    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        relationship: 'belongs-to',
        label: 'exports'
      })
    );
  });
});
