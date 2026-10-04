# 420-IS audit remediation roadmap

Authority: `docs/audit/420IS-COMPLETE-AUDIT-20261004.md`.

Requirement numbering is durable. Do not renumber completed or blocked steps.

## IS-AUDIT-1 — canonical definition and source reconciliation — COMPLETE
- Reconcile the architecture document, Genesis contract map, `ServiceIds420`, address namespace and public Genesis classification.
- Preserve 420-IS as a covered implementation protocol rather than inventing a standalone public Genesis dApp.
- Preserve the six-component canonical source package.
- Preserve `interop-router` as Registry-resolved with no fixed Genesis address.
- Preserve provider-neutral authority boundaries and external-truth limitations.

## IS-AUDIT-2 — contract/security coverage hardening — IMPLEMENTED, PENDING EXACT-HEAD QUALIFICATION
- Add focused negative/security/lifecycle coverage beyond the five retained baseline tests.
- Cover standard-version rejection, provider revision/type drift, governance bounds, inactive namespace/provider behavior, explicit revocation, multi-revision supersession, checkpoint-chain drift and router reads.
- Add forbidden-primitive and targeted Slither gates.
- Qualify the exact accumulated implementation head.

## IS-AUDIT-3 — repository consistency and audit qualification — IMPLEMENTED, PENDING EXACT-HEAD QUALIFICATION
- Add a mechanical verifier for canonical inventory, service ID, address authority, architecture invariants and source invariants.
- Add a dedicated exact-head 420-IS audit workflow.
- Record the exact implementation SHA and passing workflow/job IDs after the implementation head qualifies.
- Requalify any later bookkeeping-only head before formal COMPLETE closeout.

## IS-AUDIT-4 — deterministic release materialization — IMPLEMENTED, PENDING EXACT-HEAD QUALIFICATION
- Materialize and mechanically verify exact deployment order:
  1. `InteropProviderRegistry420`
  2. `InteropNamespaceRegistry420`
  3. `InteropCheckpointRegistry420`
  4. `InteropRouter420`
- Bind the canonical GovernanceTimelock constructor authority.
- Materialize exact constructor dependency graph.
- Retain compiler artifact identities and runtime-template hashes.
- Define the canonical `420/service/420-is/v1` ProtocolRegistry registration profile, interface hash, dependency root, manifest commitment and rollback/deprecation procedure.
- Define initial governed provider/namespace bootstrap policy without inventing live providers.
- Add local deployment + ProtocolRegistry publication/deprecation/recovery tests. **Implemented in `InteropDeploymentBinding420.t.sol`.**
- Keep live addresses, transaction hashes and final runtime code hashes empty until they actually exist.

## IS-AUDIT-5 — production-equivalent public testnet qualification — BLOCKED ON LIVE TESTNET
- Deploy the exact IS-AUDIT-4 release package to the production-equivalent public testnet.
- Verify chain identity, GovernanceTimelock authority, constructor bindings and deployed runtime code hashes.
- Publish `420/service/420-is/v1` through the canonical ProtocolRegistry and retain transaction/block evidence.
- Exercise provider registration/revision/deactivation, namespace registration/deactivation, mapping publication/supersession/revocation and checkpoint chains.
- Exercise stale/wrong-provider/wrong-chain/invalid-sequence/invalid-previous-hash failure modes.
- Verify Wallet/Indexer/Explorer/Search consumers treat derived state as non-authoritative and rebuild/recover correctly after reorgs.
- Retain machine-readable address/codehash/transaction/block evidence.

## IS-AUDIT-6 — Genesis/production security and operations closeout — BLOCKED ON IS-AUDIT-5
- Reconcile the exact testnet-qualified artifacts with then-current `main`.
- Run full release-candidate static/security qualification on one exact head.
- Finalize deployment/operator/recovery/monitoring documentation.
- Finalize 420-IS threat model and accepted-risk register.
- Record exact live ProtocolRegistry publication and dependency identities.
- Record Genesis acceptance evidence.
- Only then consider GENESIS READY / PRODUCTION READY.

## Current readiness boundary

Repository/source work through IS-AUDIT-4 is now implemented and awaiting exact-head CI qualification. IS-AUDIT-5 and IS-AUDIT-6 require a production-equivalent live testnet and retained runtime evidence. Tests being green before that point do not make 420-IS Genesis-ready or production-ready.
