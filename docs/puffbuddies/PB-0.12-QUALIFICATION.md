# PB-0.12 qualification evidence

## Step

**PB-0.12 — User lifecycle**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.12 defines the canonical PuffBuddies account/application lifecycle states, transition authorities, transition constraints, revocation behavior, re-entry rules, and failure semantics.

## Implementation summary

PB-0.12 adds:

- PB-LIFE-001 through PB-LIFE-040;
- fourteen canonical lifecycle states;
- canonical transition and authorization rules;
- eligibility/profile activation gating;
- deactivation/reactivation;
- restriction/suspension/ban/appeal;
- deletion and post-deletion re-registration transitions;
- separation from Wallet/Identity/Names/Messenger/Notifications/Pay/client/session/queue authority;
- stale-state invalidation, fail-closed conflict handling, privacy, and auditability.

No lifecycle service, database, API, queue, worker, contract, fixed address, service ID, deployment, or live transition processing is introduced by PB-0.12.

## Files changed

- docs/puffbuddies/PB-0.12-USER-LIFECYCLE.md
- docs/puffbuddies/PUFFBUDDIES-ROADMAP.md
- scripts/verify-puffbuddies-pb0.py
- docs/puffbuddies/PB-0.12-QUALIFICATION.md

## Requirements satisfied

- PB-LIFE-001 through PB-LIFE-040 exist exactly once and in sequence;
- canonical states UNREGISTERED, ELIGIBILITY_PENDING, ELIGIBILITY_FAILED, PROFILE_INCOMPLETE, ACTIVE, DEACTIVATED, RESTRICTED, SUSPENDED, BANNED, DELETE_REQUESTED, DELETION_IN_PROGRESS, DELETION_COMPLETE, RETAINED_EVIDENCE_ONLY, and APPEAL_REVIEW are defined;
- entry and activation require current eligibility/profile conditions and cannot be created merely from Wallet/Identity/Names state;
- deactivation/reactivation, restriction/suspension/ban, appeal, eligibility-loss, deletion, and post-deletion re-registration transitions are explicit;
- lifecycle authority remains PuffBuddies-owned and separate from Wallet, Identity, Names, Messenger, Notifications, Pay, matches/blocks, sessions, clients, queues, and derived state;
- deactivation, restriction, suspension, ban, and deletion revoke applicable ordinary participation even when stale client/session/cache/queue/payment/match state disagrees;
- appeal, payment, wallet/name changes, client refresh, and dependency recovery cannot silently restore lifecycle permissions;
- DELETION_COMPLETE cannot transition directly back to ACTIVE and later return requires a new registration lifecycle;
- conflicting or unknown protected lifecycle state fails closed;
- lifecycle state remains private/non-enumerable and transitions require protected auditability;
- no lifecycle service, database, API, queue, worker, contract, fixed address, service ID, deployment, or live transition processing is claimed.

## Implementation SHA

`551a72dce79056288def809e9b4ccbf2367eb873`

## Current main/base SHA

Current main observed at PB-0.12 start: 2d3141e787c7c25bdea2dddd81b9a42a82637621

PR #526 remains open on the cumulative PB-0 branch. Current-main merge-candidate reconciliation remains deferred to the applicable Level 3 phase boundary.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Exact-head push qualification:
- run: `37382561715` — **PASS**
- job: `112007901982` (`pb0-fast`) — **PASS**
- exact-head checkout — **PASS**
- exact-head SHA verification — **PASS**
- cumulative PB-0 verifier — **PASS**
- accidental PuffBuddies runtime/contract implementation rejection — **PASS**

Exact-head pull-request qualification:
- run: `37382564473` — **PASS**
- job: `112007912140` (`pb0-fast`) — **PASS**

## Security/adversarial/invariant scope

The cumulative verifier must reject missing/duplicate/reordered PB-LIFE identifiers; Wallet/payment/client/session/queue ownership of lifecycle; stale authorization after deactivation/restriction/suspension/ban/deletion; direct DELETION_COMPLETE-to-ACTIVE restoration; appeal restoring access by itself; unknown lifecycle fail-open behavior; and false live lifecycle-processing claims.

## Milestone status

PB-0.12 is not treated as a Level 2 integration milestone because this step defines lifecycle policy/state-machine semantics only and introduces no executable lifecycle authority or cross-component integration.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.12.

Level 3 comprehensive repository qualification and current-main merge-candidate reconciliation remain deferred to the applicable phase boundary.

## Limitations

PB-0.12 defines policy/state-machine semantics only. Exact schemas, endpoints, transactional guarantees, queues, workers, event delivery, session revocation implementation, moderation tooling, eligibility integration, deletion processing, and operational SLAs remain later roadmap work.

## Blockers

None for PB-0.12.

## Completion state

**PB-0.12 — COMPLETE**

All canonical PB-0.12 exit criteria are satisfied on exact implementation SHA `551a72dce79056288def809e9b4ccbf2367eb873`.

## Next canonical roadmap step

**PB-0.13 — Matching principles**
