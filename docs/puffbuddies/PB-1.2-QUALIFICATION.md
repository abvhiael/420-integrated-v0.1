# PB-1.2 qualification evidence

## Step

**PB-1.2 — State Machines — COMPLETE**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Implementation summary

PB-1.2 implements fail-closed PuffBuddies-owned lifecycle and relationship state machines. It aligns the executable lifecycle vocabulary with all 14 PB-0.12 states, allowlists protected transitions by source/destination/authority, preserves deletion and safety supremacy, requires reciprocal-user authority for match formation, and rejects undefined or unauthorized transitions.

## Files in implementation scope

- `puffbuddies/domain/types.py`
- `puffbuddies/domain/state_machines.py`
- `puffbuddies/tests/test_pb_1_2_state_machines.py`
- `docs/puffbuddies/PB-1.2-STATE-MACHINES.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- retained PB-1.1 domain/tests and `.github/workflows/puffbuddies-pb1.yml`

## Requirements satisfied

1. All 14 PB-0.12 lifecycle states are executable and protected transitions are explicit.
2. Lifecycle transition authority remains PuffBuddies-owned; dependencies, clients and economic state are non-authoritative.
3. DELETE_REQUESTED and later deletion states are non-participating; DELETION_COMPLETE cannot directly reactivate.
4. Restriction/suspension/ban authority overrides ordinary participation; APPEAL_REVIEW does not restore access.
5. Relationship transitions cover unilateral like/pass, reciprocal match, unmatch and block supremacy.
6. Match formation requires reciprocal-user authority; algorithm/admin/payment authority cannot manufacture consent.
7. Undefined, unauthorized, stale-restoration and block-bypass transitions fail closed.
8. PB-1.2 introduces no persistence schema, API, worker, contract, fixed address, service ID, deployment or live integration.

## Exact implementation evidence

- implementation SHA: `d48babb7a4ad8a5abaa5db4bcee806bb30040fa7`
- current/main base SHA at qualification: `f32a9c322e085634e47f20b84861338811198454`
- branch: `puffbuddies-pb1-domain-20261006`
- PR: #535
- branch divergence at closeout: 13 commits ahead, 0 behind current main

## Level 1 CI evidence

Required workflow: **PuffBuddies PB-1 Qualification**

- workflow run: `37413808120` — **SUCCESS**
- job: `112107882885` (`pb1-fast`) — **SUCCESS**
- exact qualification head verification — PASS
- PuffBuddies domain/tests compilation — PASS
- retained PB-1.1 plus PB-1.2 unit/adversarial tests — PASS
- public-chain/secret-material negative check — PASS

The PB-0 historical qualification workflow also triggered and failed because its PB-0 verifier intentionally rejects PuffBuddies runtime implementation paths that PB-1 is now authorized to create. That workflow is not a PB-1 Level-1 gate and its failure is not counted as PB-1 evidence. No test was weakened or disabled to hide that historical-policy collision.

## Security/adversarial/invariant results

PASS coverage includes unauthorized reactivation, deletion resurrection, appeal-based access restoration, undefined transitions, unilateral match creation, algorithm/admin/payment consent fabrication, safety override behavior, block supremacy, and stale rematch/bypass denial represented by the canonical transition allowlist.

## Milestone status

PB-1.2 is **not** a Level 2 milestone. Level 2 remains deferred until the documented accumulated PB-1 domain/private-persistence integration milestone.

## Intentionally deferred Level 3 checks

Repository-wide Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Geth/global fault/soak qualification, broad Docs/global reconciliation, and unrelated app audits are intentionally deferred. PB-1.2 changes no Solidity contract, Genesis/frozen address, deployment, shared protocol interface, or external service integration requiring those suites at Level 1.

## Limitations / blockers

- No PB-1 persistence/API/deployment is claimed by this step.
- No live/testnet behavior is claimed.
- No PB-1.2 repository-side blocker remains.

## Completion state

**COMPLETE.** Every PB-1.2 exit criterion is satisfied against implementation SHA `d48babb7a4ad8a5abaa5db4bcee806bb30040fa7`.

## Next canonical roadmap step

**PB-1.3 — Private Persistence Schema**
