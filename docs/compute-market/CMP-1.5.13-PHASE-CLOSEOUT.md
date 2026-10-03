# CMP-1.5.13 — Phase closeout

Status: **IMPLEMENTATION/RECONCILIATION COMPLETE; LEVEL 3 QUALIFICATION PENDING.**

## Canonical definition

> Phase closeout

CMP-1.5 is the ComputeStake phase. This is the final reconciliation boundary for CMP-1.5.0 through CMP-1.5.12.

## Reconciliation baseline

Current main reconciled: `14d46231aa4350b2e84dee52f0f664bdd2e785f4`.

Main-to-closeout reconciliation merge: `9c03abbfced96da2358c380a99fa3281cedf1ae2`.

At reconciliation the closeout branch is **0 commits behind main**.

## Gap analysis

The closeout audit found one stale bookkeeping gap: CMP-1.5.7 remained marked qualification-pending in its roadmap/document despite PR #475 exact head `7fd48bcdf2ecbc618d110b34d5b081d2f3cca874` passing Solidity #4034, Compute #124, Genesis #818, Registry #653, Docs #4247 and Indexer #1636.

CMP-1.5.13 records durable CMP-1.5.7 evidence and corrects that stale status.

All CMP-1.5.0 through CMP-1.5.12 now have durable qualification evidence.

## Phase inventory

The machine-readable phase inventory is:

`contracts/config/compute-market/cmp-1.5.13-phase-closeout.json`

It inventories phase-owned source/interfaces, retained tests, all thirteen prerequisite configs/evidence files, release-candidate package, authority boundaries and directly affected client surfaces.

## Authority and economic boundaries

Closeout preserves:

- payer escrow cannot become stake, slash backing or reward backing;
- worker/verifier collateral is separately Vault-backed and slashable only under qualified policy/evidence;
- reward backing is separate from collateral;
- validator stake and arbitrary wallet balances are invalid substitutes;
- WorkerRegistry stake integration is read/admission-only;
- ComputeEscrow cannot authorize slash;
- ComputeStake cannot settle/refund payer jobs;
- ProtocolRegistry publication grants discovery/version authority only.

## Client/service reconciliation

Direct ComputeStake consumer search found the retained Compute worker SDK surface in `packages/420-sdk`, including stake policy/reference reads. Level 3 therefore requires SDK build/tests.

No direct ComputeStake consumer was found in 420-rpc or Search, so those are non-applicable to this phase rather than silently omitted.

The global Indexer qualification remains required because closeout changes the shared contract/config evidence surface and validates retained contract/address dependencies.

## Repository qualification versus live deployment

Repository closeout does not fabricate live deployment.

The CMP-1.5.12 release package remains repository-ready and live-blocked. Real public-testnet addresses, deployment transactions/blocks, runtime hashes, live graph bindings and governance-authorized ProtocolRegistry publication remain external/live evidence for later CMP-9.

## Level 3 qualification gate

The exact accumulated merge-candidate SHA must pass:

1. Solidity Contracts canonical full repository Foundry inventory using four balanced shards, including deployable size checks;
2. Genesis Address Authority canonical address/namespace/predeploy verification, without duplicate full Foundry;
3. 420 Integrated Qualification global offline-core, production-dependency, Geth-engine and fault/soak jobs;
4. 420Docs Qualification global documentation/reconciliation;
5. retained Compute Market build, Compute*.t.sol suite and CMP verifiers;
6. 420Indexer global qualification;
7. @420/sdk build and tests;
8. CMP-1.5.12 repository-ready verifier plus live-fail-closed assertion;
9. CMP-1.5.13 closeout verifier;
10. all required adversarial/invariant/security/accounting/replay/failure-path coverage retained by the above owners.

No failed, cancelled, missing or required-untriggered gate counts as passing.

## Completion

CMP-1.5.13 may be marked COMPLETE only after every Level 3 owner above passes on one exact reconciled implementation SHA and durable evidence records that SHA.

Live deployment remains separate.

Next canonical roadmap step after successful closeout:

**CMP-2.1 — Worker offers**
