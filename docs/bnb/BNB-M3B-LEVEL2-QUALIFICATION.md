# 420BnB M3-B — Level 2 guest/host/trust/operations integration qualification

**M3-B app-focused Level 2: PASS** on **exact implementation SHA `0730e78eaac10dc18ca29e46eb6706cd75465cb6`**, with explicit external/testnet limitations below. This certification is confined to repository-controlled 420BnB source and deterministic fixtures. It is **not** an independent production-equivalent acceptance, legal retention signoff, custody/finality approval, or BNB-3.12 Level 3 closeout.

**Repository:** `abvhiael/420-integrated-v0.1`. **Audit branch:** `audit/bnb-phase3-infrastructure-20261012`; **PR:** #620, draft, open, unmerged. **Observed PR base SHA:** `fa3ebf8bf70df341a91ad2efa701827ca2bea7e7` (not independently reconciled to newest `main`; Phase 3 Level 3 owns that).

## BNB-3.9 — appeals, separate authority and retention controls

Implementation in `services/420bnb/api.py`, migration `services/420bnb/migrations/021_appeals_retention.sql`, PostgreSQL adversarial suite `services/420bnb/tests/test_bnb211_postgres_adversarial.py` and existing BNB-3.9 abuse-report replay unit tests.

- Participants can file one bounded appeal for an independently finalized abuse report. Identical replay is recognized; altered grounds are rejected. Appeals require active Identity sessions and a report belonging to the appellant. Independent signed `BNB_GUEST_REVIEW` appeal decision proofs bind the exact appeal and decision, enforce single decision/nonce, and reject the appellant **and the original deciding moderator**. Decision audit preserves outcome; overturn does **not** automatically republish content or grant financial/remedy authority.
- Appeal submission installs a monotonic 90-day minimum narrative retention hold; legal holds can be recorded using the separate `bnb_privacy_retention_hold` structure. Independently signed, report-scoped redaction of abuse narrative requires a finalized report older than 90 days, no active hold/pending appeal, and an unused signed nonce; immutable decisions and action audit remain retained. Age/hold denial and reviewer separation are exercised in PostgreSQL tests. The 90-day minimum is an **application safeguard**, **not an independently approved jurisdiction-by-jurisdiction retention schedule**.
- Abuse-report exact duplicate/reason/detail collision defenses, protected messages, host responses, guest-review moderation, quarantine, appeal audit and reputation export retain the previously-qualified independent review/replay boundaries.
- Broader private-message/media/document deletion, legal retention schedule by data class, live reputation retraction propagation and independent moderation staffing require separately authorized policy/operator and production-equivalent testnet verification; not claimed PASS here.

## BNB-3.10 — repository-controlled fault qualification

- PostgreSQL advisory single-writer/checksum migration ledger, concurrent migrators and drift/untracked-schema denial; production schema-21 authorization, TLS/role/DDL prohibitions and package/configuration checks.
- Database readiness fail-closed on connection failure/resource exhaustion with `503 DATABASE_UNAVAILABLE`, secret-safe body, preserved schema drift guard and redacted operational logging.
- Outbox transaction crash before commit rolls back its event; retry yields one durable event; duplicate ID is denied. This is **transactional outbox atomicity**, **not proof of eventual delivery to an independently deployed consumer**.
- Retained capacity/booking lock, expiry/replay, quote/Pay conservation tests and container-backed PostgreSQL restore rehearsal; browser keyboard/axe mobile/desktop smoke, ingress/config checks and packaged production non-activation assertions.
- Actual encrypted off-host backups, timed two-instance deployment/failover, RTO/RPO, on-call drills, external secret/KMS operation and real external outbox delivery remain **T-BNB-OPS-214 / T-BNB-SECURITY-213** testnet/operator gates.

## M3-B / BNB-3.11 provider, economic and privacy coverage matrix

| Boundary / provider | Repository acceptance on this SHA | Independent/live gate |
| --- | --- | --- |
| 420Identity, session lifetime, revocation, cross-principal IDOR | **PASS synthetic/app tests**: `test_identity.py`, `test_postgres_adversarial.py`, BnB scoped API | Independently controlled Identity issuer and revocation at testnet |
| Property/controller, host delegation, version CAS, concurrent calendar, revoked manager | **PASS app PostgreSQL tests**: `test_postgres_adversarial.py` host/workspace and 420BnB retained authority | Independent real property/controller attestation |
| 420Travel/Location/Search visibility and coarse map handoff | **PASS synthetic/app tests**: `test_travel_authority.py`, `test_travel_location.py`, travel/discovery tests | `T-BNB-TRAVEL-210/210A`; real Search/Indexer freshness |
| 420Compliance jurisdiction, source prohibition, expiry and binding | **PASS synthetic/app tests**: `test_bnb212_compliance.py` and PostgreSQL constraints | `T-BNB-COMPLIANCE-212` source/legal attestation |
| Quotes, holds, reservation lifecycle, cross-instance concurrency and retries | **PASS app tests**: `test_postgres_adversarial.py`; BNB-3.11 guest-to-host negative lifecycle | `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1` |
| 420Pay/420Wallet, split/conservation, finality, failure, reorg, refund and payout | **PASS signed synthetic claims/app accounting tests**: `test_bnb36_pay_authority.py` and PostgreSQL economics; wallet execution disabled | Real Wallet consent, transactions, reorg and independent Pay acceptance `T-BNB-PAY-2`, `T-BNB-SETTLEMENT-3` |
| Guest/host browser, private messaging, refunds/status wording, abuse reporting | **PASS browser smoke and app tests**: `browser_accessibility.py`, `test_postgres_adversarial.py`, trust adversarial cases | Manual screen-reader / device witness `T-BNB-ACCESSIBILITY-1` |
| Media/reviews, reputation, abuse moderation, appeal/retention | **PASS app PostgreSQL and unit cases**: `test_bnb211_postgres_adversarial.py`, `test_bnb39_trust_safety.py`; no automatic reinstatement | `T-BNB-MEDIA-1` and `T-BNB-REPUTATION-211`, legal policy approval |
| Infrastructure/Oracle/operations, backup/fault/recovery and redaction | **PASS BNB runtime/ops fixtures**, Oracle independent app workflow **not treated as PASS until terminal** | `T-BNB-OPS-214`, `T-BNB-SECURITY-213`, official network/operator |
| Global 420 Integrated, full Solidity, Genesis, global Docs, Geth, cross-app production integration | **NOT RUN at M3-B by three-level policy** | Mandatory exact-candidate BNB-3.12 Level 3; do not infer PASS |

Matrix marks only the **local synthetic/app assertions**, never real external authority or operations.

## Exact CI evidence

On implementation SHA `0730e78eaac10dc18ca29e46eb6706cd75465cb6`:
- [420BnB Runtime Slice **SUCCESS**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38345014544), job `115124280519`: **8** migration/operations tests passed, **226** runtime/API/security tests passed; **234 passing tests, zero failures**, two pytest warning summaries. Workflow also passed browser accessibility, package/build/ingress and isolated backup/restore stages.
- Retained BNB-1.1–1.9: **9/9 SUCCESS**: `38345014553`, `38345014712`, `38345014550`, `38345014545`, `38345014547`, `38345014542`, `38345014575`, `38345014556`, `38345014551`.
- 420Docs global `38345014549`: **SKIPPED intentionally**, not PASS. 420Oracle audit `38345014579`: **PENDING at certification inspection**, not PASS or required substitute for independently witnessed Oracle/testnet behavior.
- No redundant global Foundry/Genesis/Integrated run was dispatched for this app milestone.

## Release guards and handoff

Keep `travel.bnb_booking=false`, production booking/financial execution disabled, no self-certification of Pay/Wallet/registry/Media/reputation/legal authority, and PR #620 draft/unmerged. This M3-B app Level 2 PASS does not close unapproved external semantics. BNB-3.11 end-to-end implementation/testnet limitations remain recorded in `BNB-3.11-END-TO-END-QUALIFICATION-WIP.md`.

**Next canonical milestone:** BNB-3.12 — Phase 3 Level 3 closeout only **after** all remaining repository-side requirements are reconciled and one exact merge-candidate SHA is established against current main. At Level 3 full Solidity and independent Genesis address authority each run their own distinct inventories once.
