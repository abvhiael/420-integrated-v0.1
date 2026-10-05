# Dev Compensation Vault audit remediation roadmap

Authority: `docs/audit/DEVCOMP-COMPLETE-AUDIT-20261004.md`.

## DEVCOMP-AUDIT-1 — canonical definition and inventory — COMPLETE
Canonical policy, implementation, Genesis map, service ID, tests, documentation and historical PR evidence identified.

## DEVCOMP-AUDIT-2 — V1 policy binding — COMPLETE
Require every successful contribution to carry the exact frozen Application Revenue Policy V1 identifier and retain regression coverage.

## DEVCOMP-AUDIT-3 — accounting/custody/replay hardening — COMPLETE
Retain exact 10% ceiling, exact-amount routing, replay protection, no-custody forwarding, direct-deposit rejection and ERC-20 conservation checks.

## DEVCOMP-AUDIT-4 — authorization boundary — COMPLETE
Retain source-contract + application scope + amount-aware `CapabilityRegistry420` authorization. No local allowlist or owner bypass.

## DEVCOMP-AUDIT-5 — dedicated exact-head repository qualification — COMPLETE
Exact qualified implementation head: `7a9185b48818f3c994e44a822e440f36d2ccd711`.

`Dev Compensation Vault Audit Qualification` run `37255599638` (#6) completed SUCCESS:
- `contract-core` job `111591871859` — PASS;
- focused formatting/build — PASS;
- `DevelopmentCompensationVault420.t.sol` — PASS;
- `DevelopmentCompensationGenesis420.t.sol` — PASS;
- `security` job `111591872012` — PASS;
- hardening-profile rerun — PASS;
- forbidden primitive scan — PASS;
- targeted Slither high-severity gate — PASS.

Repository-side DEVCOMP audit remediation is complete through DEVCOMP-AUDIT-5. Remaining DEVCOMP-AUDIT-6 through DEVCOMP-AUDIT-9 are explicitly transferred to the canonical testnet/release work roadmap in `docs/ROADMAP.md`; repository CI or synthetic evidence must not be promoted to completion of those live phases.

## DEVCOMP-AUDIT-6 — deployment package and binding — TESTNET HANDOFF / BLOCKED ON DEPLOYMENT ENVIRONMENT
Once the production-equivalent testnet is live:
1. select the exact qualified release commit;
2. deploy against the canonical `CapabilityRegistry420`;
3. record the immutable 420 Integrated Labs beneficiary;
4. record deployed address, bytecode/code hash and chain ID;
5. publish `420/service/development-compensation/v1` in Protocol Registry;
6. prove Registry resolution returns the exact deployed vault;
7. establish narrowly scoped source-application capability grants;
8. prove unauthorized, revoked, wrong-scope and over-limit calls fail closed.

## DEVCOMP-AUDIT-7 — live routing qualification — TESTNET HANDOFF / BLOCKED ON AUDIT-6
Exercise native $420 and approved ERC-20 contribution paths from real authorized fee-bearing applications. Record transaction hashes and prove:
- exact policy reference;
- exact split math;
- one-time revenue references;
- zero vault residue;
- beneficiary receipt;
- exact event fields;
- rollback on rejected transfer/beneficiary failure;
- event visibility to Explorer/Analytics/indexing infrastructure.

## DEVCOMP-AUDIT-8 — Genesis closeout — TESTNET/RELEASE HANDOFF / BLOCKED ON AUDIT-6/7
Reconcile deployment manifests, Registry descriptors, address authority, operator runbook, rollback/migration procedure and exact-head/live evidence. Only then mark Genesis ready.

## DEVCOMP-AUDIT-9 — production release qualification — RELEASE HANDOFF / BLOCKED ON GENESIS CLOSEOUT
Confirm production chain bindings, beneficiary operational controls, source grants, monitoring/alerting, incident response and migration procedure. Production readiness must be a separate decision from repository/testnet qualification.
