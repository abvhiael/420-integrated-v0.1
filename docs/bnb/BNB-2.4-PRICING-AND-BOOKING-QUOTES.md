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
