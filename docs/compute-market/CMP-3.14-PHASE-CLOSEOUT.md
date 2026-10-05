# CMP-3.14 — Phase closeout

Status: **COMPLETE — Level 3 exact-head qualified.**

## Canonical definition

Reconcile the complete accumulated CMP-3 node420 worker runtime against current `main`, run the required Level 3 qualification on one exact merge-candidate implementation SHA, preserve durable evidence, and prepare the handoff to **CMP-4 — Scientific compute framework**.

## Reconciliation baseline

Current `main` reconciled: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`.

GitHub exact test merge of current main and the prior CMP head: `c72d4795e178b66a1d4ae4737af8033f475a736a`.

Reconciled branch anchor: `c62b01be3dfed2618e8b0bbedf8c8e73e5fd02b1`.

After reconciliation the CMP-3 branch is **0 commits behind main**. The active implementation SHA for Level 3 is the final substantive closeout commit that contains this inventory, workflow ownership update and verifier.

## Phase inventory

Machine-readable inventory:

`contracts/config/compute-market/cmp-3.14-phase-closeout.json`

CMP-3.1 through CMP-3.13 remain individually qualified and are revalidated in accumulated form by the retained worker suites.

## Authority and security boundaries

Closeout preserves all previously qualified boundaries:

- the worker runtime cannot create canonical protocol state by itself;
- execution-key signatures prove worker attribution, not result correctness;
- result/evidence upload receipts prove delivery, not settlement entitlement;
- local scheduling, resource-control and quarantine decisions remain operator-local;
- sandbox, replay, authorization, checkpoint, content-addressing and malicious-workload protections remain fail-closed;
- packaging proves deterministic cross-build structure only, not native-host certification, signing/notarization, GPU availability or live deployment.

## Client/service reconciliation

CMP-3 changes the off-chain worker runtime, its CLI, package material and related qualification/docs.

No Indexer schema/consumer, RPC method/backend, Search surface or frontend/backend application is introduced or modified by CMP-3. Those direct suites are therefore non-applicable to this phase closeout rather than silently omitted.

The retained Compute Market suite remains required because CMP-3 consumes the frozen Compute protocol/authorization contracts and specifications. The node420 release gate is required because the accumulated phase adds a new execution-side command/package surface.

## Repository qualification versus live deployment

CMP-3.14 is repository phase closeout, not live-network or native-host certification.

Public testnet deployment, real funded jobs, live worker machines, native Windows/macOS workload-runtime evidence, production GPU backends, Apple notarization, Authenticode, ProtocolRegistry deployment/publication and long-duration fleet soak remain later operational/testnet scope.

## Level 3 qualification gate

One exact accumulated merge-candidate SHA must pass:

1. **Solidity Contracts** canonical full repository Foundry inventory exactly once using four balanced shards;
2. **Genesis Address Authority** address/namespace/collision/predeploy/frozen-manifest checks, without duplicating the Foundry inventory;
3. **420 Integrated Qualification** global offline core, production dependencies, Geth engine, fault matrix and retained soak qualification;
4. **420Docs Qualification** global documentation/reconciliation;
5. **Compute Market Qualification** retained Compute contracts and protocol verifiers;
6. **Compute Worker Fast Qualification** all CMP-3.1–CMP-3.13 regressions, Docker probes and package verification;
7. **Compute Worker Integration Qualification** retained worker integration suite on the exact closeout SHA;
8. **node420 Release Gate** affected execution/package release qualification;
9. this CMP-3.14 inventory/verifier and all applicable static/build/security/deployment/config checks owned above.

No cancelled, skipped-required, missing, stale, superseded or untriggered required gate is passing evidence.

## Full Solidity ownership

Solidity Contracts is the sole owner of the canonical complete Foundry inventory.

The CMP-3.14 closeout marker deliberately forces the otherwise Compute-scoped PR into the four balanced `pr-shards` inventory. Genesis separately owns address authority and does not rerun the full Foundry inventory.

## Completion

CMP-3.14 is **COMPLETE**. Every applicable Level 3 owner passed the same exact implementation SHA `0fcb699e6270bc863538eacb08ba204ce2f41b6c`. Durable run/job evidence is recorded in `CMP-3.14-QUALIFICATION-EVIDENCE.md`.

The next canonical phase is:

**CMP-4 — Scientific compute framework**


## Qualification evidence

Durable exact-SHA closeout evidence: [CMP-3.14 qualification](CMP-3.14-QUALIFICATION-EVIDENCE.md).
