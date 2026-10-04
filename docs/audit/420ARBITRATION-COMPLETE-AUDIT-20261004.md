# 420Arbitration complete repository audit — 2026-10-04

## Scope and baseline

Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420arbitration-complete-20261004`  
Baseline `main`: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`

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

## File inventory

### Present
- all four canonical Solidity sources;
- Genesis config and 12 ARB-INV invariants;
- canonical service ID in `ServiceIds420`;
- Genesis dApp contract-map entry;
- Genesis contract tests;
- protocol architecture document;
- full application manual package/navigation;
- Wallet Genesis catalogue awareness;
- integration consumers, including Launchpad, that read canonical case/ruling state.

### Missing or incomplete at baseline
- no dedicated Arbitration audit workflow;
- no Arbitration-specific mechanical verifier;
- no deterministic release materialization package;
- no canonical Arbitration entry in the Genesis address namespace;
- no repository-authoritative choice of ProtocolRegistry implementation endpoint for `420/service/arbitration/v1`;
- no retained production-equivalent testnet deployment evidence;
- no qualified user-facing runtime implementation beyond documentation/catalogue awareness;
- no Arbitration-specific operator/deployment or threat-model document.

## Baseline contract defects repaired

1. **Requested-remedy invariant violation.** `openCase` accepted `bytes32(0)` for `requestedRemedyHash` even though ARB-INV-001 and architecture require every case to bind the requested-remedy commitment.
2. **Ruling remedy ambiguity.** `submitRuling` accepted a zero `remedyCommitment`, while the architecture identifies only the panel commitment as optional.
3. **Evidence replay/log ambiguity.** Re-submitting the same evidence hash in the same case/round succeeded and emitted another canonical event.
4. **Incomplete documented read surface.** The user/developer docs describe inspecting the snapshotted case policy and deadlines, but no complete CaseRecord getter existed.

Repairs:
- nonzero requested-remedy validation;
- nonzero ruling-remedy validation;
- duplicate evidence rejection per case/round;
- read-only `getCase(caseId)`;
- expanded Foundry coverage.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Four-contract canonical suite | Genesis config / dApp map | present | Foundry | protocol docs | COMPLETE | exact-head qualify |
| Domain policy governance | ARB-INV-010 | Governance-only policy registry | governance negative | architecture | COMPLETE | live GovernanceTimelock evidence |
| Policy snapshot | ARB-INV-002 | stored in CaseRecord | snapshot regression added | architecture | COMPLETE | live deployment evidence |
| Bound case identity | ARB-INV-001 | parties/domain/origin/claim/remedy stored | zero-remedy negative added | architecture | COMPLETE | exact-head qualify |
| Party-scoped evidence | ARB-INV-003 | party/deadline/nonzero checks | deadline + replay negatives added | architecture | COMPLETE | live scenario |
| Duplicate evidence replay safety | audit security requirement | added per-case/round guard | added | threat model | COMPLETE | exact-head qualify |
| Exact resolver authority | ARB-INV-004 | RulingRegistry checks current resolver | wrong-resolver negative | architecture | COMPLETE | live resolver qualification |
| One ruling per round | ARB-INV-005 | mapping existence guard | lifecycle suite | architecture | COMPLETE | exact-head qualify |
| Nonzero ruling/remedy commitments | ARB-INV-006 | repaired | zero-remedy negative | architecture/threat model | COMPLETE | exact-head qualify |
| Bounded appeals | ARB-INV-005/010 | max 3, snapshotted | appeal-cap negative added | architecture | COMPLETE | live scenario |
| Finalization after appeal closure | ARB-INV-007 | enforced | predeadline negative added | architecture | COMPLETE | live scenario |
| No custody/remedy superuser | ARB-INV-008/009 | no token/native custody or arbitrary execution path | static/security gate | architecture | COMPLETE | preserve in integrations |
| Reconstructable canonical records | ARB-INV-011 | events + chain state | partial | docs | PARTIAL | dedicated indexer/runtime qualification |
| Bounded legal authority | ARB-INV-012 | documented/no external legal authority | N/A | architecture/security | COMPLETE | none |
| User-facing Genesis runtime | app classification | catalogue/docs only; no verified Arbitration runtime route/client found | absent | manuals present | MISSING | ARBITRATION-AUDIT-4 |
| ProtocolRegistry service publication | service ID | ID exists; canonical implementation endpoint/address authority undefined | absent | deployment doc records blocker | BLOCKED | ARBITRATION-AUDIT-4 |
| Deterministic deployment package | Genesis readiness | deploy order known; release package absent | absent | deployment doc added | PARTIAL | ARBITRATION-AUDIT-4 |
| Production-equivalent testnet qualification | release readiness | no live evidence | absent | absent | BLOCKED | ARBITRATION-AUDIT-5 |
| Final operator/security closeout | production readiness | incomplete | absent live | threat model added | PARTIAL | ARBITRATION-AUDIT-6 |

## Smart-contract security assessment

Verified or mitigated at repository scope:
- Governance-only policy mutation;
- policy snapshot immutability for open cases;
- exact party and resolver checks;
- bounded appeals;
- replay-resistant duplicate evidence commitments;
- nonzero claim/requested-remedy/ruling/remedy commitments;
- one ruling per round;
- no direct custody or origin-protocol state mutation;
- no signature, nonce, allowance or token-transfer surface in the canonical suite.

Accepted design risks:
- governance selects domain resolvers;
- a selected resolver can produce a bad ruling;
- off-chain evidence availability/confidentiality depends on external systems;
- Arbitration finality is not consensus finality.

Unresolved release risks:
- canonical service endpoint/address authority is undefined;
- resolver key custody and operational rotation are not live-qualified;
- no production-equivalent deployment/reorg/finality evidence;
- no external security review retained.

## Documentation assessment

Existing manuals cover concepts, architecture, permissions, fees, security/privacy, troubleshooting, FAQ, user flows and developer contract/API/event guidance.

Added by this audit:
- complete audit report;
- stable remediation roadmap;
- deployment/operations guide;
- Arbitration threat model;
- mechanical repository verifier;
- dedicated exact-head CI/security workflow.

## Readiness state

- CODE COMPLETE: **NO** — canonical protocol source is hardened, but the required user-facing runtime/service publication path is unresolved.
- BUILD COMPLETE: **PENDING CI** — dedicated exact-head workflow added; status must be taken from the exact final head.
- CONTRACT COMPLETE: **YES at repository source scope**, subject to exact-head CI.
- TEST COMPLETE: **NO** — repository suites can qualify source behavior; live runtime/testnet/reorg/finality tests remain.
- DOCUMENTATION COMPLETE: **NO** — release-specific publication/operator evidence remains.
- INTEGRATION COMPLETE: **NO** — canonical service endpoint/address authority and live runtime bindings remain unresolved.
- SECURITY QUALIFIED: **NO** — repository hardening is not equivalent to live/external security qualification.
- TESTNET READY: **NO** — release materialization is blocked on ARBITRATION-AUDIT-4.
- GENESIS READY: **NO**.
- PRODUCTION READY: **NO**.

## Final determination

At the audited baseline, 420Arbitration was not genuinely complete. The core architecture was coherent and narrow, but the implementation violated its own requested-remedy invariant, allowed ambiguous zero-remedy rulings and duplicate same-round evidence events, and lacked a dedicated qualification path. More importantly, the repository does not yet define the canonical ProtocolRegistry implementation endpoint/address authority or a verified user-facing runtime for a surface classified as `GENESIS_PROTOCOL_AND_USER_APP`.

This branch repairs the source-level invariant defects and establishes durable audit/build/security machinery. Completion beyond repository source scope must proceed in stable order through ARBITRATION-AUDIT-4, -5 and -6; those requirements must not be renumbered or silently collapsed.
