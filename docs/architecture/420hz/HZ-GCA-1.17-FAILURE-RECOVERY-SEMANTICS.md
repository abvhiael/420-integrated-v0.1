# HZ-GCA-1.17 — Failure and recovery semantics

Status: **IMPLEMENTED — Level 1 failure/recovery definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-failure-recovery-v1.json`

This step freezes failure, retry, partial-output, restart, reconciliation and degraded-mode semantics for the complete 420Hz Generate + Community + Awards architecture.

It does not deploy a recovery daemon, production service, endpoint, contract address or live provider.

## Core recovery rule

**Reconcile canonical/source authority before retrying anything that can create spend, entitlement, publication, vote, moderation or remedy effects.**

Timeout, client disconnect, queue loss, provider silence or local UI failure is not proof that the underlying operation failed.

When canonical status cannot be established safely, 420Hz remains degraded/read-only or fails closed rather than guessing authority.

## Failure classes

The architecture distinguishes:

- CLIENT_OR_SESSION_FAILURE
- DEPENDENCY_UNAVAILABLE
- DEPENDENCY_MISMATCH
- TIMEOUT
- CANCEL_REQUESTED
- PROVIDER_FAILURE
- PARTIAL_OUTPUT
- VERIFICATION_FAILURE
- STORAGE_INTEGRITY_FAILURE
- STALE_OR_REORGED_DERIVED_STATE
- ECONOMIC_RECONCILIATION_FAILURE
- RIGHTS_OR_POLICY_BLOCK
- IDENTITY_ELIGIBILITY_FAILURE
- DUPLICATE_OR_REPLAY
- MODERATION_OR_DISPUTE_HOLD
- NOTIFICATION_DELIVERY_FAILURE
- OPERATOR_OR_CONFIGURATION_FAILURE

These classes do not silently collapse into one generic “failed” state where that would lose authority or economic meaning.

## Provider unavailable

Before generation submission, provider unavailability creates no provider entitlement or charge.

After canonical submission but before acceptance, retry/rematch begins only after reconciling AI/Compute request/job state.

After accepted execution begins, recovery preserves the accepted:

- provider/resource identity;
- price/economic terms;
- verification profile;
- privacy policy;
- payer/beneficiary bindings.

Provider failover may not silently rewrite those frozen terms.

## Timeout

A client timeout is ambiguous.

Recovery must query/reconcile using the existing:

- request/job ID;
- idempotency key;
- source domain;
- accepted provider/match references where present.

If the canonical job remains pending/running, observation resumes.

If a terminal state is confirmed, recovery follows that exact state.

A timeout does not authorize a second paid attempt.

## Cancellation

A local cancel action is only a cancellation request.

Cancel retry is idempotent against the same request/job identity.

After cancellation request, 420Hz must reconcile:

- final job state;
- provider entitlement;
- payer refundable/claimable/paid state;
- retained partial outputs.

Cancellation never means `PAYER_REFUND_PAID` without canonical payment evidence.

## Partial outputs

Partial mix/stem/manifest artifacts may be retained as PARTIAL_OUTPUT when explicitly identified by the provider/result manifest.

A partial artifact does **not** imply:

- SUCCEEDED
- VERIFIED
- REGISTERED
- PUBLISHED
- SETTLED

Partial output may earn payment only when the frozen accepted policy explicitly supports verified payable partial units.

Otherwise it remains reviewable/private output without settlement authority.

A user may keep it private, discard it, or start a new authorized generation attempt.

Reusing a partial artifact never bypasses rights, consent, privacy or provenance rules.

## Malformed or missing result

Malformed/missing output does not advance the job into valid result/verified state.

The job/result/evidence references remain available for retry/dispute/refund logic.

Hash/manifest mismatch fails closed as verification/storage-integrity failure.

## Retry semantics

Same logical mutation + same idempotency key + same material payload:

- reconciles to the existing logical operation; or
- safely retries the same transition.

Same idempotency key + changed material payload:

- fails as conflict/replay.

A new paid attempt after terminal failure/cancellation requires a fresh authorized intent/run unless canonical recovery explicitly preserves the existing funded entitlement.

Retry may never duplicate:

- payer charge;
- provider entitlement;
- registration/publication;
- follow/favorite/playlist state;
- Chart credit;
- nomination candidate;
- Award vote;
- moderation action;
- Arbitration remedy.

Automatic retry is forbidden when a new price, consent, rights scope, beneficiary, voter choice or moderation remedy must be authorized.

## Restart reconciliation order

After restart, restore in this order where applicable:

1. verify chain/network and canonical service identities/versions;
2. restore Wallet/session capability state without importing signing secrets;
3. reconcile AI/Compute requests, matches, jobs, results and verification;
4. reconcile payer funding, provider entitlement, refunds and settlement;
5. restore Storage manifests, integrity, tombstones and project references;
6. reconcile Creative/Rights publication, provenance, licenses and source permissions;
7. restore private 420Hz project/draft metadata;
8. rebuild Community source relations/privacy;
9. rebuild Charts from eligible source signals/checkpoints;
10. restore Awards season/category/nomination/ballot/vote/result history;
11. restore moderation/report/appeal/challenge and Arbitration references;
12. rebuild Indexer/Search/Analytics projections;
13. resume Notifications replay/delivery from notification-owned checkpoints;
14. accept new privileged or money-moving work only after required reconciliation agrees.

Lower-authority projections may never be restored ahead of the source authority they depend on.

## Durable replay protection

Protected mutation idempotency/replay state must survive restart.

In-memory queue loss cannot be treated as permission to create a second operation.

Unfinished operations resume from canonical/durable checkpoints.

## Storage recovery

Recovered artifact bytes are verified against their integrity commitment before use.

Deletion/tombstone state wins over:

- stale replicas;
- backups;
- caches;
- Search/Indexer rebuilds.

Missing bytes under an existing manifest are reported unavailable; different bytes may not be silently installed under the same identity.

Restored backups must reapply current privacy, retention and deletion state before becoming readable.

Failed/partial generation artifacts remain PRIVATE unless an explicit later publication succeeds.

## Economic recovery

Before any retry that could spend again, reconcile:

- current quote where applicable;
- payer maximum;
- actual funded credit;
- accepted price;
- beneficiary/provider;
- existing entitlement;
- refund/claimability state.

Provider:

- EARNED
- CLAIMABLE
- PAID

and payer:

- REFUNDABLE
- CLAIMABLE
- PAID

remain distinct.

Settlement outage preserves entitlement without falsely showing PAID.

Refund outage preserves claimability without falsely showing REFUNDED/PAID.

Economic disagreement blocks new spending.

## Register & Publish recovery

A generated result is not publication authority.

Register/Publish recovery rechecks:

- Wallet authorization;
- Creative/Rights source state;
- rights/consent;
- AI disclosure;
- provenance;
- idempotency.

If registration actually succeeded before a lost client response, recovery resolves the existing native Creator/Work/Recording IDs rather than creating duplicates.

If source rights/consent become stale or revoked before publication finishes, publication fails closed and the project/result remains unpublished.

## Identity / Awards recovery

If unique-human eligibility is unavailable, Identity-dependent Award voting is disabled/fail-closed.

It does not silently degrade to Wallet-only voting.

Lost vote response is reconciled against canonical Awards vote state before retry.

The same ballot-scoped voter/nullifier cannot create a second accepted vote.

Finalization recovery recomputes from the frozen:

- ballot;
- policy;
- accepted vote set.

It remains deterministic and single-use.

Finalized AwardResult history is not re-tallied under a later policy.

## Community / Charts recovery

Community mutations reconcile by logical relation/idempotency identity.

Event replay cannot inflate Community counters or Chart credit.

Charts rebuild from:

- eligible source signals;
- exact Chart policy;
- time window;
- source checkpoint.

Identical inputs must reproduce deterministic ordering.

Stale/reorged inputs trigger stale/degraded/fail-closed behavior according to Chart policy.

Search/Analytics rebuild never becomes source authority.

## Moderation / dispute recovery

Report retry is idempotent and cannot duplicate enforcement.

Moderation response loss is reconciled against append-only report/decision/appeal state.

Moderator/reviewer authority is revalidated after restart.

Vote-abuse recovery recomputes from accepted/invalidated vote state rather than operator-edited totals.

Optional Arbitration recovery verifies:

- canonical service;
- domain;
- origin;
- parties where applicable;
- finality;
- remedy;
- replay.

Case opening or stale ruling observation never auto-executes a remedy.

## Indexer / Search recovery

Indexer/Search outage does not mutate canonical state.

After recovery, projections rebuild from canonical sources/checkpoints.

Wrong-chain, stale or reorged projections cannot authorize privileged decisions.

Public discovery may become stale/degraded/unavailable while the owning canonical state remains intact.

## Analytics recovery

Analytics may lose and rebuild aggregate metrics.

That never authorizes ingesting protected private payloads simply to recreate metrics.

## Notifications recovery

Notification delivery failure never rolls back the source operation.

Replay resumes from notification-owned opaque checkpoints.

Stable event/dedupe keys prevent duplicate delivery effects.

Deep links/actions still require normal authorization after delivery.

## Degraded modes

Dependency failure has explicit safe behavior:

- AI/Compute unavailable → generation unavailable/observation-only
- Storage unavailable → affected artifact/project operations unavailable
- Creative/Rights unavailable → registration/publication disabled
- Identity unavailable → Identity-required Awards voting disabled
- Pay/Vault unavailable → affected spend/settlement actions disabled
- Indexer/Search unavailable → discovery stale/degraded/unavailable
- Notifications unavailable → delivery unavailable only
- Analytics unavailable → metrics stale/unavailable only
- Arbitration unavailable → Arbitration-required remedy path paused/fail-closed

No degraded mode may invent local authority.

## Operator recovery

Operators may pause:

- generation submission;
- publication;
- voting;
- ingestion;
- matching;
- moderation surfaces

to prevent duplicate or unsafe effects.

Operators may inspect identifiers/checkpoints and trigger bounded reconciliation.

They may not fabricate:

- canonical completion;
- settlement;
- Rights;
- votes;
- winners;
- Arbitration rulings.

Manual authoritative corrections require an auditable versioned correction path owned by the relevant domain.

## Failure conditions

Recovery fails closed when:

- timeout is interpreted as terminal without reconciliation;
- partial output is presented as verified/published/settled;
- retry could create a second paid attempt before reconciliation;
- changed payload reuses an existing idempotency key;
- durable replay state is lost;
- tombstoned or integrity-mismatched storage is served;
- economic state disagrees before new spend;
- lost Register/Publish response risks duplicate Creative IDs;
- Identity outage weakens unique-human voting;
- lost vote response could duplicate voting;
- identical Chart rebuild inputs produce nondeterministic rank;
- moderation retry duplicates enforcement or erases history;
- Arbitration state/remedy is stale, wrong-domain, unfinalized or non-allowlisted;
- derived services override source authority;
- dependency failure widens PRIVATE/UNLISTED visibility;
- operator action fabricates canonical state.

## Invariants

The machine-readable policy freezes **HZGCA-REC-001 through HZGCA-REC-018**.

Core guarantees:

- timeout is ambiguous until reconciled;
- retries are at-most-once logically;
- partial output is non-final;
- source authority recovers before projections;
- replay state survives restart;
- provider failover cannot alter frozen accepted terms;
- integrity/tombstones survive restore;
- economic recovery never fabricates payment/refund state;
- Register/Publish recovery resolves existing native IDs;
- Identity uncertainty fails closed for unique-human voting;
- vote/finalization recovery is replay-safe/deterministic;
- Community/Charts recovery cannot inflate state;
- moderation history stays append-only;
- Arbitration recovery remains bounded;
- derived recovery remains non-authoritative;
- Notification recovery cannot change source state;
- degraded mode disables/limits rather than guesses;
- this step creates no live recovery service or new authority.

## HZ-GCA-1.17 exit criteria

HZ-GCA-1.17 is complete when:

- provider failure, timeout, cancellation, malformed/missing result and partial-output semantics are explicit;
- retry/idempotency/new-attempt boundaries are explicit;
- restart reconciliation order and replay persistence are explicit;
- Storage/economics/Rights/publication/Identity/Awards/Community/Charts/moderation/Arbitration/derived recovery is explicit;
- degraded/operator-safe modes are explicit;
- targeted exact-head verifier passes;
- no runtime recovery service/address/endpoint/live provider/testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.18 — Architecture documentation consolidation**
