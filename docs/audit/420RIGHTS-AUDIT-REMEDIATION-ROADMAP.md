# 420Rights audit remediation roadmap

Status authority: repository evidence on `audit/420rights-complete-20261003`. RIGHTS-AUDIT-1 through RIGHTS-AUDIT-3 are COMPLETE on qualified implementation SHA `b3ea84e8a92524cfbf0f3512975efda73542b310`, workflow run `37177524144` (qualify job `111363160613`, security job `111363160767`). This roadmap does not treat historical candidate addresses or planned integrations as deployed authority.

## RIGHTS-AUDIT-1 — Canonical definition and source reconciliation — COMPLETE
- Reconcile `420rights-genesis.json`, Rights/Verify architecture, Genesis dApp map, service ID, address namespace, Wallet catalogue, Search and Indexer boundaries.
- Preserve the seven-contract canonical suite and the eight canonical right classes.
- Preserve 420Rights as a covered protocol rather than inventing a standalone public application.
- Preserve `rights-router` as Registry-resolved with no fixed Genesis address.

## RIGHTS-AUDIT-2 — Contract/security test hardening — COMPLETE
- Retain lifecycle, replay, deterministic-license, capability-expiry/revocation, time-bound and succession tests.
- Add inactive-class, missing-evidence, finite-right/license, nonrevocable-license, exact subject capability scope/action and unauthorized supersession/transfer negatives.
- Qualify formatting, compilation, targeted Foundry tests and forbidden-primitive scan on one exact head.

## RIGHTS-AUDIT-3 — Indexer/integration correctness — COMPLETE
- Replace obsolete synthetic Rights lifecycle events with actual emitted contract events.
- Normalize `ClaimSuperseded.oldRightId` onto the canonical `rightId` lifecycle object.
- Add `subjectId` lifecycle identity support.
- Add artifact-derived descriptors for Policy, Asset, Claim and License registries.
- Add fail-closed binding of descriptors to Registry-resolved deployment addresses.
- Add ABI/indexing drift and lifecycle regression tests.

## RIGHTS-AUDIT-4 — Deterministic release materialization and Registry publication — OUTSTANDING
- Freeze the exact deploy order and constructor graph.
- Resolve the actual CapabilityRegistry420 dependency for the target release.
- Define the governed Genesis metadata commitments for all eight right classes; do not invent hashes.
- Materialize exact compiler artifacts/runtime hashes and deployment identities.
- Publish the canonical `420/service/rights/v1` Rights router/service through ProtocolRegistry with exact manifest/interface/dependency commitments.
- Bind Indexer descriptors to the resulting deployed registry addresses and code identities.
- Record smoke-test and rollback/recovery procedure.

## RIGHTS-AUDIT-5 — Production-equivalent public testnet qualification — BLOCKED ON LIVE TESTNET / AUDIT-4
- Deploy the exact qualified release to the production-equivalent public testnet.
- Verify chain identity, runtime code hashes, constructor bindings, GovernanceTimelock authority, CapabilityRegistry behavior and ProtocolRegistry publication.
- Exercise subject registration, claims, competing claims, supersession, succession, license grant/revoke/renounce and temporal expiry.
- Verify Wallet discovery/handoff, Indexer rebuild/reorg behavior, Search discovery, finality handling and stale/wrong-network fail-closed behavior.
- Retain machine-readable transaction/block/address/codehash evidence.

## RIGHTS-AUDIT-6 — Genesis/production security and release closeout — BLOCKED ON AUDIT-5
- Reconcile exact testnet-qualified artifacts with current `main`.
- Run full release-candidate security/static analysis and complete integration qualification.
- Complete Rights deployment/operator/security/threat-model/Genesis-acceptance documentation.
- Record exact implementation SHA and qualification run IDs.
- Only then consider GENESIS READY / PRODUCTION READY.


## Qualified repository closeout

Implementation SHA `b3ea84e8a92524cfbf0f3512975efda73542b310` passed the dedicated 420Rights audit qualification workflow, run `37177524144`.

- canonical Rights formatting: PASS;
- canonical Rights build: PASS;
- inventory/ABI/lifecycle/address-authority verifier: PASS;
- Foundry Rights suites: PASS — 12 passed, 0 failed, 0 skipped;
- forbidden primitive scan: PASS;
- 420Indexer build: PASS;
- Rights Indexer descriptor/lifecycle qualification: PASS — 18 passed, 0 failed;
- hardening-profile Rights suite: PASS;
- targeted Slither high-severity gate: PASS — 0 high-severity findings (two low-impact timestamp findings retained as expected time-window semantics).

The closeout bookkeeping commits after that SHA are documentation-only and do not change the qualified implementation. RIGHTS-AUDIT-4 remains the next executable remediation step.