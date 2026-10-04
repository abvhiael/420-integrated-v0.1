# 420Arbitration audit remediation roadmap

Status authority: repository evidence on `audit/420arbitration-complete-20261004`. Baseline main SHA: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`.

## ARBITRATION-AUDIT-1 — Canonical definition and source reconciliation
- Reconcile Genesis config, service ID, dApp map, protocol architecture, application manuals, Wallet catalogue and integration consumers.
- Preserve the four-file canonical contract inventory.
- Preserve Arbitration as bounded dispute/ruling authority with no custody or blanket remedy execution authority.
- Record the unresolved ProtocolRegistry service-endpoint/address-authority gap rather than inventing one.

## ARBITRATION-AUDIT-2 — Contract and invariant hardening
- Enforce a nonzero requested-remedy commitment at case creation.
- Enforce a nonzero remedy commitment for rulings.
- Reject duplicate evidence commitments within the same case/round.
- Expose the complete snapshotted case record through a read-only getter for documented client inspection.
- Expand negative/state-transition tests for deadlines, replay, policy snapshots, resolver authority and appeal caps.

## ARBITRATION-AUDIT-3 — Exact-head build, test and security qualification
- Add a dedicated Arbitration workflow.
- Run forge formatting/build and all Arbitration Foundry tests.
- Run the mechanical repository verifier.
- Reject dangerous `tx.origin`, `delegatecall` and `selfdestruct` primitives in Arbitration source.
- Run targeted Slither and fail on high-severity Arbitration findings.
- Retain exact-head workflow/run evidence.

## ARBITRATION-AUDIT-4 — Application/runtime and release materialization
- Resolve the canonical user-facing runtime path for this `GENESIS_PROTOCOL_AND_USER_APP` surface.
- Define the canonical ProtocolRegistry implementation endpoint for `420/service/arbitration/v1`.
- Define the Registry-resolved Arbitration address namespace entry or other approved address authority.
- Materialize deterministic deployment, constructor/binding graph, artifact identities and local Registry publication tests.
- Bind Wallet/app discovery and any Indexer/API descriptors to exact verified deployment identities.

## ARBITRATION-AUDIT-5 — Production-equivalent public testnet qualification
- Deploy the exact qualified release.
- Verify chain identity, runtime hashes, governance and one-time registry bindings.
- Exercise real case/evidence/ruling/appeal/finalization flows and representative origin-protocol consumption.
- Exercise Wallet/runtime discovery plus indexer/reorg/rebuild/finality behavior.
- Retain transactions, receipts, logs, block hashes, addresses and code hashes.

## ARBITRATION-AUDIT-6 — Genesis/production security and release closeout
- Reconcile all prior evidence to the exact release candidate.
- Complete resolver/operator key-custody, monitoring, incident-response and recovery procedures.
- Complete independent external security review or a formally approved release exception.
- Re-run exact-head final qualification and separately declare code/build/contract/test/docs/integration/security/testnet/Genesis/production readiness.
