import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_POLICY_MESSAGES,
  validatePassword,
  type PasswordPolicyReason
} from './passwordPolicy';

/**
 * Property 1 — Password validator agrees with reference predicate.
 *
 * The reference predicate is the Firebase password policy recorded in
 * runbook-firebase.md (resolves OQ 2):
 *   - min length ≥ 8
 *   - at least one letter
 *   - at least one digit
 *
 * This file is a Wave 6 property-based test. The validator under test
 * lives in `passwordPolicy.ts` (extracted from AuthForm.svelte so the
 * test can drive it without mounting the component).
 *
 * Tag the spec at file-level so the requirement-trace stays close to
 * the property statement. The describe immediately below repeats the
 * tag in canonical form.
 *
 * Validates: Requirement 1.4
 */

// Reference predicate. Mirrors the Firebase project's policy 1:1
// without using the validator's internal machinery, so test failures
// surface a true disagreement between the validator and the spec.
function refOk(s: string): boolean {
  if (s.length < MIN_PASSWORD_LENGTH) return false;
  if (!/\p{L}/u.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  return true;
}

// First-violated-rule reference. Order must match validatePassword's
// internal order (length → letter → number) so the property holds
// pointwise on the `reason` field, not just on `ok`.
function refReason(s: string): PasswordPolicyReason | null {
  if (s.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (!/\p{L}/u.test(s)) return 'missing-letter';
  if (!/[0-9]/.test(s)) return 'missing-number';
  return null;
}

// Feature: firebase-auth-migration, Property 1: Password validator agrees with reference predicate
describe('Property 1 — Password validator agrees with reference predicate', () => {
  it('returns ok iff the reference predicate holds, and the right reason otherwise', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 60 }), (s) => {
        const result = validatePassword(s);
        const expectedOk = refOk(s);

        if (result.ok !== expectedOk) {
          return false;
        }

        if (result.ok) return true;

        // On failure, the reason must identify the first violated rule.
        return result.reason === refReason(s);
      }),
      { numRuns: 500 }
    );
  });

  // A small set of explicit examples beside the property to catch
  // silly regressions immediately and document the policy by example.
  it('rejects short passwords first', () => {
    expect(validatePassword('a1')).toEqual({ ok: false, reason: 'too-short' });
  });

  it('rejects all-digit passwords (missing letter)', () => {
    expect(validatePassword('12345678')).toEqual({
      ok: false,
      reason: 'missing-letter'
    });
  });

  it('rejects all-letter passwords (missing number)', () => {
    expect(validatePassword('abcdefgh')).toEqual({
      ok: false,
      reason: 'missing-number'
    });
  });

  it('accepts a password meeting every rule', () => {
    expect(validatePassword('huntflow1')).toEqual({ ok: true });
  });

  it('exposes user-facing copy for every reason without forbidden brand substrings', () => {
    const forbidden = ['clerk', 'firebase', 'secured by', 'powered by'];
    for (const reason of Object.keys(PASSWORD_POLICY_MESSAGES) as PasswordPolicyReason[]) {
      const message = PASSWORD_POLICY_MESSAGES[reason];
      expect(message.length).toBeGreaterThan(0);
      const lower = message.toLowerCase();
      for (const needle of forbidden) {
        expect(lower).not.toContain(needle);
      }
    }
  });
});
