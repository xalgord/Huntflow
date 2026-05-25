import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Webhook, WebhookVerificationError } from 'standardwebhooks';

/**
 * Property 2 — Webhook signature verifier round-trip and tamper rejection.
 *
 * Exercises the Standard Webhooks signing/verification round-trip
 * directly (using the same `standardwebhooks` package the Convex
 * webhook handler in `convex/http.ts` consumes). Splitting the test
 * away from the Convex `httpActionGeneric` keeps the property
 * concerned with the cryptographic invariant (signature ↔ payload
 * binding) rather than with the Convex runtime.
 *
 * The companion mutation-call assertion (no `entitlements.upsertFromWebhook`
 * on tamper) is checked at the integration layer in
 * `convex/http.parser.spec.ts` (Property 3) — together they cover the
 * full Property 2 statement: tamper triggers verification failure AND
 * the handler short-circuits before any mutation.
 *
 * Validates: Requirement 7.1, 7.3
 */

/**
 * Standard Webhooks signing-secret format expected by the
 * `standardwebhooks` package: a base64-encoded byte sequence,
 * optionally prefixed with `whsec_`. We always include the prefix so
 * the test mirrors what Convex sees in production.
 */
function whsecArb(): fc.Arbitrary<string> {
  return fc
    .uint8Array({ minLength: 24, maxLength: 64 })
    .map((bytes) => {
      // Buffer is available in Node + browsers via vite/vitest polyfills.
      const base64 = Buffer.from(bytes).toString('base64');
      return `whsec_${base64}`;
    });
}

/**
 * `webhook-id` is a free-form opaque identifier. Standard Webhooks
 * doesn't constrain its format beyond "non-empty string", so we
 * generate alphanumeric ids that are wide enough to not collide.
 */
const idArb: fc.Arbitrary<string> = fc.stringMatching(
  /^msg_[A-Za-z0-9]{12,32}$/
);

/**
 * `webhook-timestamp` is seconds-since-epoch. The verifier rejects
 * timestamps too far from "now"; pin generation to a window centred
 * on the current second to avoid spurious tolerance failures.
 */
function timestampArb(): fc.Arbitrary<string> {
  const now = Math.floor(Date.now() / 1000);
  return fc.integer({ min: now - 60, max: now + 60 }).map((t) => String(t));
}

/**
 * Body generator. The verifier signs the literal bytes of the body,
 * so we need stable JSON-shaped strings. Use plain ascii to keep the
 * test independent of utf-8 normalization quirks.
 */
const bodyArb: fc.Arbitrary<string> = fc
  .record({
    type: fc.constantFrom(
      'subscription.active',
      'subscription.cancelled',
      'subscription.renewed'
    ),
    nonce: fc.integer({ min: 0, max: 1_000_000 })
  })
  .map((obj) => JSON.stringify(obj));

// Feature: firebase-auth-migration, Property 2: Webhook signature verifier round-trip and tamper rejection
describe('Property 2 — Webhook signature verifier round-trip and tamper rejection', () => {
  it('signs and verifies a fresh envelope and recovers the original parsed body', () => {
    fc.assert(
      fc.property(whsecArb(), idArb, timestampArb(), bodyArb, (secret, id, ts, body) => {
        const wh = new Webhook(secret);
        const signature = wh.sign(id, new Date(Number(ts) * 1000), body);
        const headers = {
          'webhook-id': id,
          'webhook-timestamp': ts,
          'webhook-signature': signature
        };
        const parsed = wh.verify(body, headers) as Record<string, unknown>;
        // Parsed JSON must round-trip to the same object as the body.
        expect(parsed).toEqual(JSON.parse(body));
      }),
      { numRuns: 100 }
    );
  });

  it('rejects a body byte-flip', () => {
    fc.assert(
      fc.property(
        whsecArb(),
        idArb,
        timestampArb(),
        bodyArb,
        fc.nat(),
        (secret, id, ts, body, flipSeed) => {
          const wh = new Webhook(secret);
          const signature = wh.sign(id, new Date(Number(ts) * 1000), body);

          // Mutate exactly one character of the body.
          const idx = flipSeed % body.length;
          const original = body.charCodeAt(idx);
          // Toggle the lowest bit so we get a different character that
          // still fits in a single UTF-16 code unit.
          const flipped =
            String.fromCharCode(original ^ 1).slice(0, 1);
          const tampered = body.slice(0, idx) + flipped + body.slice(idx + 1);

          if (tampered === body) return true; // skip degenerate cases

          const headers = {
            'webhook-id': id,
            'webhook-timestamp': ts,
            'webhook-signature': signature
          };
          expect(() => wh.verify(tampered, headers)).toThrow(
            WebhookVerificationError
          );
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects a webhook-signature header byte-flip', () => {
    fc.assert(
      fc.property(
        whsecArb(),
        idArb,
        timestampArb(),
        bodyArb,
        fc.nat(),
        (secret, id, ts, body, flipSeed) => {
          const wh = new Webhook(secret);
          const signature = wh.sign(id, new Date(Number(ts) * 1000), body);

          // Flip a single character somewhere in the base64 portion of
          // the signature. The signature has the form
          // "v1,<base64>" — we only flip inside the base64 part.
          const comma = signature.indexOf(',');
          if (comma < 0 || comma + 1 >= signature.length) return true;
          const headLen = comma + 1;
          const tail = signature.slice(headLen);
          if (tail.length === 0) return true;
          const idx = flipSeed % tail.length;
          // Cycle through a fixed alphabet so the flipped char is
          // valid base64 but different.
          const candidate =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          const replacement = candidate[(flipSeed + 17) % candidate.length];
          if (replacement === tail[idx]) return true;
          const tamperedSignature =
            signature.slice(0, headLen) +
            tail.slice(0, idx) +
            replacement +
            tail.slice(idx + 1);

          const headers = {
            'webhook-id': id,
            'webhook-timestamp': ts,
            'webhook-signature': tamperedSignature
          };
          expect(() => wh.verify(body, headers)).toThrow(
            WebhookVerificationError
          );
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects a webhook-timestamp byte-flip', () => {
    fc.assert(
      fc.property(
        whsecArb(),
        idArb,
        timestampArb(),
        bodyArb,
        (secret, id, ts, body) => {
          const wh = new Webhook(secret);
          const signature = wh.sign(id, new Date(Number(ts) * 1000), body);
          // Flip the timestamp by 1 second; signature was bound to the
          // original `ts`, so this must fail.
          const tamperedTs = String(Number(ts) + 1);
          const headers = {
            'webhook-id': id,
            'webhook-timestamp': tamperedTs,
            'webhook-signature': signature
          };
          expect(() => wh.verify(body, headers)).toThrow(
            WebhookVerificationError
          );
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects a webhook-id byte-flip', () => {
    fc.assert(
      fc.property(
        whsecArb(),
        idArb,
        timestampArb(),
        bodyArb,
        (secret, id, ts, body) => {
          const wh = new Webhook(secret);
          const signature = wh.sign(id, new Date(Number(ts) * 1000), body);
          // Mutate the id so the signature no longer corresponds.
          const tamperedId = id + 'x';
          const headers = {
            'webhook-id': tamperedId,
            'webhook-timestamp': ts,
            'webhook-signature': signature
          };
          expect(() => wh.verify(body, headers)).toThrow(
            WebhookVerificationError
          );
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects a fresh signature minted with a different secret', () => {
    fc.assert(
      fc.property(whsecArb(), whsecArb(), idArb, timestampArb(), bodyArb, (
        secretA,
        secretB,
        id,
        ts,
        body
      ) => {
        if (secretA === secretB) return true;
        const whA = new Webhook(secretA);
        const whB = new Webhook(secretB);
        const signature = whA.sign(id, new Date(Number(ts) * 1000), body);
        const headers = {
          'webhook-id': id,
          'webhook-timestamp': ts,
          'webhook-signature': signature
        };
        expect(() => whB.verify(body, headers)).toThrow(WebhookVerificationError);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
