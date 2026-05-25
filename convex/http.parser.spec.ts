import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  MISSING_UID_MARKER,
  parseDodoEvent,
  type ParsedDodoEvent
} from './http';

/**
 * Property 3 — Webhook event maps to a faithful entitlement row.
 *
 * Drives `parseDodoEvent` with arbitrary well-formed Dodo subscription
 * events and asserts the produced upsert args match the table in
 * design.md's Data Models section pointwise:
 *
 *   uid                 ← e.data.metadata.uid (verbatim)
 *   isPro === true      ↔ e.type ∈ {subscription.active, subscription.renewed}
 *   isPro === false     ↔ e.type ∈ {subscription.cancelled, .expired, .failed}
 *   dodoCustomerId      ← e.data.customer.customer_id
 *   dodoSubscriptionId  ← e.data.subscription_id (or null when empty)
 *   currentPeriodEnd    ← parseDate(e.data.next_billing_date) (or null)
 *
 * The companion property: when `data.metadata.uid` is missing the
 * parser returns `MISSING_UID_MARKER` (which the handler maps to
 * 400 Bad Request, with no mutation). This is the cryptographic-style
 * input-validation guarantee Property 3 covers — the runtime mutation
 * skip is checked at the handler level via the marker contract.
 *
 * Validates: Requirement 7.1, 7.2
 */

const PRO_EVENT_TYPES = [
  'subscription.active',
  'subscription.renewed'
] as const;

const NON_PRO_EVENT_TYPES = [
  'subscription.cancelled',
  'subscription.expired',
  'subscription.failed'
] as const;

const CONSUMED_EVENT_TYPES = [
  ...PRO_EVENT_TYPES,
  ...NON_PRO_EVENT_TYPES
] as const;

const IGNORED_EVENT_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'dispute.opened',
  'refund.created',
  'subscription.created' // not in our consume list
] as const;

const uidArb = fc.stringMatching(/^[A-Za-z0-9]{6,28}$/);
const customerIdArb = fc
  .stringMatching(/^[A-Za-z0-9_-]{6,32}$/)
  .map((s) => `cus_${s}`);
const subscriptionIdArb = fc
  .stringMatching(/^[A-Za-z0-9_-]{6,32}$/)
  .map((s) => `sub_${s}`);

/**
 * ISO-8601 timestamps within a sane window. We avoid extreme dates
 * because `Date.parse` accepts but normalizes them, which would make
 * the property check noisier without adding value.
 */
const isoDateArb: fc.Arbitrary<string> = fc
  .integer({ min: Date.parse('2020-01-01T00:00:00Z'), max: Date.parse('2035-01-01T00:00:00Z') })
  .map((ms) => new Date(ms).toISOString());

interface SubscriptionEvent {
  type: (typeof CONSUMED_EVENT_TYPES)[number];
  data: {
    payload_type: 'Subscription';
    subscription_id: string;
    customer: { customer_id: string; email: string };
    metadata: { uid: string };
    next_billing_date: string | null;
    status: string;
    product_id: string;
  };
}

const wellFormedEventArb: fc.Arbitrary<SubscriptionEvent> = fc.record({
  type: fc.constantFrom(...CONSUMED_EVENT_TYPES),
  data: fc.record({
    payload_type: fc.constant('Subscription' as const),
    subscription_id: subscriptionIdArb,
    customer: fc.record({
      customer_id: customerIdArb,
      email: fc.emailAddress()
    }),
    metadata: fc.record({ uid: uidArb }),
    next_billing_date: fc.option(isoDateArb, { nil: null }),
    status: fc.constantFrom('active', 'cancelled', 'expired', 'failed'),
    product_id: fc.stringMatching(/^prod_[A-Za-z0-9]{4,16}$/)
  })
});

// Feature: firebase-auth-migration, Property 3: Webhook event maps to a faithful entitlement row
describe('Property 3 — Webhook event maps to a faithful entitlement row', () => {
  it('produces upsert args that satisfy every field-level mapping', () => {
    fc.assert(
      fc.property(wellFormedEventArb, (event) => {
        const result = parseDodoEvent(event) as ParsedDodoEvent;

        // Should be a structural ParsedDodoEvent, not the marker or null.
        if (!result || typeof result !== 'object' || (result as unknown) === MISSING_UID_MARKER) {
          return false;
        }

        // uid is verbatim
        if (result.uid !== event.data.metadata.uid) return false;

        // isPro polarity
        const expectedPro = (PRO_EVENT_TYPES as readonly string[]).includes(event.type);
        if (result.isPro !== expectedPro) return false;

        // dodoCustomerId mapping
        if (result.dodoCustomerId !== event.data.customer.customer_id) return false;

        // dodoSubscriptionId mapping (subscription_id is non-empty in
        // our generator so it should never collapse to null here)
        if (result.dodoSubscriptionId !== event.data.subscription_id) return false;

        // currentPeriodEnd mapping
        if (event.data.next_billing_date === null) {
          if (result.currentPeriodEnd !== null) return false;
        } else {
          if (result.currentPeriodEnd !== Date.parse(event.data.next_billing_date)) return false;
        }

        return true;
      }),
      { numRuns: 200 }
    );
  });

  it('returns the missing-uid marker when data.metadata.uid is absent', () => {
    fc.assert(
      fc.property(wellFormedEventArb, (event) => {
        // Strip the uid in different ways to exercise the parser's
        // missing-uid branch. fast-check feeds the same event twice
        // (once as `metadata: {}` and once as a non-string uid value)
        // by branching on the input.
        const variants: unknown[] = [
          { ...event, data: { ...event.data, metadata: {} } },
          { ...event, data: { ...event.data, metadata: { uid: '' } } },
          { ...event, data: { ...event.data, metadata: { uid: '   ' } } },
          { ...event, data: { ...event.data, metadata: { uid: 42 } } },
          { ...event, data: { ...event.data, metadata: undefined } }
        ];
        for (const variant of variants) {
          const result = parseDodoEvent(variant);
          if (result !== MISSING_UID_MARKER) return false;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('returns null for ignored event types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IGNORED_EVENT_TYPES),
        wellFormedEventArb,
        (ignoredType, event) => {
          const ignoredEvent = { ...event, type: ignoredType };
          return parseDodoEvent(ignoredEvent) === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null for malformed payloads (not an object, missing data, etc.)', () => {
    const malformed: unknown[] = [
      null,
      undefined,
      'string',
      42,
      [],
      {},
      { type: 'subscription.active' },
      { type: 'subscription.active', data: 'bogus' },
      { data: { metadata: { uid: 'x' } } } // missing type
    ];
    for (const v of malformed) {
      expect(parseDodoEvent(v)).toBeNull();
    }
  });

  it('falls back to data.customer_id when data.customer is missing', () => {
    const event = {
      type: 'subscription.active',
      data: {
        payload_type: 'Subscription',
        subscription_id: 'sub_abc',
        customer_id: 'cus_fallback',
        metadata: { uid: 'firebaseUid' },
        next_billing_date: null,
        status: 'active',
        product_id: 'prod_pro'
      }
    };
    const result = parseDodoEvent(event) as ParsedDodoEvent;
    expect(result.dodoCustomerId).toBe('cus_fallback');
    expect(result.uid).toBe('firebaseUid');
    expect(result.isPro).toBe(true);
  });
});
