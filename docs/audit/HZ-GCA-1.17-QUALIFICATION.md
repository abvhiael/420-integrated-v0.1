# HZ-GCA-1.17 — Failure and recovery semantics qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.17 — Failure and recovery semantics**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `8df8a9521a02d0ca80bfc8977c85d6e67b2523f9`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.17**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.17 freezes deterministic failure, retry, partial-output, restart, reconciliation and degraded-mode semantics for Generate, ecosystem dependencies, Community, Charts, Awards and moderation/dispute flows.

The governing rule is:

**Reconcile canonical/source authority before retrying any action that can create spend, entitlement, publication, vote, moderation or remedy effects.**

## Implementation completed

Added:

- `hz/config/gca-failure-recovery-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.17-FAILURE-RECOVERY-SEMANTICS.md`
- `scripts/verify-420hz-gca-1-17.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Failure taxonomy

Frozen failure classes cover client/session failure, dependency outage/mismatch, timeout, cancellation, provider failure, partial output, verification failure, storage integrity, stale/reorged derived state, economics, rights/policy, Identity eligibility, duplicate/replay, moderation/dispute hold, notification delivery and operator/config failure.

### Provider failure / timeout / cancellation

Provider unavailability before submission creates no charge/entitlement.

After submission, state is reconciled before rematch/retry.

After accepted execution, provider/resource/economic/privacy/verification bindings remain frozen.

A client timeout is ambiguous until canonical reconciliation.

A local cancellation request is not proof of canonical cancellation and never implies paid refund.

### Partial-output semantics

Partial mix/stem/manifest artifacts may be retained only as explicitly identified partial output.

Partial output does not imply:

- SUCCEEDED;
- VERIFIED;
- REGISTERED;
- PUBLISHED;
- SETTLED.

Payment for partial output is permitted only if the frozen accepted canonical policy explicitly defines verified payable partial units.

### Retry / replay

Same logical operation + same idempotency key + same material payload reconciles/retries the existing operation.

Changed payload under an existing key fails closed.

New paid work after terminal failure/cancellation requires fresh authorization unless canonical recovery explicitly preserves the existing funded entitlement.

Retry cannot duplicate:

- charges;
- provider entitlements;
- publication;
- Community relations;
- Chart credit;
- nominations;
- votes;
- moderation;
- Arbitration remedies.

### Restart reconciliation

A 14-step recovery order now freezes restoration from highest authority to lower-authority projections:

1. network/service identity;
2. Wallet/session capability;
3. AI/Compute request/job/result state;
4. funding/settlement/refunds;
5. Storage/integrity/tombstones;
6. Creative/Rights/provenance;
7. private project state;
8. Community;
9. Charts;
10. Awards;
11. moderation/Arbitration;
12. Indexer/Search/Analytics;
13. Notifications;
14. resume privileged/money-moving work only after required reconciliation.

Durable idempotency/replay state must survive restart.

### Storage recovery

Recovered bytes must match integrity commitments.

Deletion/tombstone state beats replicas/backups/caches/projection rebuild.

Missing bytes cannot be replaced with different content under the same identity.

Partial/failed generation artifacts remain PRIVATE until an explicit publication succeeds.

### Economic recovery

Before new spend, recovery reconciles quote/funding/max/accepted-price/beneficiary/existing entitlement.

Provider earned/claimable/paid and payer refundable/claimable/paid remain distinct.

Settlement/refund outages preserve entitlement/claimability without falsely marking PAID/REFUNDED.

### Register & Publish recovery

Generate output never becomes publication authority.

Register/Publish retry revalidates Wallet authorization, Creative/Rights state, consent, disclosure, provenance and idempotency.

A lost response after successful registration resolves existing native Creator/Work/Recording IDs instead of creating duplicates.

### Identity / Awards recovery

Unique-human voting fails closed when the required Identity eligibility source is unavailable.

Lost vote response is reconciled before retry.

Ballot-scoped nullifier/voter keys cannot produce a second accepted vote.

Finalization remains deterministic and single-use.

Finalized results are not recomputed under later policy.

### Community / Charts recovery

Community mutations reconcile using logical relation/idempotency identity.

Replay cannot inflate Community counters or Chart credit.

Chart rebuild is deterministic from eligible signals + exact policy/window/checkpoint.

### Moderation / Arbitration recovery

Report retry cannot duplicate enforcement.

Append-only report/decision/appeal history is restored.

Moderator authority is revalidated after restart.

Vote-abuse recovery uses deterministic retally.

Optional Arbitration requires exact service/domain/origin/parties/finality/remedy/replay validation before bounded remedy consumption.

### Derived-service recovery

Indexer/Search/Analytics/Notifications remain non-authoritative during outage and recovery.

Notifications resume from consumer-owned checkpoints and delivery failure never rolls back source operations.

### Degraded modes

Nine explicit dependency-degraded modes now define safe behavior for AI/Compute, Storage, Creative/Rights, Identity, Pay/Vault, Indexer/Search, Notifications, Analytics and Arbitration.

### Operator recovery

Operators may pause affected surfaces to prevent unsafe duplicate effects but cannot fabricate canonical completion, settlement, Rights, votes, winners or Arbitration rulings.

## Recovery invariants

The manifest freezes **HZGCA-REC-001 through HZGCA-REC-018**.

The targeted verifier checks:

- exact failure taxonomy;
- provider/timeout/cancel/partial/malformed-output semantics;
- retry/idempotency/new-attempt behavior;
- exact 14-step restart order;
- durable replay state;
- Storage integrity/tombstones/privacy;
- economics reconciliation;
- Register/Publish duplicate prevention;
- Identity/Awards recovery;
- Community/Charts deterministic rebuild;
- moderation/Arbitration recovery;
- derived-service recovery;
- nine degraded modes;
- operator bounds;
- all 18 invariant identifiers;
- HZ-GCA-1.8/1.9/1.10/1.11/1.13/1.14/1.15/1.16 prerequisite consistency;
- no invented 420Hz service ID, endpoint or deployed address;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37744297713**
- Run number: **#212**
- Job: **HZ-GCA Level 1**
- Job ID: **113202017387**
- Exact tested SHA: `8df8a9521a02d0ca80bfc8977c85d6e67b2523f9`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifests;
3. retained HZ-GCA-1.1 through HZ-GCA-1.16 verifiers;
4. HZ-GCA-1.17 failure/recovery verifier.

The concurrently triggered **420Hz Web Qualification #132** also passed on the same exact implementation SHA. The global Docs workflow was still running when this Level-1 evidence was captured and is not a required HZ-GCA-1.17 gate under the documented ordinary-step policy.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `eda76676dab01a9b7f0368f811b6a1ddf9995515`
- Run ID: **37744067479**
- Job ID: **113201275487**
- Result: **FAIL**

Every retained HZ-GCA-1.1 through HZ-GCA-1.16 check passed.

Only the new HZ-GCA-1.17 verifier failed with:

- `cancellation rule missing: does not imply PAYER_REFUND_PAID`
- `storage recovery rule missing: remain PRIVATE`

Diagnosis: **test-harness wording defects**.

The normative manifest already stated:

- `cancellation never implies PAYER_REFUND_PAID without canonical payment evidence`;
- `partial or failed generation artifacts retain PRIVATE visibility unless an explicit later publication transition succeeds`.

Repair:

- aligned only verifier substring matching;
- changed no cancellation economics;
- changed no storage/privacy rule;
- removed no fail-closed assertion;
- weakened no retry/recovery invariant.

The repaired exact SHA passed.

## Security / adversarial result

Result: **PASS**

The verifier rejects recovery policy that:

- treats timeout as terminal without reconciliation;
- treats partial output as completed/published/settled;
- retries a paid operation before canonical reconciliation;
- loses durable replay/idempotency state;
- serves tombstoned/integrity-mismatched artifacts;
- spends while economics disagree;
- duplicates Creative IDs after lost response;
- weakens unique-human voting during Identity outage;
- duplicates votes after lost response;
- consumes stale/wrong-domain/non-final Arbitration remedies;
- allows derived services to override source truth;
- widens PRIVATE/UNLISTED state during dependency failure;
- permits operator fabrication of canonical state.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.17 is an ordinary architecture/recovery-policy step. It introduces no shared runtime recovery service or executable integration that independently triggers a Level-2 milestone.

The documented HZ-GCA-1 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- retained 420Hz suite;
- affected client/service/Indexer/Search/RPC/frontend/backend qualification;
- full adversarial/invariant/security/static-analysis qualification;
- deployment/config verification.

Solidity Contracts remains the sole canonical owner of the complete Foundry inventory. Genesis/address-authority remains separate and must not duplicate it.

## Limitations

HZ-GCA-1.17 intentionally does not implement or claim:

- runtime recovery daemon;
- persistent production idempotency store;
- live provider failover;
- actual job rematching;
- production backup restore;
- live Search/Indexer replay;
- live Notifications replay;
- live Arbitration recovery;
- testnet reorg/restart/failure evidence;
- production operational runbooks.

Those remain later implementation/testnet/production work.

## Blockers

None for HZ-GCA-1.17.

## Completion state

**HZ-GCA-1.17 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.18 — Architecture documentation consolidation**
