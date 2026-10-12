# 420BnB Phase 2 runtime — repository qualification and release boundaries

Status: repository implementation candidate; Phase 2 Level 3 acceptance is governed by [BNB-2.15 closeout](../../docs/bnb/BNB-2.15-PHASE2-LEVEL3-CLOSEOUT.md). No production booking, payment, issuer or operational acceptance is granted by this README. The earlier BNB-1.10 scaffold description is superseded by the current source and per-step records.

## Implemented repository mechanisms

- `api.py`: identity-session authorization, host property/manager/review operations, published discovery, unit calendars, quote-bound holds and booking requests, private guest/host journeys, independently signed Pay economic projections, Travel/Location and Compliance claims, review/reputation/moderation boundaries and redacted operational telemetry.
- `identity.py` and `authority.py`: externally pinned signature-verification adapters. `calendar_engine.py`, `pricing.py` and `travel_location.py`: capacity/timezone, bounded integer quote and conservative upstream public-place resolution.
- Migrations `001`–`020` and `migrate.py`: durable PostgreSQL state, replay ledgers, property-scoped transaction locking and serialized checksum-verified migration ledger. Health/readiness checks require the complete schema.
- `Dockerfile`, `compose.local.yml`, service tests and browser checks: non-root development/CI packaging, packaged migration execution, isolated database backup/restore and guest/host browser regressions. Local Compose and GitHub service containers are not deployed acceptance.

## Authentication and independent authority

Protected user routes use a bearer assertion verified by `verify_external_token`, then require an active, unexpired, non-revoked PostgreSQL session and matching recovery epoch. The legacy `principal` adapter immediately returns `503 IDENTITY_SESSION_REQUIRED`; configuring `BNB_IDENTITY_ASSERTION_SECRET` does not enable that rejected shared-secret path. Do not use the superseded proxy-header setup as a deployment instruction.

Independent property, recovery, Pay, calendar, Location, jurisdiction, Compliance, reviewer and service assertions require separately configured approved issuer/audience/public-key trust roots. `verify_authority` accepts only RS256 and required issuer, audience, subject, issuance/not-before/expiry, JTI and purpose claims, enforces the intended purpose/subject and limits proof lifetime. Protected ingestions additionally enforce object, payload and economic bindings plus durable replay checks. The service does not mint issuer approval or signing keys. Synthetic test keys establish verifier behavior only.

## Financial and inventory boundaries

The public `/v1/bnb/payments/intents` endpoint remains unavailable. Internal signed Pay projections cannot create custody, independently verify on-chain receipts or authorize Wallet execution. Canonical intent/finality assertions bind the reservation, quote, invoice, payment, chain, asset, amount, merchant/controller and receipt; late finality does not resurrect expired inventory. Captured splits must conserve the total, aggregate reserved/finalized disbursements cannot exceed capture, refunds require original-payer authority and immutable operation/receipt replay protections.

A signed pre-finality failure moves the pending intent into recovery. A failure against already finalized/confirmed payment returns `409 FINALIZED_PAYMENT_REQUIRES_PAY_RECOVERY`; this is a fail-closed boundary, not completed post-finality reorg recovery. Real Pay recovery, authorized inventory release, refunds and payout acceptance remain separate official-testnet gates. Confirmed holds retain capacity and cannot be released through the ordinary hold endpoint.

## Qualification evidence and release requirements

The retained runtime run `38205294263` checked out implementation `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`: 163 API/security tests and six operations tests passed, together with PostgreSQL schema/migration, logical backup/restore, non-root container, packaged migration, staging smoke, UI syntax, accessibility and front-end checks. These are repository/CI results, not independent live operational acceptance.

Canonical Solidity owns the complete Foundry inventory once; independent Genesis owns address/namespace/predeploy authority without duplicating it. Integrated, global Docs and affected service results must use verified exact implementation checkouts. Evidence-only updates do not change the implementation SHA or qualify new executable behavior. Consult the closeout for current mandatory gate results and merge-readiness status.

[BNB-TESTNET-WORK-ROADMAP.md](../../docs/bnb/BNB-TESTNET-WORK-ROADMAP.md) retains official network/Identity acceptance, independently authorized property/legal/reviewer/Compliance/Location trust, managed keys and revocation, actual Pay finality/reorg/refund/payout witnesses, multi-instance deployment/TLS/least-privilege database/backup/failover evidence, independent security and manual accessibility acceptance. Those requirements are deferred, not waived. Preserve `travel.bnb_booking=false` and fail-closed Travel Genesis financial/booking methods until independently approved and accepted.
