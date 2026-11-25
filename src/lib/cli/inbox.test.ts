import { describe, expect, it } from 'vitest';
import type { Target } from '$lib/types';
import { matchProgram } from './inbox';

const program = (id: string, name: string, extra: Partial<Target> = {}) => ({ id, name, status: 'testing', programUrl: '', ...extra }) as Target;

describe('matchProgram', () => {
  const programs = [
    program('p1', 'Acme Bug Bounty', { programUrl: 'https://hackerone.com/acme' }),
    program('p2', 'Globex Public', { programUrl: 'https://bugcrowd.com/globex-vdp' }),
    program('p3', 'Acme Legacy', { status: 'archived' }),
    program('p4', 'Initech')
  ];

  it('matches by id, exact name, prefix, substring and URL', () => {
    expect(matchProgram('p2', programs)?.id).toBe('p2');
    expect(matchProgram('initech', programs)?.id).toBe('p4');
    expect(matchProgram('acme', programs)?.id).toBe('p1');
    expect(matchProgram('public', programs)?.id).toBe('p2');
    expect(matchProgram('globex-vdp', programs)?.id).toBe('p2');
  });

  it('prefers active programs but falls back to archived ones', () => {
    expect(matchProgram('acme', programs)?.id).toBe('p1');
    expect(matchProgram('legacy', programs)?.id).toBe('p3');
  });

  it('returns nothing for empty or unknown names', () => {
    expect(matchProgram(undefined, programs)).toBeUndefined();
    expect(matchProgram('  ', programs)).toBeUndefined();
    expect(matchProgram('umbrella', programs)).toBeUndefined();
  });
});
