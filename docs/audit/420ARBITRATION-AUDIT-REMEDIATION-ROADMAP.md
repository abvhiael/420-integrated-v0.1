# 420Arbitration audit remediation roadmap

Status authority: repository evidence on `audit/420arbitration-complete-20261004`. Baseline main SHA: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`. ARBITRATION-AUDIT-1 through ARBITRATION-AUDIT-3 are repository-qualified on implementation SHA `7323c5456770f8b963b5db5a39a6010b8f4e13a5`, workflow run `37231037990` (qualify job `111520569558`, security job `111520569744`).

## ARBITRATION-AUDIT-1 — Canonical definition and source reconciliation — COMPLETE
- Reconciled Genesis config, service ID, dApp map, protocol architecture, application manuals, Wallet catalogue and integration consumers.
- Preserved the four-file canonical contract inventory.
- Preserved Arbitration as bounded dispute/ruling authority with no custody or blanket remedy execution authority.
- Recorded the unresolved ProtocolRegistry service-endpoint/address-authority gap rather than inventing one.

## ARBITRATION-AUDIT-2 — Contract and invariant hardening — COMPLETE
- Enforced a nonzero requested-remedy commitment at case creation.
- Enforced a nonzero remedy commitment for rulings.
- Rejected duplicate evidence commitments within the same case/round.
- Exposed the complete snapshotted case record through a read-only getter for documented client inspection.
- Expanded negative/state-transition tests for deadlines, replay, policy snapshots, resolver authority and appeal caps.

## ARBITRATION-AUDIT-3 — Exact-head build, test and security qualification — COMPLETE
- Added a dedicated Arbitration workflow.
- Qualified Foundry formatting/build and all Arbitration Foundry tests on the exact implementation head.
- Qualified the mechanical repository verifier.
- Qualified the forbidden `tx.origin`, `delegatecall` and `selfdestruct` primitive scan.
- Qualified targeted Slither with zero high-severity findings.
- Retained two medium `unused-return` findings and six low findings (two `reentrancy-events`, four `timestamp`) for explicit release-stage triage; they do not authorize a production-security declaration.
- Durable evidence: `docs/audit/420ARBITRATION-AUDIT-3-QUALIFICATION.md`.

## ARBITRATION-AUDIT-4 — Application/runtime and release materialization — NEXT
- Resolve the canonical user-facing runtime path for this `GENESIS_PROTOCOL_AND_USER_APP` surface.
- Define the canonical ProtocolRegistry implementation endpoint for `420/service/arbitration/v1`.
- Define the Registry-resolved Arbitration address namespace entry or other approved address authority.
- Materialize deterministic deployment, constructor/binding graph, artifact identities and local Registry publication tests.
- Bind Wallet/app discovery and any Indexer/API descriptors to exact verified deployment identities.
- Triage the retained medium Slither `unused-return` findings and either remediate them or document a source-grounded false-positive/accepted-risk disposition.

## ARBITRATION-AUDIT-5 — Production-equivalent public testnet qualification — BLOCKED ON AUDIT-4
- Deploy the exact qualified release.
- Verify chain identity, runtime hashes, governance and one-time registry bindings.
- Exercise real case/evidence/ruling/appeal/finalization flows and representative origin-protocol consumption.
- Exercise Wallet/runtime discovery plus indexer/reorg/rebuild/finality behavior.
- Retain transactions, receipts, logs, block hashes, addresses and code hashes.

## ARBITRATION-AUDIT-6 — Genesis/production security and release closeout — BLOCKED ON AUDIT-5
- Reconcile all prior evidence to the exact release candidate.
- Complete resolver/operator key-custody, monitoring, incident-response and recovery procedures.
- Complete independent external security review or a formally approved release exception.
- Re-run exact-head final qualification and separately declare code/build/contract/test/docs/integration/security/testnet/Genesis/production readiness.
