# 420Arbitration complete repository audit — 2026-10-04

## Final repository-side disposition

420Arbitration is **repository-complete through ARBITRATION-AUDIT-4** and is ready to enter production-equivalent public-testnet qualification when the approved live testnet candidate is available.

The repository audit does **not** claim live-testnet, Genesis, external-security-review or production completion.

- Audit branch: `audit/420arbitration-complete-20261004`
- PR: **#509**
- Initial audit baseline / merge-base: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`
- Exact AUDIT-4 qualified implementation SHA: `554e16a3a3656cb61ab1819b60c10eb7c8fa8f93`
- AUDIT-4 workflow run: **37237412184**
- Qualify job: **111539203484 — PASS**
- Security job: **111539203626 — PASS**
- Closeout confirmation head: `80aa33fe1666e1f6015614015dc02ac2dc71b0a8`
- Closeout confirmation run: **37238594853** (#27), qualify **111542609087 — PASS**, security **111542608940 — PASS**
- Current `main` observed during final bookkeeping: `58b6b17c6538bd3cd22694e417a32472aae899f4`
- Durable AUDIT-4 evidence: `docs/audit/420ARBITRATION-AUDIT-4-QUALIFICATION.md`

## Canonical purpose and authority

420Arbitration is the shared dispute-resolution coordination protocol for 420 Integrated. It provides domain-scoped policy, case creation, evidence commitments, exact resolver binding, rulings, bounded appeals and finality without acquiring custody or blanket remedy-execution authority.

Authority remains separated:

- GovernanceTimelock configures domain policy.
- ArbitrationPolicyRegistry420 stores governed domain policy.
- ArbitrationCaseRegistry420 binds parties, origin, requested remedy, policy snapshot, evidence, rounds and deadlines.
- ArbitrationRulingRegistry420 accepts exactly one ruling per round from the selected resolver and finalizes after the appeal window.
- ArbitrationRouter420 is the canonical read/discovery endpoint for Registry publication and does not gain write, custody, resolver or remedy authority.
- Origin protocols remain solely responsible for consuming a finalized ruling through their own explicit authorization/accounting/state transition.

## Canonical contract inventory

The final repository contract inventory is:

1. `ArbitrationIds420.sol`
2. `ArbitrationPolicyRegistry420.sol`
3. `ArbitrationCaseRegistry420.sol`
4. `ArbitrationRulingRegistry420.sol`
5. `ArbitrationRouter420.sol`

The original four-contract baseline was expanded during ARBITRATION-AUDIT-4 because repository precedent for other Registry-resolved protocol applications requires a canonical service endpoint. The router is deliberately read-only and its addition is recorded across the Genesis config, dApp contract map, address namespace, deployment materialization, documentation, verifier and tests.

## Initial audit defects

The initial repository audit found and repaired:

1. `openCase` accepted a zero `requestedRemedyHash` contrary to ARB-INV-001.
2. `submitRuling` accepted a zero `remedyCommitment` although only the panel commitment is optional.
3. the same case/round evidence hash could be committed repeatedly.
4. the documented case-inspection surface lacked a complete CaseRecord getter.
5. canonical Arbitration source had formatting drift.
6. no dedicated exact-head Arbitration audit workflow or mechanical verifier existed.
7. the canonical service ID existed but no repository-authoritative service implementation endpoint/address model existed.
8. the application was classified as `GENESIS_PROTOCOL_AND_USER_APP`, but no executable repository-qualified Arbitration runtime binding was present.
9. deterministic release materialization and local ProtocolRegistry publication proof were absent.
10. Slither reported two Medium `unused-return` findings in RulingRegistry tuple reads.

All repository-side defects 1–10 are closed by ARBITRATION-AUDIT-1 through ARBITRATION-AUDIT-4.

## ARBITRATION-AUDIT-1 — Canonical definition and source reconciliation — COMPLETE

Reconciled:

- Genesis config and 12 ARB-INV invariants;
- canonical service ID `420/service/arbitration/v1`;
- Genesis dApp map;
- protocol/application manuals;
- Wallet catalogue;
- Launchpad and other integration consumers;
- custody/remedy authority boundaries.

The service-endpoint/address/runtime gaps were retained rather than guessed and assigned to AUDIT-4.

## ARBITRATION-AUDIT-2 — Contract and invariant hardening — COMPLETE

Implemented and tested:

- nonzero requested-remedy commitment at case creation;
- nonzero ruling remedy commitment;
- duplicate evidence rejection per case/round;
- complete snapshotted CaseRecord getter;
- policy snapshot preservation;
- exact resolver authority;
- evidence deadline enforcement;
- bounded appeal cap;
- finalization deadline enforcement.

## ARBITRATION-AUDIT-3 — Exact-head source/build/test/security baseline — COMPLETE

Established:

- dedicated exact-head Arbitration CI;
- formatting/build verification;
- mechanical repository verifier;
- Foundry lifecycle/negative tests;
- forbidden `tx.origin` / `delegatecall` / `selfdestruct` scan;
- targeted Slither high-severity gate;
- durable qualification evidence.

AUDIT-3 identified two Medium `unused-return` and six Low Slither findings for explicit later triage.

## ARBITRATION-AUDIT-4 — Application/runtime and release materialization — COMPLETE

### Service and address authority

`ArbitrationRouter420` is now the canonical ProtocolRegistry implementation for `420/service/arbitration/v1`.

The canonical Genesis address namespace contains:

- id: `arbitration-router`
- contract: `ArbitrationRouter420.sol`
- status: `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`

No new fixed predeploy or CREATE2 address was invented.

### Router boundary

The router immutably binds:

- ArbitrationPolicyRegistry420;
- ArbitrationCaseRegistry420;
- ArbitrationRulingRegistry420.

Its constructor rejects an inconsistent Case->Policy or Ruling->Case graph. It exposes canonical reads only. State-changing actions remain on their owning registries.

### Deterministic deployment materialization

`contracts/config/arbitration/arbitration-audit-4-release-materialization.json` records the deterministic sequence:

1. deploy PolicyRegistry;
2. deploy CaseRegistry;
3. deploy RulingRegistry;
4. perform the one-time CaseRegistry -> RulingRegistry binding;
5. deploy ArbitrationRouter420;
6. register `420/component/arbitration/v1` to the exact router;
7. publish `420/service/arbitration/v1` to the exact router with manifest/interface/dependency commitments.

The local deployment qualification proves constructor/binding identities, Registry component/service publication, runtime code identity, service deprecation fail-closed behavior and sequential recovery publication.

### User-facing runtime

The canonical repository user path is the existing Wallet-integrated Genesis application surface.

`wallet/web/core/arbitration-runtime.js` verifies:

- canonical Arbitration service ID;
- chain ID;
- positive service version;
- router address and nonzero code identity;
- distinct Policy, Case and Ruling addresses;
- nonzero code identities for all three registries.

The runtime fails closed on wrong-service, missing-code, invalid-chain/version or aliased dependency input. It maps supported actions to the owning registry and does not auto-sign or acquire governance/resolver/remedy authority.

A standalone future frontend remains replaceable non-canonical infrastructure and must use the same Registry-derived identities.

### Indexer/API boundary

No existing canonical Arbitration-specific Indexer descriptor was found. AUDIT-4 therefore does not invent one.

Canonical case/evidence/ruling/finality history remains reconstructable from chain state and events. Same-deployment projection, rebuild, reorg/finality and live API behavior are explicitly owned by ARBITRATION-AUDIT-5.

### Static-analysis remediation

The two Medium `unused-return` findings were source-located to intentionally discarded fields from the broad `rulingContext` tuple.

AUDIT-4 added purpose-specific CaseRegistry reads:

- `rulingSubmissionContext`;
- `finalizationContext`.

RulingRegistry now consumes exactly the fields it needs. Exact-head Slither reports **zero High findings and zero Medium unused-return findings**.

Retained Low observations:

- two `reentrancy-events` reports because RulingRegistry emits its event after calling the immutable trusted CaseRegistry transition;
- four `timestamp` reports for evidence/appeal/finalization deadline comparisons.

The CaseRegistry transition functions do not call back into RulingRegistry, so the event-order findings do not identify an attacker-controlled callback path. Timestamp use is intentional protocol deadline behavior. These remain documented Low observations and do not imply production-security qualification.

## Exact AUDIT-4 qualification

Implementation SHA: `554e16a3a3656cb61ab1819b60c10eb7c8fa8f93`

Workflow: `420Arbitration audit qualification`, run **37237412184**

Qualify job **111539203484**:

- exact-head checkout: PASS;
- `forge fmt --check`: PASS;
- Arbitration graph build: PASS;
- repository verifier: PASS;
- AUDIT-4 release verifier: PASS;
- shared Genesis namespace verifier: PASS;
- namespace adversarial tests: **12/12 PASS**;
- Wallet Arbitration runtime tests: **3/3 PASS**;
- Foundry Arbitration suites: **13/13 PASS**, 0 failed, 0 skipped;
- forbidden primitive scan: PASS.

Security job **111539203626**:

- exact-head checkout: PASS;
- hardening-profile Arbitration suites: **13/13 PASS**;
- targeted Slither execution: PASS;
- High findings: **0**;
- Medium `unused-return` findings: **0**.

The app-specific run is treated as the AUDIT-4 **Level 2 app-integration milestone**, because this step introduced the shared Registry endpoint/address-authority and Wallet runtime boundary. It includes the required Level 1 checks without duplicating repository-wide Level 3 work.

## Main divergence and phase model

At AUDIT-4 closeout, current `main` was `38a5326cd12e0b48851945be07957a87265b6642`, 109 commits beyond the audit branch merge-base.

Repository comparison found no overlap between those main-only commits and the Arbitration source/config/runtime/docs paths changed by AUDIT-4.

Under the phase qualification model, full branch reconciliation and comprehensive repository-wide Level 3 qualification are intentionally deferred to the final merge-candidate/app-phase closeout. AUDIT-4 does not duplicate that work.

## Requirements traceability summary

| Requirement | Final repository state | Qualification |
|---|---|---|
| domain-scoped governed policy | implemented | PASS |
| policy snapshot at open | implemented | PASS |
| bound case identity/remedy commitment | implemented | PASS |
| party-only evidence | implemented | PASS |
| duplicate evidence replay rejection | implemented | PASS |
| exact current-round resolver | implemented | PASS |
| one ruling per round | implemented | PASS |
| nonzero ruling/remedy commitments | implemented | PASS |
| bounded appeals | implemented | PASS |
| post-window finalization | implemented | PASS |
| no custody/remedy superuser | preserved | PASS |
| canonical service endpoint | ArbitrationRouter420 | PASS |
| Registry-resolved address authority | arbitration-router | PASS |
| deterministic deploy/bind/publish graph | materialized | PASS |
| Wallet-integrated runtime | implemented/fail-closed | PASS |
| local Registry publication/recovery | implemented | PASS |
| Medium static-analysis debt | remediated | PASS |
| live deployment/runtime hashes | not yet available | AUDIT-5 |
| live projection/reorg/finality | not yet available | AUDIT-5 |
| representative live origin remedy consumption | not yet available | AUDIT-5 |
| external production security review | not yet complete | AUDIT-6 |
| production monitoring/incident/key custody | not yet complete | AUDIT-6 |

## Readiness state

- CODE COMPLETE: **YES at repository scope**
- BUILD COMPLETE: **YES**
- CONTRACT COMPLETE: **YES at repository scope**
- REPOSITORY TEST COMPLETE: **YES for the current audit phase**
- DOCUMENTATION COMPLETE: **YES for repository handoff; live/operator acceptance records remain later-phase evidence**
- REPOSITORY INTEGRATION COMPLETE: **YES through the Registry/address/Wallet release boundary**
- SECURITY QUALIFIED: **YES for repository AUDIT-4 gates; NO for final production security**
- TESTNET ENTRY READY: **YES**
- TESTNET QUALIFIED: **NO — live testnet evidence does not yet exist**
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

## Formal ARBITRATION-AUDIT-4 closeout

ARBITRATION-AUDIT-4 is **COMPLETE**. The repository-side application/runtime and release-materialization scope has been implemented, documented, mechanically verified, and exact-head qualified. A subsequent exact-head confirmation on `80aa33fe1666e1f6015614015dc02ac2dc71b0a8` passed both the qualify and security jobs, so the durable closeout documentation did not invalidate the qualified state.

No further repository-local work is required to complete ARBITRATION-AUDIT-4. The next audit step requires live deployment evidence and therefore cannot be completed from repository CI, local EVMs, or synthetic fixtures alone.

## Remaining canonical work

### ARBITRATION-AUDIT-5 — Production-equivalent public testnet qualification — NEXT / BLOCKED ON LIVE TESTNET

Once the approved live public testnet candidate is available/frozen, retain evidence for:

1. chain ID, network/genesis identity and evidence block/hash;
2. exact deployed Policy/Case/Ruling/Router addresses and runtime code hashes;
3. GovernanceTimelock and ProtocolRegistry identities;
4. all constructor/immutable and one-time Case->Ruling bindings;
5. governed ProtocolRegistry component registration and active service resolution;
6. live domain-policy configuration;
7. real case/evidence/ruling/appeal/finalization lifecycle;
8. representative origin-protocol finalized-ruling consumption through the origin protocol's own authority;
9. Wallet runtime discovery and reviewed transaction targets against the same deployment;
10. same-deployment projection/indexer rebuild, reorg, finality, stale-data and RPC-disagreement behavior;
11. retained deployment/configuration transactions, receipts, logs, blocks, runtime hashes and exact release SHA.

Repository CI, local EVMs and synthetic fixtures must not be promoted to AUDIT-5 completion evidence.

### ARBITRATION-AUDIT-6 — Genesis/production security and release closeout — BLOCKED ON AUDIT-5

After AUDIT-5 closes:

- reconcile all prior evidence to the exact release candidate;
- complete resolver/operator key-custody procedures;
- complete monitoring, incident response and recovery;
- complete independent external security review or an explicitly approved release exception;
- perform final Level 3 reconciliation against current `main`;
- run canonical full Solidity qualification once through its owning workflow;
- run Genesis/address-authority qualification separately without duplicating the full Foundry inventory;
- run applicable 420 Integrated/global, Docs, retained Arbitration, client/service/Indexer/Search/RPC and deployment/config qualification;
- separately declare CODE, BUILD, CONTRACT, TEST, DOCUMENTATION, INTEGRATION, SECURITY, TESTNET, GENESIS and PRODUCTION readiness.

## Final determination

The **repository-side 420Arbitration audit is finished through ARBITRATION-AUDIT-4**.

All work that can be honestly completed before a live production-equivalent public testnet is available has been implemented and qualified. ARBITRATION-AUDIT-5 is now the next canonical step and is blocked by live testnet availability, not by unfinished repository implementation.

PR #509 remains open and unmerged. Merge/reconciliation is a separate action and is not performed by this audit closeout.
