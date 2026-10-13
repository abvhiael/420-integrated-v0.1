# BNB-4.1 — Phase 3 integration baseline and Phase 4 boundary map

**Step:** BNB-4.1 — Phase 3 integration baseline and Phase 4 boundary map. **Qualification:** Level 1 app-scoped; M4-A BNB-4.7, M4-B BNB-4.11 and Level 3 BNB-4.12 remain future milestones. **No live release authorization.**

## Canonical predecessor and integration proof

- Approved Phase 4: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md); status OWNER APPROVED repository development only.
- Phase 3 certified implementation: `cfe6e0f689c44d27597b4373659df8260487a308`; 18/18 exact-SHA workflows PASS, four canonical Foundry shards, post-shard fixture, independent Genesis, global Docs, Integrated, Oracle, Indexer, BNB retained app CI.
- Final Phase 3 evidence-only HEAD `0070883bef7e5210a646bf395647eb436666e077`, PR #628 merged to `main` via merge commit `847142aa402d40cd342c8d7ed236ee8f4ea619ba`. Original PR #620 source is integrated by PR #628; its closure is not a second independent implementation merge.
- Current main baseline when BNB-4.1 branch was cut: `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`. The intervening main commit after Phase 3 integration added **only** `docs/bnb/BNB-PHASE4-ROADMAP.md`: GitHub compare `847142aa…main` = ahead 1 / one file. Therefore no Phase 3 executable file was overwritten by later main changes.
- Current audit branch: `audit/bnb-phase4-bnb-4-1-baseline-20261013`, [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631) draft/unmerged. Changes are baseline verifier + this evidence, not new application authority.
- A GitHub merge commits parentage and current main comparison carry the same previously qualified Phase 3 tree; **the prior CI qualification cannot be transferred to any newly changed executable SHA**. The new BNB-4.1 verifier must receive exact-head Level 1 evidence.

## Active repository ownership and execution inventory

| Boundary | Files / runtime behavior | Authority and restriction |
| --- | --- | --- |
| Guest/host API | `services/420bnb/api.py`, FastAPI `/v1/bnb/**`; `/health/live`, `/health/ready`, property/listing/search, calendar, availability, holds, booking, quote, messaging, reports, moderation, internal pay callbacks | BnB verifies principal scope, transactions and request roles; never assumes signed authority based on client headers; client-supplied financial finality never authoritative |
| Session and property | `services/420bnb/identity.py`, `authority.py`; external issuer/session, signed capability and revocation/expiry checks | Real 420Identity issuer and lawful property controller approval remain external |
| Location / public projection | `services/420bnb/travel_location.py` and `/v1/bnb/travel/*`, `/v1/bnb/search`, `/v1/bnb/listings` | Location/jurisdiction independent source approval, coarse location, eligibility and visibility/retraction required; Search/Indexer external consumers |
| Compliance | `/v1/bnb/compliance/eligibility* `, jurisdiction policy and revocation, signed proof scopes | 420Compliance is the legal source, not BnB; keep stale/expired/revoked decisions fail closed |
| Availability | `services/420bnb/calendar_engine.py`, `/v1/bnb/availability`, calendar import, unit calendar and blocks | Calendar issuer proofs for external imports; revision and hold accounting remain app-owned |
| Price/Pay/Wallet/Swap | `services/420bnb/pricing.py`, quotes, booking/hold lifecycle, `/v1/bnb/internal/pay/*` callback endpoints | Independent Pay/Wallet consent, invoices, settlement, escrow, finality and payer/beneficiary authority, no BnB custody |
| Reviews/Media/Reputation | Guest reviews, host responses, abuse reports/appeals, independently signed internal decision routes; `BNB_REPUTATION`, `BNB_GUEST_REVIEW`, `BNB_MEDIA_REVIEW` source scopes | BnB records and enforces signed decisions, never self-issues external reputation/media reviewer authority |
| Operations/notification | `services/420bnb/production.py`, `migrate.py`, migration `001` through `021_appeals_retention.sql`; 21 ordered PostgreSQL migrations and outbox event rows | Durable external notification delivery and worker operational acceptance are **not** implied by transactional outbox inserts; BNB-4.2 owns consumer/replay/retry hardening |
| Web and infra | `web/bnb/index.html`, `web_server.py`, two API instances, dedicated web and TLS ingress, separate runtime and migrator DSNs in `compose.production.yml` | Image digests, verified TLS, least-privilege runtime role, explicit migration role; no claim of actual managed DB provision, external signing custody, human accessibility or production failover |
| App CI and tests | `.github/workflows/bnb-runtime.yml`, `services/420bnb/tests/**` | PR path-triggered app runtime, PostgreSQL 16, 21-migration integrity, negative auth/accounting checks, browser accessibility and packaging/build; scoped BNB-4.1 test is `test_bnb41_phase4_baseline.py` |

## Signed proof/authority boundary map

| Canonical owner | BnB verifier / consumer surface | Independent gate |
| --- | --- | --- |
| 420Identity / Wallet sessions | `verify_external_token`, authenticated guest/host/session/recovery | T-BNB-IDENTITY-1, T-BNB-IDENTITY-2 |
| Approved legal property issuer | Property and controller claims, scoped delegated manager mutations | T-BNB-PROPERTY-1, T-BNB-INTEGRATION-1 |
| Location, 420Travel, public Search and Indexer | `BNB_LOCATION_AUTHORITY`, jurisdiction snapshots, coarse map, publication/retraction | T-BNB-TRAVEL-210, T-BNB-TRAVEL-210A |
| 420Compliance and independent jurisdiction source | `BNB_COMPLIANCE_AUTHORITY`, legal eligibility, revocation | T-BNB-COMPLIANCE-212 |
| Approved calendar feed | `BNB_CALENDAR_SYNC` import decisions, stale/outage rejection | T-BNB-CALENDAR-1 |
| Merchant/tax source, 420Pay, 420Swap, Wallet | Signed quote and internal Pay callback admission; lifecycle accounting | T-BNB-QUOTE-1, T-BNB-BOOKING-1, T-BNB-PAY-2, T-BNB-SETTLEMENT-3 |
| Independent media/reputation reviewers | `BNB_MEDIA_REVIEW`, `BNB_REPUTATION`, `BNB_GUEST_REVIEW`, appeal/reviewer separation and retention holds | T-BNB-MEDIA-1, T-BNB-REPUTATION-211 |
| Real security and production operators | managed issuer secrets, API replicas, DB recovery, accessibility human witness | T-BNB-SECURITY-213, T-BNB-OPS-214, T-BNB-ACCESSIBILITY-1 |

**17/17 canonical T-BNB headings** remain unchanged in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md). This is a boundary inventory, not evidence of independent legal, provider or testnet approvals.

## Source-anchored failure and safety invariants

1. No real booking/payment/listing visibility without all independently authorized inputs; **`travel.bnb_booking=false`**; BnB cannot originate escrow/finality/settlement truth.
2. Principal, owner, property and issuer must match signed scopes; key revocation, replay, expiration, wrong audience/chain and unavailable providers fail closed.
3. Indexer/Search/Travel publication cannot expose precise private property coordinates or stale/revoked eligibility.
4. Wallet/original payer and canonical Pay settlement splits must remain immutable, idempotent and conservation preserving.
5. Media/reputation appeals and privacy redactions require signed independent reviewer authority; no reviewer self-approval; a 90-day local hold is **not** a jurisdictional retention approval.
6. Production two-instance failover, encrypted off-host backups, recovery objectives and independent WCAG screen-reader signoff remain **DEFERRED** pending real witnesses.
7. M4-A/M4-B and Level 3 remain untriggered because BNB-4.1 is a baseline/traceability step. No duplicate full Solidity, Genesis or global qualification is appropriate here.

## Level 1 acceptance checklist and CI evidence

- [x] Locate original BNB-4.1 scope, preserve BNB-4.2…4.12 sequence and milestone owners.
- [x] Verify Phase 3 implementation/evidence SHA, integration commit and absence of later source changes in main as observed on branch creation.
- [x] Inventory real API, source modules, PostgreSQL ledger (21 migrations), production components and app-scoped CI.
- [x] Map every external authority/gate and preserve activation prohibitions, no new issuer permissions.
- [x] Implement scoped repository-verifier `services/420bnb/tests/test_bnb41_phase4_baseline.py`.
- [ ] **Exact-SHA Level 1 app CI** — require GitHub `420BnB Runtime Slice` SUCCESS on the final changed test SHA. Record run/job IDs and actual checkout before claiming BNB-4.1 Level 1 COMPLETE. If CI fails, diagnose; do not waive failing scope.
- [ ] Refresh main comparison immediately before certificate closeout and record evidence-only HEAD.
- [ ] Confirm required final source lines/routes in CI and correct any stale assertion rather than weakening protection.

**Current state: implementation and documentation prepared; Level 1 exact-SHA CI PENDING until terminal result.** BNB-4.1 must not be treated as fully qualified on preliminary evidence.

**Next canonical step after successful Level 1 certification:** **BNB-4.2 — Durable notifications and outbox delivery**.
