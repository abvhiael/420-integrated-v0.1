# BNB-4.4 — Privacy-Safe Search and Travel Consumer Synchronization / Level 1

**Repository disposition: LEVEL 1 PASS for bounded, app-local pull synchronization.** Independent Search/Travel operating deployments and legal authority remain **DEFERRED** under existing T-BNB gates. The implementation is **not** an activated external publication service or continuous push subscription.

## Canonical authority

- Step: **BNB-4.4 — Privacy-safe Search and Travel consumer synchronization**, [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md). M4-A Level 2: BNB-4.7; M4-B: BNB-4.11; one Level 3 at BNB-4.12.
- Audit branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`, [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631), open/draft/unmerged.
- Exact **qualified implementation SHA**: `c4aca92ee09310fa195ef8c800dcc8e0ddf0b546`. Main at final review: `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`, original Phase 4 base `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`; branch 49 ahead/408 behind at Level 1. Reconciliation with newer main awaits the canonical accumulated phase integration; no merge now.

## Implementation / boundaries

1. `services/420bnb/discovery_sync.py` rechecks canonical published property, independently signed Location/place binding, jurisdiction allowance and Compliance eligibility using source expiry/revocation and exact property version. Under the canonical property row lock it produces a **nonbinding** privacy-filtered snapshot or a **tombstone** when authority ceases. It excludes exact private address, guest account data, payment facts and high-precision geolocation. Coarse map markers are only the existing one-degree grid centers.
2. Migration `024_discovery_sync.sql` provides durable per-property publication revision/digest and per-consumer Search/Travel revision checkpoints. Recomputations with identical source digest are idempotent; true changes increase revision and transactionally append a bounded `bnb.discovery.changed` event to the preexisting outbox. Events carry property ID, revision, visible flag and digest, **not** private listing payloads. BNB-4.2 outbox delivery allowlist includes this sanitized event. Consumer-side `consume` rejects unknown consumers, stale/replayed revision, and forged payload mismatch to the current source snapshot.
3. `GET /v1/bnb/internal/discovery/{consumer}/{property_id}` provides **explicit pull-time revalidation** before transmitting a snapshot/retraction. It requires an independently signed scoped `BNB_DISCOVERY_CONSUMER` `discovery-read` claim matching both specific consumer and property. Unknown consumer or missing/wrong proof fails closed. This does not create or self-approve an operational issuer.
4. The **public** Search and Travel routes retain their existing independent-authority SQL filters and remain nonbinding. No new public mutation or externally activated Search/Indexer/Travel adapter, external provider key or high-precision map feed was authorized. Incremental revision tracking is present; continuous automatic propagation and live upstream consumer acknowledgment require separately governed integration evidence, not assumed here.
5. New `services/420bnb/tests/test_bnb44_discovery_sync.py` verifies forbidden publication defaults to tombstone, identical snapshot replay does not advance revision, privacy/private-address omission, coarse marker accuracy, signed-source revocation retraction, stale revision and consumer replay rejection, wrong consumer rejection, and nonexistent property denial. Existing app suites retain preexisting location/jurisdiction revocation and signed proof coverage.
6. Production image includes the new module. Migration/readiness, parallel deployment, restore-ledger and production schema acceptance verify all **24 ordered migrations**, preserving previous checksums, runtime role restrictions and recovery integrity.

## Exact-SHA Level 1 qualification

- 420BnB Runtime Slice [run 38449873712](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38449873712), job `115477716859`: terminal **SUCCESS**, **8 migration/ops + 244 runtime/API/security = 252 tests passed**, zero failures. Additional packaging, TLS, browser accessibility smoke, non-root container staging and backup/restore gates succeeded.
- Retained BNB-1.1…1.9 all **9/9 SUCCESS**, run IDs `38449873480`, `38449873665`, `38449873640`, `38449874355`, `38449874200`, `38449873568`, `38449873552`, `38449875400`, `38449873654`.
- Global Docs workflow `38449873914` **SKIPPED**; not credited as PASS. Unrelated Oracle audit `38449873642` **IN PROGRESS** at closeout inspection; not credited. No ceremonial global Solidity, Genesis, Integrated or Geth suite was dispatched for this app-only step.
- Superseded run `38449483155` failed backup/restore because a v23 ledger-length check remained after adding migration 024. The workflow check was corrected to v24 while retaining exact source/restored ledger equality; only the corrected exact-SHA successful run counts.

## Deferrals and qualification boundaries

- **T-BNB-TRAVEL-210 and T-BNB-TRAVEL-210A**: independently approved Location/Travel/Search/Indexer consumers, real signed issuer identities, external feed freshness/operational retraction, and measured consumer lag are not operationally certified.
- **T-BNB-COMPLIANCE-212**, official Identity/property, financial Pay/Wallet, real jurisdictional policy, external human/manual accessibility, independent security and operators remain governed by [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md).
- `travel.bnb_booking=false`; no real booking/payment or legally authoritative listing activation. Synthetic tokens, fixtures, local consumer checkpoints and app CI do not constitute independent deployment acceptance.
- **Current limitation:** change-event issuance occurs during authorized pull-time snapshot synchronization, not a separately deployed always-on producer. Transactional source mutations are still authoritative; an index client cannot assume continuous external push delivery from this Level 1 evidence. Preserve this for BNB-4.7 cross-component and testnet acceptance, not mislabel as operationally qualified.

**Next canonical step: BNB-4.5 — Guest and Host Messaging / Notifications.**
