# BNB-3.6 / M3-A — Pay–Wallet reconciliation and Level 2 app integration evidence

**Repository-side status: M3-A Level 2 app integration PASS on exact implementation SHA; external financial authority, official testnet and finalized-reorg operational recovery DEFERRED.** This is an evidence-only document, not a new executable qualification candidate or permission to activate bookings/funds.

## Exact provenance

- Canonical step: **BNB-3.6 — Payments and refunds** in `docs/bnb/BNB-PHASE3-ROADMAP.md`; milestone **M3-A after BNB-3.6** includes BNB-3.2 through BNB-3.6 app infrastructure, Identity/authority, Travel, Compliance, Pay financial/permission/failure integration.
- Qualified implementation SHA: `b01b47a7e72e6af78d34fd965e29a81f95673ad8`.
- Audit branch `audit/bnb-phase3-infrastructure-20261012`, draft unmerged PR #620. PR base SHA observed `fa3ebf8bf70df341a91ad2efa701827ca2bea7e7`; branch is not the Level 3 reconciled merge candidate.
- Implementation changes: `services/420bnb/api.py`; tests: `services/420bnb/tests/test_bnb36_pay_authority.py`, `services/420bnb/tests/test_postgres_adversarial.py`; prior BNB-3.2–3.5 work preserved. No Pay/Wallet custody, Solidity, ABI, Genesis address or protocol-owned authority changed.

## Exact-SHA completed CI

- [420BnB Runtime Slice run 38330538809](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38330538809), job `115079027616`: terminal **SUCCESS**. Logs: **6 migration/operations tests PASS + 221 runtime/security/API tests PASS = 227 tests, zero failures**. PostgreSQL migrations, TLS, application security/API, packaged immutable non-root images, staging, web and browser accessibility, production startup, network/config and artifacts passed.
- Same candidate, retained BNB-1.1 source: `38330538820`; BNB-1.2 product: `38330538885`; BNB-1.3 domain: `38330538804`; BNB-1.4 authority: `38330538939`; BNB-1.5 financial: `38330538868`; BNB-1.6 backend: `38330538818`; BNB-1.7 guest/host: `38330538822`; BNB-1.8 security/privacy: `38330538872`; BNB-1.9 deployment/ops: `38330538925`. **All nine terminal SUCCESS.**
- Oracle `38330538772` terminal SUCCESS but not substituted for real Pay/Wallet authority. Docs `38330538812` intentionally SKIPPED under ordinary app-level policy; not asserted PASS. No unnecessary full Solidity/Genesis/Integrated/Docs inventory dispatched.

## Pay/Wallet contract reconciliation

- **Pay is the sole issuer:** signed scoped authority, payload hash, chain/asset, registry version, merchant activation, quote/frozen policy and payout-controller checks. Missing/mismatched evidence denies before economic mutation. No client-authored financial finality.
- **Wallet consent:** Pay attests `wallet_consent_verified=true` bound to the exact invoice ID, quote UUID and reservation UUID. Negative tests deny absent or cross-invoice consent; BnB itself does not execute wallet transactions, and `wallet_execution_available=false` remains correct.
- **Invoice replay/immutability:** repeated Pay intent is accepted as idempotent only when all original merchant/controller, chain, asset, amount, quote, invoice expiry and conversion-route fields are unchanged; mutated value or invoice returns 409. Direct unsigned/forged provenance fails.
- **Finality:** independently signed canonical Pay receipt and invoice/payment ID, domain and fingerprint guards; receipt/event replay uniqueness; an expired/cancelled hold routes late finality to `recovery_required`, without rebooking inventory. A signed receipt is a Pay-issued assertion, not on-chain proof performed by BnB.
- **Failed payments and provider outage:** independently signed `settlement_failed` / `provider_unavailable` failures transition pending reservations/intents to `recovery_required`; replay/JTI collision fenced and stored in audit/outbox. Post-finality `reorg`/`finality_revoked` is intentionally **rejected with `FINALIZED_PAYMENT_REQUIRES_PAY_RECOVERY`** rather than reversing confirmed state or releasing inventory based only on an asynchronous callback. This is a fail-closed boundary, **not** demonstrated production Pay-side reversal/reorg settlement.
- **Refund/payout conservation:** Pay-only immutable captured split (host/platform/developer/retained); cumulative reserved+finalized disbursements bounded by same-asset captured amount and beneficiary share; refund authorizations require original-payer assertion and exact recipient; host payout requires post-checkout fulfillment, completed dispute window and authorized controller; replayed receipts and mutated operations denied. No BnB custody.
- **Privacy/security:** projections limited to authenticated reservation guest; sensitive authority proofs/raw wallet material never used as self-authorizing guest claims. Existing Compliance/Travel/Identity restrictions and inactive booking release preserved.

## M3-A milestone boundary and limitations

The retained source, domain, authority, money, backend, guest/host, security, operations and runtime suites above collectively constitute the documented **Level 2 M3-A app-scoped suite**, and each workflow completed successfully on the identical SHA. M3-A repository-side qualification is **PASS** for those simulated/service-boundary cases, not a claim that a real Pay/Wallet issuer or real blockchain was exercised. A formal official testnet finalized-reorg *resolution* procedure is unavailable: after finalized reorg notification the BnB endpoint deliberately refuses to change financial state; resolving canonical Pay ledger/finality, restoration/compensation and payout outcomes remains a separately gated external integration scenario, not a synthetic PASS. Any later executable changes require a fresh SHA and relevant qualification.

**External BLOCKED/DEFERRED:** `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1`, `T-BNB-PAY-2`, `T-BNB-SETTLEMENT-3`, plus relevant Identity/Compliance/Travel issuer/operator prerequisites. Independent deployed Pay contracts and Wallet issuer, live chain/finality/reorg, merchant/provider, actual consent and beneficiary payouts, concurrent multi-instance fund movement, operational recovery and legal/security acceptance are not yet witnessed. `travel.bnb_booking=false`, no real payment/payout activation, PR remains draft/unmerged.

Level 3 complete app-phase qualification remains **BNB-3.12** against current-main reconciled exact merge candidate. Next canonical roadmap step after M3-A repository-side qualification: **BNB-3.7 — Guest experience**.
