/**
 * AuthErrorMap — pure mapping from Firebase Auth error codes to
 * user-facing strings.
 *
 * Every value is brand-clean: no occurrence of "Clerk" / "clerk",
 * "Firebase" / "firebase", "Secured by", or "Powered by" (Property 5).
 * The exported `mapAuthError` function narrows an unknown error to its
 * `.code`, looks up a friendly message, otherwise sanitizes
 * `error.message` (Firebase prepends `"Firebase: ... (auth/...)"`) and
 * finally falls back to a generic default. The sanitized fallback is
 * itself filtered through the same brand-clean check so the SDK can
 * never leak its own brand into the UI.
 *
 * Feature: firebase-auth-migration
 * Validates: Requirements 5.5, 10.4
 */

/**
 * Generic fallback shown when a code is not in the map and the error
 * message can't be safely surfaced.
 */
export const DEFAULT_AUTH_ERROR_MESSAGE = 'Something went wrong. Try again.';

/**
 * Substrings that must never appear in any user-facing auth error
 * string. Compared case-insensitively for `clerk` / `firebase` and
 * literally for the marketing badges.
 */
const FORBIDDEN_SUBSTRINGS_CI = ['clerk', 'firebase'] as const;
const FORBIDDEN_SUBSTRINGS_LITERAL = ['Secured by', 'Powered by'] as const;

/**
 * Code → friendly-message map. Exported for unit tests so they can
 * iterate the table directly.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/email-already-in-use':
    'An account with that email already exists.',
  'auth/weak-password':
    'Password is too weak. Use at least 8 characters with letters and numbers.',
  'auth/popup-blocked':
    'Sign-in popup was blocked. Try again or allow popups for this site.',
  'auth/popup-closed-by-user': 'Sign-in cancelled.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/account-exists-with-different-credential':
    'An account with this email already exists. Try signing in with your original provider.',
  'auth/expired-action-code': 'This link has expired. Request a new one.',
  'auth/invalid-action-code':
    'This link is invalid or has already been used.',
  'auth/network-request-failed':
    "You're offline — sign-in unavailable.",
  'auth/requires-recent-login':
    'For security, please sign in again to continue.'
};

/**
 * Returns true if `value` contains any forbidden brand substring.
 * Comparison is case-insensitive for `clerk` / `firebase` and
 * literal for the marketing badge strings.
 */
export function containsForbiddenBrand(value: string): boolean {
  const lower = value.toLowerCase();
  for (const needle of FORBIDDEN_SUBSTRINGS_CI) {
    if (lower.includes(needle)) {
      return true;
    }
  }
  for (const needle of FORBIDDEN_SUBSTRINGS_LITERAL) {
    if (value.includes(needle)) {
      return true;
    }
  }
  return false;
}

/**
 * Strip the `"Firebase: "` prefix and the trailing `"(auth/...)"`
 * marker that Firebase tacks onto every SDK error message. Returns
 * the trimmed remainder (which may itself still contain a forbidden
 * brand substring — caller must check).
 */
export function sanitizeFirebaseMessage(raw: string): string {
  let out = raw;
  // Firebase prepends "Firebase: " to every Error.message.
  out = out.replace(/^Firebase:\s*/i, '');
  // ... and appends " (auth/<code>)." or " (auth/<code>)" at the end.
  out = out.replace(/\s*\(auth\/[^)]+\)\.?\s*$/i, '');
  return out.trim();
}

/**
 * Type guard: narrow an unknown to a record-shaped object so we can
 * safely read `.code` / `.message` without `any`.
 */
function isObjectLike(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Map any error thrown by the Firebase auth SDK to a user-facing
 * string. Resolution order:
 *   1. If `error.code` is a known auth error code → mapped message.
 *   2. Else if `error.message` is non-empty and brand-clean after
 *      sanitization → sanitized message.
 *   3. Else → DEFAULT_AUTH_ERROR_MESSAGE.
 */
export function mapAuthError(error: unknown): string {
  if (typeof error === 'string') {
    return mapAuthError({ message: error });
  }

  if (!isObjectLike(error)) {
    return DEFAULT_AUTH_ERROR_MESSAGE;
  }

  const code = error.code;
  if (typeof code === 'string' && code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code];
  }

  const message = error.message;
  if (typeof message === 'string' && message.length > 0) {
    const sanitized = sanitizeFirebaseMessage(message);
    if (sanitized.length > 0 && !containsForbiddenBrand(sanitized)) {
      return sanitized;
    }
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}
