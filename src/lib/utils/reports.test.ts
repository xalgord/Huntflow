import type { Note } from '$lib/types';
import { describe, expect, it } from 'vitest';
import {
  getReportTemplate,
  parseNoteFields,
  renderReportMarkdown,
  suggestSeverityFromTags
} from './reports';

function note(overrides: Partial<Note>): Note {
  const now = Date.now();

  return {
    id: 'note-1',
    title: 'IDOR leaks billing records',
    content: '',
    targetId: 'target-1',
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('report utilities', () => {
  it('suggests the highest severity found in tags', () => {
    expect(suggestSeverityFromTags(['medium', 'needs-report', 'p1'])).toBe('high');
  });

  it('extracts report fields from common markdown headings', () => {
    const fields = parseNoteFields(
      note({
        tags: ['critical'],
        content: `## Summary
User A can read User B billing records.

### Steps to Reproduce
1. Log in as User A.
2. Request /api/billing/user-b.

### Impact
Private invoices are exposed.

### Remediation
Authorize billing lookups by owner.`
      })
    );

    expect(fields.title).toBe('IDOR leaks billing records');
    expect(fields.severity).toBe('critical');
    expect(fields.summary).toBe('User A can read User B billing records.');
    expect(fields.reproductionSteps).toContain('/api/billing/user-b');
    expect(fields.impact).toBe('Private invoices are exposed.');
    expect(fields.remediation).toBe('Authorize billing lookups by owner.');
  });

  it('renders platform-specific markdown from parsed fields', () => {
    const template = getReportTemplate('bugcrowd');
    const fields = parseNoteFields(
      note({
        tags: ['high'],
        content: `## Summary
Session token is returned to another account.

## Steps to Reproduce
1. Create two accounts.
2. Replay the request.

## Impact
Account takeover is possible.`
      })
    );

    expect(renderReportMarkdown(template, fields)).toContain('## Vulnerability Details');
    expect(renderReportMarkdown(template, fields)).toContain('## Severity\n\nHigh');
  });
});
