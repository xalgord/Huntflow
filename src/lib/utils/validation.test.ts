import { describe, expect, it } from 'vitest';
import {
  isValidUUID,
  isValidURL,
  isValidNoteTag,
  isValidSessionTag,
  isValidPlatform,
  isValidPriority,
  isValidTargetStatus,
  isValidTemplateCategory,
  validateTarget,
  validateSession,
  validateNote,
  validateEvidenceAsset,
  validateEvidenceLink,
  validateEvidenceCanvasView,
  validateNoteTemplate,
  validateSettings
} from './validation';

describe('isValidUUID', () => {
  it('accepts valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
  });

  it('rejects non-v4 UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('rejects v4 UUID with invalid variant bits', () => {
    expect(isValidUUID('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
  });
});

describe('isValidURL', () => {
  it('accepts valid URLs', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('http://localhost:3000/path?q=1')).toBe(true);
    expect(isValidURL('ftp://files.example.com/doc.pdf')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidURL('')).toBe(false);
    expect(isValidURL('not a url')).toBe(false);
    expect(isValidURL('foo')).toBe(false);
  });
});

describe('isValidNoteTag', () => {
  it('accepts alphanumeric tags with hyphens and underscores', () => {
    expect(isValidNoteTag('xss')).toBe(true);
    expect(isValidNoteTag('my-tag')).toBe(true);
    expect(isValidNoteTag('tag_1')).toBe(true);
    expect(isValidNoteTag('A')).toBe(true);
  });

  it('rejects empty or too-long tags', () => {
    expect(isValidNoteTag('')).toBe(false);
    expect(isValidNoteTag('a'.repeat(31))).toBe(false);
  });

  it('rejects tags with special characters', () => {
    expect(isValidNoteTag('tag with space')).toBe(false);
    expect(isValidNoteTag('tag@special')).toBe(false);
  });
});

describe('isValidSessionTag', () => {
  it('accepts all valid session tags', () => {
    const valid = ['critical', 'high', 'medium', 'low', 'needs-report', 'duplicate', 'informative', 'wont-fix'];
    for (const tag of valid) {
      expect(isValidSessionTag(tag)).toBe(true);
    }
  });

  it('rejects invalid session tags', () => {
    expect(isValidSessionTag('unknown')).toBe(false);
    expect(isValidSessionTag('')).toBe(false);
  });
});

describe('isValidPlatform', () => {
  it('accepts all valid platforms', () => {
    const valid = ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'yeswehack', 'self-hosted', 'other'];
    for (const platform of valid) {
      expect(isValidPlatform(platform)).toBe(true);
    }
  });

  it('rejects invalid platforms', () => {
    expect(isValidPlatform('unknown')).toBe(false);
  });
});

describe('isValidPriority', () => {
  it('accepts 0-3', () => {
    for (let i = 0; i <= 3; i++) expect(isValidPriority(i)).toBe(true);
  });

  it('rejects values outside 0-3', () => {
    expect(isValidPriority(4)).toBe(false);
    expect(isValidPriority(-1)).toBe(false);
  });
});

describe('isValidTargetStatus', () => {
  it('accepts all valid statuses', () => {
    const valid = ['recon', 'testing', 'reported', 'paid', 'closed', 'archived'];
    for (const status of valid) expect(isValidTargetStatus(status)).toBe(true);
  });

  it('rejects invalid statuses', () => {
    expect(isValidTargetStatus('invalid')).toBe(false);
  });
});

describe('isValidTemplateCategory', () => {
  it('accepts all valid categories', () => {
    const valid = ['web', 'mobile', 'api', 'cloud', 'network', 'general'];
    for (const cat of valid) expect(isValidTemplateCategory(cat)).toBe(true);
  });

  it('rejects invalid categories', () => {
    expect(isValidTemplateCategory('invalid')).toBe(false);
  });
});

describe('validateTarget', () => {
  const validTarget = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Target',
    platform: 'hackerone',
    scope: '*.example.com',
    notes: 'Some notes',
    priority: 1,
    status: 'recon',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sessionCount: 0
  };

  it('passes for a valid target', () => {
    const result = validateTarget(validTarget);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails for non-object input', () => {
    expect(validateTarget(null).valid).toBe(false);
    expect(validateTarget('string').valid).toBe(false);
  });

  it('fails for missing required fields', () => {
    const result = validateTarget({ ...validTarget, name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('fails for invalid UUID', () => {
    const result = validateTarget({ ...validTarget, id: 'not-a-uuid' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('id'))).toBe(true);
  });

  it('fails for name exceeding 100 chars', () => {
    const result = validateTarget({ ...validTarget, name: 'a'.repeat(101) });
    expect(result.valid).toBe(false);
  });

  it('fails for invalid platform', () => {
    const result = validateTarget({ ...validTarget, platform: 'invalid' });
    expect(result.valid).toBe(false);
  });

  it('fails for negative sessionCount', () => {
    const result = validateTarget({ ...validTarget, sessionCount: -1 });
    expect(result.valid).toBe(false);
  });

  it('accepts optional programUrl when valid', () => {
    const result = validateTarget({ ...validTarget, programUrl: 'https://hackerone.com/test' });
    expect(result.valid).toBe(true);
  });

  it('fails for invalid programUrl', () => {
    const result = validateTarget({ ...validTarget, programUrl: 'not a url' });
    expect(result.valid).toBe(false);
  });
});

describe('validateSession', () => {
  const validSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    targetId: '660e8400-e29b-41d4-a716-446655440000',
    durationPlanned: 1500,
    durationActual: 900,
    startedAt: Date.now() - 3600000,
    endedAt: Date.now(),
    status: 'completed',
    tags: ['high']
  };

  it('passes for a valid session', () => {
    const result = validateSession(validSession);
    expect(result.valid).toBe(true);
  });

  it('fails for invalid status', () => {
    const result = validateSession({ ...validSession, status: 'invalid' });
    expect(result.valid).toBe(false);
  });

  it('fails when abandoned after 50% completion', () => {
    const result = validateSession({
      ...validSession,
      status: 'abandoned',
      durationPlanned: 1000,
      durationActual: 600
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('abandoned'))).toBe(true);
  });

  it('allows abandoned before 50% completion', () => {
    const result = validateSession({
      ...validSession,
      status: 'abandoned',
      durationPlanned: 1000,
      durationActual: 400
    });
    expect(result.valid).toBe(true);
  });

  it('fails for durationActual > durationPlanned', () => {
    const result = validateSession({ ...validSession, durationPlanned: 100, durationActual: 200 });
    expect(result.valid).toBe(false);
  });

  it('fails for more than 5 tags', () => {
    const result = validateSession({ ...validSession, tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(result.valid).toBe(false);
  });

  it('fails for invalid session tag', () => {
    const result = validateSession({ ...validSession, tags: ['invalid-tag'] });
    expect(result.valid).toBe(false);
  });

  it('validates targetId reference when targetIds provided', () => {
    const result = validateSession(validSession, { targetIds: ['different-id'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('targetId'))).toBe(true);
  });
});

describe('validateNote', () => {
  const validNote = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Note',
    content: 'Some content',
    targetId: '660e8400-e29b-41d4-a716-446655440000',
    tags: ['xss'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('passes for a valid note', () => {
    expect(validateNote(validNote).valid).toBe(true);
  });

  it('fails for empty title', () => {
    expect(validateNote({ ...validNote, title: '' }).valid).toBe(false);
  });

  it('fails for title exceeding 200 chars', () => {
    expect(validateNote({ ...validNote, title: 'a'.repeat(201) }).valid).toBe(false);
  });

  it('fails for content exceeding 50000 chars', () => {
    expect(validateNote({ ...validNote, content: 'a'.repeat(50001) }).valid).toBe(false);
  });

  it('fails for more than 10 tags', () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(validateNote({ ...validNote, tags }).valid).toBe(false);
  });

  it('validates sessionId reference when provided', () => {
    const noteWithSession = { ...validNote, sessionId: '880e8400-e29b-41d4-a716-446655440000' };
    const result = validateNote(noteWithSession, { sessionIds: ['different-id'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sessionId'))).toBe(true);
  });
});

describe('validateEvidenceAsset', () => {
  const validAsset = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Screenshot',
    kind: 'image',
    source: 'upload',
    mimeType: 'image/png',
    size: 1024,
    tags: [],
    syncState: 'local',
    capturedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('passes for a valid asset', () => {
    expect(validateEvidenceAsset(validAsset).valid).toBe(true);
  });

  it('fails for invalid kind', () => {
    expect(validateEvidenceAsset({ ...validAsset, kind: 'invalid' }).valid).toBe(false);
  });

  it('fails for negative size', () => {
    expect(validateEvidenceAsset({ ...validAsset, size: -1 }).valid).toBe(false);
  });

  it('requires url when source is url', () => {
    const result = validateEvidenceAsset({ ...validAsset, source: 'url', url: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('url is required'))).toBe(true);
  });

  it('passes when source is url and url is provided', () => {
    const result = validateEvidenceAsset({ ...validAsset, source: 'url', url: 'https://example.com/proof.png' });
    expect(result.valid).toBe(true);
  });
});

describe('validateEvidenceLink', () => {
  const validLink = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    fromType: 'target',
    fromId: '660e8400-e29b-41d4-a716-446655440000',
    toType: 'note',
    toId: '770e8400-e29b-41d4-a716-446655440000',
    relationship: 'proves',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('passes for a valid link with references', () => {
    const result = validateEvidenceLink(validLink, {
      targetIds: [validLink.fromId],
      noteIds: [validLink.toId]
    });
    expect(result.valid).toBe(true);
  });

  it('fails for invalid relationship', () => {
    expect(validateEvidenceLink({ ...validLink, relationship: 'invalid' }).valid).toBe(false);
  });

  it('fails for invalid fromType', () => {
    expect(validateEvidenceLink({ ...validLink, fromType: 'invalid' }).valid).toBe(false);
  });
});

describe('validateEvidenceCanvasView', () => {
  const validView = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'My Canvas',
    includeSessions: true,
    includeNotes: true,
    includeUrls: false,
    positions: {},
    zoom: 1,
    panX: 0,
    panY: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('passes for a valid view', () => {
    expect(validateEvidenceCanvasView(validView).valid).toBe(true);
  });

  it('fails for empty name', () => {
    expect(validateEvidenceCanvasView({ ...validView, name: '' }).valid).toBe(false);
  });

  it('fails for zoom <= 0 or > 4', () => {
    expect(validateEvidenceCanvasView({ ...validView, zoom: 0 }).valid).toBe(false);
    expect(validateEvidenceCanvasView({ ...validView, zoom: 5 }).valid).toBe(false);
  });

  it('fails for non-boolean includeSessions', () => {
    expect(validateEvidenceCanvasView({ ...validView, includeSessions: 'yes' }).valid).toBe(false);
  });
});

describe('validateNoteTemplate', () => {
  const validTemplate = {
    id: 'probe-xss',
    name: 'XSS Probe',
    category: 'web',
    content: '## Template content',
    isBuiltIn: true
  };

  it('passes for a valid template', () => {
    expect(validateNoteTemplate(validTemplate).valid).toBe(true);
  });

  it('fails for missing id', () => {
    expect(validateNoteTemplate({ ...validTemplate, id: '' }).valid).toBe(false);
  });

  it('fails for invalid category', () => {
    expect(validateNoteTemplate({ ...validTemplate, category: 'invalid' }).valid).toBe(false);
  });
});

describe('validateSettings', () => {
  const validSettings = {
    defaultDuration: 1500,
    autoStartBreak: true,
    breakDuration: 300,
    sessionsBeforeLongBreak: 4,
    longBreakDuration: 900,
    soundEnabled: true,
    vibrationEnabled: true,
    theme: 'dark',
    accentColor: 'green',
    fontSize: 'medium',
    onboardingCompleted: false
  };

  it('passes for valid settings', () => {
    expect(validateSettings(validSettings).valid).toBe(true);
  });

  it('fails for invalid theme', () => {
    expect(validateSettings({ ...validSettings, theme: 'invalid' }).valid).toBe(false);
  });

  it('fails for negative defaultDuration', () => {
    expect(validateSettings({ ...validSettings, defaultDuration: -1 }).valid).toBe(false);
  });

  it('fails for non-object input', () => {
    expect(validateSettings(null).valid).toBe(false);
    expect(validateSettings('string').valid).toBe(false);
  });
});
