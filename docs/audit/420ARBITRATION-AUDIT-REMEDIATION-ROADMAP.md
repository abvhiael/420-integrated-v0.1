# 420Arbitration audit remediation roadmap

Status authority: repository evidence on `audit/420arbitration-complete-20261004`. Initial baseline main SHA: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`. ARBITRATION-AUDIT-1 through ARBITRATION-AUDIT-4 are repository-complete. AUDIT-4 Level-2 app-integration qualification is retained on exact implementation SHA `554e16a3a3656cb61ab1819b60c10eb7c8fa8f93`, workflow run `37237412184` (qualify job `111539203484`, security job `111539203626`). Closeout confirmation: exact branch head `80aa33fe1666e1f6015614015dc02ac2dc71b0a8` requalified by Arbitration run `37238594853` (#27), qualify `111542609087` PASS and security `111542608940` PASS. Current `main` observed during final bookkeeping: `58b6b17c6538bd3cd22694e417a32472aae899f4`.

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

## ARBITRATION-AUDIT-4 — Application/runtime and release materialization — COMPLETE
- Added `ArbitrationRouter420` as the canonical read/discovery service implementation for `420/service/arbitration/v1`.
- Added `arbitration-router` as `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`; no new fixed predeploy or CREATE2 address was invented.
- Materialized the deterministic Policy -> Case -> Ruling -> one-time binding -> Router -> component registration -> service publication graph.
- Added local deployment/ProtocolRegistry publication, deprecation and recovery qualification.
- Added the Wallet-integrated Arbitration runtime binding with fail-closed service/chain/version/router/dependency code-identity validation.
- Explicitly retained Indexer projection as non-canonical; live same-deployment projection/reorg/rebuild qualification remains AUDIT-5 because no existing Arbitration descriptor authority was found.
- Source-located and remediated both Medium Slither `unused-return` findings with purpose-specific CaseRegistry context reads.
- Exact implementation SHA: `554e16a3a3656cb61ab1819b60c10eb7c8fa8f93`.
- Qualification: run `37237412184`; qualify `111539203484` PASS; security `111539203626` PASS; 13/13 Foundry tests in normal and hardening profiles; zero High and zero Medium-unused-return Slither findings.
- Durable evidence: `docs/audit/420ARBITRATION-AUDIT-4-QUALIFICATION.md`.
- Formal disposition: **COMPLETE; no repository-local Audit-4 work remains.**

## ARBITRATION-AUDIT-5 — Production-equivalent public testnet qualification — NEXT / BLOCKED ON LIVE TESTNET
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
