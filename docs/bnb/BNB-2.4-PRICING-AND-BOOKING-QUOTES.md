# BNB-2.4 — Pricing and Booking Quotes

**Status:** Implementation in progress; exact-SHA Level 1 CI and contractual exit criteria require verification.
**PR:** #600; step follows BNB-2.3. This document supplements and does not replace canonical BNB-1.3/BnB-1.5 and any later repository-authoritative roadmap.

## Scope / normative pricing authority

BNB owns nonbinding accommodation rate-plan and immutable quote snapshots. 420Pay exclusively owns invoices, funds, settlement, refunds and finality. Approved 420Swap paths and governed tax/merchant authorities are not fabricated here. Draft properties may configure local rate plans; guest quotes require a published property, approved domain session, policy, selected inventory, date window and rate plan. Issued quote is **not** signed financial provider authority and is not evidence of a binding Pay quote or a booked stay.

## Implemented

- `pricing.py`: exact nonnegative integer smallest-currency-unit arithmetic, bounded 90-night input, per-local-date base or half-open seasonal rate, explicit rate-overlap refusal, quantity multiplier, cleaning, service, discount and tax, half-up rounding **after aggregate component arithmetic**. No floating point money.
- `011_quote_pricing.sql`: property-scoped versioned rate plan and immutable quote row, property/rate revisions, local/UTC dates, guest and unit, selected quantity, itemized amounts, currency, policy snapshot JSON and SHA-256, issued-at and 10-minute TTL, scoped request-digest/nonce replay.
- Owner-only draft rate-plan mutations require current property version and validate seasonal date ranges and nonoverlap. Existing quotes are not mutated by future rate-plan/policy edits.
- Guest-scoped quotes fail closed for unpublished properties, unavailable rate plans, invalid windows, absent timezone/stay policy, unavailable inventory, overcapacity and nonce replay of different payload. Read access is restricted to the original guest. Expired quote stays expired on replay.
- If a property has a configured rate plan, a nonbinding hold requires the guest's unexpired quote with exact unit, start/end, quantity and frozen policy payload. Finality and payout remain disabled.
- The targeted BnB PostgreSQL/Chromium CI migration sequence and nonroot container include the new pricing module.

## Tests and remaining obligations

Level 1 scenarios include integer rounding, amount caps, overlapping seasonal rates, minimum/max stay, plan revision CAS/authorization, quote nonce collision, expiry, guest privacy and immutable policy snapshot; exact-implementation SHA and CI must be verified before PASS.

**Not implemented / not permitted as live payment authority:** independently approved tax calculation/collection and jurisdiction provenance, host merchant/payout verification, governance-approved 420Pay binding and signed issuer authority, swap asset price/FX conversions, security deposits, insurance, consumer-law/regulatory adoption, fee/recipient split payouts. No self-issued signature may stand in for canonical Pay authority; these must have independent governance/testnet acceptance before live use. This step provides the repository-side nonbinding quote and price simulation; no claim of production financial finality is supported.

## Integrated quote-to-hold and guest/host interface (final implementation candidate)

- `012_hold_quote_binding.sql` records quote identity on the nonbinding hold and enforces one quote-to-hold allocation globally. Priced holds require the originating guest's valid, unexpired issued quote, exact property/unit/date/quantity binding and byte-for-byte normalized immutable policy snapshot; they take the **frozen quote total**, not a live recomputation of the property's base rate. Expired/revoked/used quotes and incorrect snapshots fail closed.
- Guest revocation is one-way and idempotent only while the quote is unexpired and unused. Quotes are private to the guest; list/public endpoints never disclose guest financial details. Rate edits may not mutate issued quote evidence.
- Guest `payer_max_minor` explicitly refuses totals over the supplied bounded amount. Host supplied fee/tax/discount values and quote quantities reject float coercion; seasonal/booking dates use strict ISO date syntax; quote/property/unit identifiers are validated before reaching the database.
- The public listing UI supports accessible quoted itemization, signed-in-only quote intake and explicit no-payment/no-booking disclosure. Host dashboard supports draft cleaning/service charges, tax/discount basis points and an optional seasonal rate interval. Full multi-season plan payloads are available through the authenticated API.
- Test coverage includes eight concurrent equivalent quote requests converging on one persisted quote, nonce mutation replay, quote cancellation/revocation, expiry, payer-max refusal, overflow/rounding boundaries, stale property-version updates, rejected seasonal overlap, calendar currency/quantity constraints, malformed identifiers, signed-in quote UI path and frozen quote-to-hold economics.

**Financial authority boundary:** Quote `snapshot_sha256` is a deterministic integrity fingerprint, **not** a cryptographic signature from an approved external quote issuer; local tax percentages are configuration and not independently verified legal tax rules. Canonical Pay invoice, wallet consent, chain/asset, activated merchant, fee splits, FX, deposits, receipts and finality are governed upstream and stay blocked for live use. Refer to `T-BNB-QUOTE-1` in the BnB testnet roadmap for independently approved authority and end-to-end acceptance. Only repository-side nonbinding quote issuance is being qualified here.

**Level 1:** targeted BnB CI includes migrations 001–012, app API and PostgreSQL/adversarial tests, non-root staging container, browser UI / axe checks and direct arithmetic invariants. Record an exact passing implementation SHA and CI run/job before marking this step repository-side complete. No Level 2 before the app's actual milestone, and no Level 3 until phase closeout.
