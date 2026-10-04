# 420Arbitration complete repository audit — 2026-10-04

## Scope and baseline

Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420arbitration-complete-20261004`  
Baseline `main`: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`  
Repository-qualified implementation: `7323c5456770f8b963b5db5a39a6010b8f4e13a5`  
Qualification run: `37231037990` — qualify `111520569558`, security `111520569744`

Canonical repository sources define 420Arbitration as `GENESIS_PROTOCOL_AND_USER_APP` with service ID `420/service/arbitration/v1`. Its purpose is domain-scoped dispute coordination: policy snapshots, case identity, evidence commitments, exact resolver authority, rulings, bounded appeals and finality without acquiring custody or blanket remedy-execution authority.

## Architecture discovered

Canonical contracts:
1. `ArbitrationIds420.sol`
2. `ArbitrationPolicyRegistry420.sol`
3. `ArbitrationCaseRegistry420.sol`
4. `ArbitrationRulingRegistry420.sol`

Authority separation:
- GovernanceTimelock configures domain policy.
- CaseRegistry binds parties, origin, policy snapshot, evidence rounds and deadlines.
- RulingRegistry accepts one ruling per round from the selected resolver and finalizes after the appeal window.
- Origin protocols remain solely responsible for consuming a finalized ruling through their own bounded state transition.

## Files

### Expected and present
- all four canonical Solidity sources;
- Genesis config and 12 ARB-INV invariants;
- canonical service ID in `ServiceIds420`;
- Genesis dApp contract-map entry;
- Arbitration Foundry tests;
- protocol architecture and complete application-manual package;
- Wallet Genesis catalogue awareness;
- integration consumers, including Launchpad, that read canonical case/ruling state.

### Newly created by this audit
- `.github/workflows/420arbitration-audit.yml`;
- `scripts/verify-420arbitration-audit.py`;
- `docs/apps/arbitration/deployment-operations.md`;
- `docs/apps/arbitration/threat-model.md`;
- `docs/audit/420ARBITRATION-AUDIT-REMEDIATION-ROADMAP.md`;
- `docs/audit/420ARBITRATION-AUDIT-3-QUALIFICATION.md`;
- this complete audit report.

### Missing or unresolved
- deterministic release materialization package;
- canonical Arbitration entry in the Genesis address namespace;
- repository-authoritative ProtocolRegistry implementation endpoint for `420/service/arbitration/v1`;
- qualified user-facing Arbitration runtime route/client;
- retained production-equivalent testnet deployment evidence.

## Smart contracts

| Contract | Status | Notes |
|---|---|---|
| ArbitrationIds420 | COMPLETE | canonical IDs/domain constants present |
| ArbitrationPolicyRegistry420 | COMPLETE at repository scope | governance-controlled, bounded appeals; formatting drift corrected |
| ArbitrationCaseRegistry420 | COMPLETE at repository source scope | requested-remedy invariant, duplicate evidence rejection and complete case getter repaired |
| ArbitrationRulingRegistry420 | COMPLETE at repository source scope | exact resolver/one-ruling semantics retained; nonzero remedy commitment repaired |

## Application components

- Frontend/runtime: **MISSING** as a verified executable Arbitration user-facing app; documentation and Wallet catalogue presence alone are insufficient.
- Backend/API/indexer: **PARTIAL**; canonical events/state are reconstructable and developer API semantics are documented, but no dedicated deployed/runtime projection has been release-qualified.
- SDK/client: **PARTIAL**; contract read/write surfaces exist, but no release-qualified Arbitration client binding was found.
- Deployment tooling: **PARTIAL**; deploy order and one-time binding are documented, but deterministic release materialization/Registry publication authority is unresolved.
- Documentation: **PARTIAL**; strong repository manuals plus new threat/deployment docs exist, but release/operator/live-deployment evidence remains.

## Baseline defects repaired

1. `openCase` accepted a zero `requestedRemedyHash` contrary to ARB-INV-001.
2. `submitRuling` accepted a zero `remedyCommitment`, although only the panel commitment is documented as optional.
3. Same case/round evidence hashes could be committed repeatedly and re-emitted.
4. The documented case-inspection surface lacked a complete CaseRecord getter.
5. Canonical Arbitration source was not fully `forge fmt` clean.
6. No dedicated exact-head Arbitration audit workflow or mechanical verifier existed.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Four-contract canonical suite | Genesis config / dApp map | present | Foundry | protocol docs | COMPLETE | none at source scope |
| Domain policy governance | ARB-INV-010 | governance-only registry | governance negative | architecture | COMPLETE | live GovernanceTimelock evidence |
| Policy snapshot | ARB-INV-002 | stored in CaseRecord | snapshot regression | architecture | COMPLETE | live deployment evidence |
| Bound case identity | ARB-INV-001 | parties/domain/origin/claim/remedy stored | zero-remedy negative | architecture | COMPLETE | none at source scope |
| Party-scoped evidence | ARB-INV-003 | party/deadline/nonzero checks | deadline/replay negatives | architecture | COMPLETE | live scenario |
| Duplicate evidence replay safety | audit security requirement | per-case/round guard | regression | threat model | COMPLETE | none |
| Exact resolver authority | ARB-INV-004 | current-round resolver check | wrong-resolver negative | architecture | COMPLETE | live resolver qualification |
| One ruling per round | ARB-INV-005 | existence guard | lifecycle suite | architecture | COMPLETE | live scenario |
| Nonzero ruling/remedy commitments | ARB-INV-006 | enforced | zero-remedy negative | architecture/threat model | COMPLETE | none |
| Bounded appeals | ARB-INV-005/010 | max 3, snapshotted | appeal-cap negative | architecture | COMPLETE | live scenario |
| Finalization after appeal closure | ARB-INV-007 | enforced | predeadline negative | architecture | COMPLETE | live scenario |
| No custody/remedy superuser | ARB-INV-008/009 | no custody/arbitrary execution path | static/security gate | architecture | COMPLETE | preserve integration boundary |
| Reconstructable canonical records | ARB-INV-011 | events + chain state | repository-only | docs | PARTIAL | dedicated runtime/indexer qualification |
| Bounded legal authority | ARB-INV-012 | documented | N/A | architecture/security | COMPLETE | none |
| User-facing Genesis runtime | app classification | no verified runtime route/client found | absent | manuals present | MISSING | ARBITRATION-AUDIT-4 |
| ProtocolRegistry service publication | service ID | endpoint/address authority undefined | absent | blocker documented | BLOCKED | ARBITRATION-AUDIT-4 |
| Deterministic deployment package | Genesis readiness | deploy order known; package absent | absent | deployment guide | PARTIAL | ARBITRATION-AUDIT-4 |
| Exact-head repository qualification | audit requirement | dedicated workflow/verifier | 11/11 normal + 11/11 hardening | qualification evidence | COMPLETE | preserve exact-head evidence |
| Production-equivalent testnet qualification | release readiness | no live evidence | absent | absent | BLOCKED | ARBITRATION-AUDIT-5 |
| Final operator/security closeout | production readiness | incomplete | static analysis only | threat model present | PARTIAL | ARBITRATION-AUDIT-6 |

## Tests and builds

Exact implementation SHA: `7323c5456770f8b963b5db5a39a6010b8f4e13a5`  
Workflow run: `37231037990`

Qualify job `111520569558`:
- exact-head checkout: PASS;
- `forge fmt --check src/arbitration test/ArbitrationGenesis420.t.sol`: PASS;
- Solidity 0.8.24 Arbitration build: PASS;
- mechanical repository verifier: PASS;
- Foundry Arbitration suite: **11 passed, 0 failed, 0 skipped**;
- forbidden `tx.origin` / `selfdestruct` / `delegatecall` scan: PASS.

Security job `111520569744`:
- exact-head checkout: PASS;
- hardening-profile Arbitration suite: **11 passed, 0 failed, 0 skipped**;
- targeted Slither execution: PASS;
- high-severity Slither findings: **0**.

## Security

Verified/mitigated at repository scope:
- Governance-only policy mutation;
- policy snapshot immutability for open cases;
- exact party and resolver checks;
- bounded appeals;
- duplicate evidence replay rejection;
- nonzero claim/requested-remedy/ruling/remedy commitments;
- one ruling per round;
- no direct token/native custody or origin-protocol mutation;
- no `tx.origin`, `delegatecall` or `selfdestruct` in Arbitration source.

Retained static-analysis findings:
- two Medium `unused-return` findings;
- two Low `reentrancy-events` findings;
- four Low `timestamp` findings.

The high-severity gate is green, but these retained findings have not yet been individually source-located and dispositioned as false positives, mitigated behavior or accepted design risk. They therefore remain explicit ARBITRATION-AUDIT-4/6 security debt rather than being silently ignored.

Accepted design risks:
- governance selects future domain resolvers;
- a selected resolver can make a bad ruling;
- off-chain evidence availability/confidentiality depends on external systems;
- Arbitration finality is not consensus finality.

## Documentation

Verified:
- canonical Genesis config/invariants;
- protocol architecture;
- application concepts/user/permissions/fees/security/troubleshooting/FAQ/developer pages;
- service ID and Wallet catalogue references.

Added/corrected:
- deployment/operations guide;
- threat model;
- full audit report;
- stable remediation roadmap;
- exact-head qualification evidence.

Still required:
- final service endpoint/address authority decision;
- deterministic release/deployment record;
- live resolver/operator procedures and monitoring;
- testnet/Genesis acceptance evidence.

## Integration

Verified repository-side:
- ProtocolRegistry canonical service ID exists;
- Wallet catalogue recognizes 420Arbitration;
- Launchpad uses Arbitration case/ruling registries without giving Arbitration custody authority;
- architecture requires origin protocols to consume finalized rulings through their own authorization/accounting/state machine.

Not yet qualified:
- canonical ProtocolRegistry implementation endpoint and Registry-resolved address;
- executable user-facing runtime;
- live Indexer/API/reorg/finality behavior;
- representative live origin-protocol remedy consumption.

## Outstanding blockers

1. **Protocol architecture/governance decision:** select the canonical service implementation endpoint/address authority for `420/service/arbitration/v1`.
2. **Code/integration:** provide and qualify the user-facing Arbitration runtime required by its Genesis app classification.
3. **Deployment tooling:** deterministic release materialization, runtime hashes, constructor/binding proof and ProtocolRegistry publication.
4. **Security:** individually disposition retained Medium/Low Slither findings and complete resolver/operator key-custody procedures.
5. **Testnet:** production-equivalent deployment and real end-to-end case/evidence/ruling/appeal/finality/origin-consumption evidence.
6. **Production:** monitoring, incident response, recovery evidence and independent external security review or approved exception.

## Readiness state

- CODE COMPLETE: **NO** — protocol source is repository-qualified, but the required user-facing runtime/service-publication implementation is unresolved.
- BUILD COMPLETE: **YES** — repository Arbitration graph builds on the exact qualified implementation SHA.
- CONTRACT COMPLETE: **YES at repository source scope** — all four canonical contracts compile and source invariants audited here are implemented.
- TEST COMPLETE: **NO** — 11/11 repository tests pass in both normal and hardening profiles, but live runtime/testnet/reorg/finality/integration tests remain.
- DOCUMENTATION COMPLETE: **NO** — live deployment/operator/Genesis acceptance records remain.
- INTEGRATION COMPLETE: **NO** — canonical service endpoint/address authority and live runtime bindings remain unresolved.
- SECURITY QUALIFIED: **NO** — zero high-severity Slither findings is not production security qualification; retained findings and live/external review remain.
- TESTNET READY: **NO** — ARBITRATION-AUDIT-4 release materialization is incomplete.
- GENESIS READY: **NO** — blocked on ARBITRATION-AUDIT-4 through -6.
- PRODUCTION READY: **NO** — blocked on testnet and final operational/security closeout.

## Final determination

420Arbitration is **not complete** at the audited release stage.

ARBITRATION-AUDIT-1 through ARBITRATION-AUDIT-3 are repository-complete and qualified on implementation SHA `7323c5456770f8b963b5db5a39a6010b8f4e13a5`, workflow run `37231037990`. The audit repaired concrete invariant/replay/read-surface defects and established a dedicated exact-head build/test/security gate.

The next required step is **ARBITRATION-AUDIT-4 — Application/runtime and release materialization**. It must resolve the canonical ProtocolRegistry service endpoint/address authority and the required user-facing runtime before deterministic deployment/testnet work can honestly be declared ready. ARBITRATION-AUDIT-5 and -6 remain blocked behind that dependency.
