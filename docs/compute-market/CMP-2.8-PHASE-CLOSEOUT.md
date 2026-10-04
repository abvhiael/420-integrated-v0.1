# CMP-2.8 — Phase closeout

Status: **RECONCILIATION COMPLETE; LEVEL 3 QUALIFICATION PENDING.**

## Canonical definition

> Reconcile the accumulated matching-market graph, run the required Level 3 qualification, preserve durable evidence, and prepare the handoff to CMP-3 — node420 worker runtime.

## Reconciliation baseline

Current `main` reconciled: `834fcdd58bbe597716657bf69d3f302897f7227f`.

Main-to-CMP-2 closeout reconciliation merge: `808748b291164e38e0c67afc6640b989815dfb48`.

Immediately after reconciliation, the CMP-2 branch was **0 commits behind main**.

The only file changed independently on both sides of the original merge base was `.github/workflows/contracts-foundry.yml`. The reconciliation preserves current-main Launchpad qualification triggers/exception handling and the CMP branch's stronger full-history Compute scope classifier, SDK-aware Compute paths and four-shard inventory implementation.

## Phase inventory

The machine-readable inventory is:

`contracts/config/compute-market/cmp-2.8-phase-closeout.json`

It freezes the accumulated CMP-2.1 through CMP-2.7 production sources, retained tests, configuration, qualification evidence, authority boundaries and affected SDK surface.

## Prerequisite disposition

CMP-2.1 through CMP-2.7 are all repository-qualified with durable evidence.

CMP-2.8 does not reopen their individual qualification claims. It reconciles the accumulated graph against current main and comprehensively requalifies the resulting exact merge candidate.

## Authority and security boundaries

Closeout preserves:

- worker offers and requester constraints are advertisement/authorization surfaces, not custody or settlement authority;
- schedulers remain replaceable proposal-only actors;
- only the canonical requester acceptance path creates an accepted market match;
- stale request, offer, resource or provider state fails closed;
- accepted provider/resource/beneficiary/pricing commitments remain historical immutable snapshots;
- pricing uses deterministic integer arithmetic, bounded ceilings and overflow-safe quoting;
- CMP-1.3 WorkerSnapshot/capacity remains the reservation authority;
- matching adapters cannot reserve capacity directly;
- duplicate match, replay, overbooking, unauthorized acceptance and hostile economic paths remain failure-atomic.

## Client/service reconciliation

The directly modified client surface is `packages/420-sdk`, so SDK build/tests are mandatory.

The global 420Indexer workflow is mandatory because the phase adds shared contract/config state consumed by repository indexing/contract-discovery qualification.

420RPC, Search and user-facing frontend/backend surfaces were not modified or introduced by CMP-2 and have no direct CMP-2 matching-market consumer in this phase; they are therefore non-applicable direct clients rather than silently omitted.

## Repository qualification versus live deployment

CMP-2.8 is a repository phase closeout, not a live-network claim.

Real worker execution belongs to CMP-3. Public funded matching, deployed addresses/transactions, real reservation/settlement flows, ProtocolRegistry publication and live soak evidence remain later canonical CMP-9/testnet work.

## Level 3 qualification gate

One exact accumulated merge-candidate SHA must pass:

1. **Solidity Contracts** canonical full repository inventory exactly once, using four balanced Foundry shards with deployable bytecode/initcode size checks;
2. **Genesis Address Authority** address, namespace, collision, frozen/predeploy and manifest-authority verification without duplicating the full Foundry inventory;
3. **420 Integrated Qualification** global offline-core, production-dependency, Geth-engine and fault/soak qualification;
4. **420Docs Qualification** global documentation/reconciliation;
5. **Compute Market Qualification** retained Compute build, full `Compute*.t.sol` app suite, all CMP verifiers including CMP-2.8, and affected SDK build/tests;
6. **420Indexer** global/shared consumer qualification;
7. retained CMP-2.7 adversarial/invariant/security campaign;
8. deployment/config/static/build/lint/type checks owned by the workflows above.

No failed, cancelled, missing, stale, skipped-required or untriggered required gate counts as passing.

## Full Solidity ownership

Solidity Contracts is the sole owner of the canonical complete Foundry inventory for this closeout.

The CMP-2.8 closeout marker deliberately forces this PR out of the Compute-only fast path and into the four balanced `pr-shards` inventory. Genesis separately owns address authority and must not rerun that Foundry inventory.

## Completion

CMP-2.8 may be marked **COMPLETE** only after every applicable Level 3 owner passes the same exact merge-candidate implementation SHA and durable evidence records all run/job results.

After successful closeout, the next canonical phase is:

**CMP-3 — node420 compute worker runtime**
