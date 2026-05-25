/**
 * Password policy validator.
 *
 * Pure function module that mirrors the Firebase password policy
 * recorded in `runbook-firebase.md` (the operator-facing source of
 * truth for OQ 2):
 *
 *   - minimum length: 8
 *   - require numeric character: on
 *   - require letter (any case): implied — at least one alphabetic
 *     character is required so a string of digits ("12345678") fails
 *
 * `validatePassword(s)` returns either `{ ok: true }` or
 * `{ ok: false, reason }` where `reason` is the *first* rule violated
 * in the order tested. This makes the validator agree pointwise with a
 * straightforward reference predicate, which is what Wave 6 Property 1
 * exercises.
 *
 * The module is deliberately decoupled from Firebase / Svelte / Convex
 * so the test harness can drive it deterministically across thousands
 * of inputs.
 *
 * Feature: firebase-auth-migration
 * Validates: Requirement 1.4
 */

/** Minimum acceptable password length (Firebase project setting). */
export const MIN_PASSWORD_LENGTH = 8;

/** Discriminated union of every rule the validator can flag. */
export type PasswordPolicyReason =
  | 'too-short'
  | 'missing-letter'
  | 'missing-number';

/** Validator result. `reason` is present iff `ok === false`. */
export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; reason: PasswordPolicyReason };

/**
 * Returns true when `s` contains at least one alphabetic character.
 * Uses Unicode-aware property escapes so non-ASCII letters count.
 */
function hasLetter(s: string): boolean {
  return /\p{L}/u.test(s);
}

/**
 * Returns true when `s` contains at least one decimal digit (0-9).
 * Limited to ASCII digits because the Firebase backend's "require
 * numeric character" rule is documented against ASCII digits.
 */
function hasNumber(s: string): boolean {
  return /[0-9]/.test(s);
}

/**
 * Validate `s` against the configured policy. The order of checks
 * (length → letter → number) determines which `reason` surfaces when
 * multiple rules are violated; the order is stable and exposed so
 * tests and UI copy can rely on it.
 */
export function validatePassword(s: string): PasswordValidationResult {
  if (s.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'too-short' };
  }
  if (!hasLetter(s)) {
    return { ok: false, reason: 'missing-letter' };
  }
  if (!hasNumber(s)) {
    return { ok: false, reason: 'missing-number' };
  }
  return { ok: true };
}

/**
 * User-facing copy for each violation reason. Brand-clean by
 * construction (no "Firebase" / "Clerk" / "Secured by" / "Powered by"
 * substrings).
 */
export const PASSWORD_POLICY_MESSAGES: Record<PasswordPolicyReason, string> = {
  'too-short': `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  'missing-letter': 'Include at least one letter.',
  'missing-number': 'Include at least one number.'
};
