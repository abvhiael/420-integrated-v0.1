# ARBITRATION-AUDIT-4 qualification evidence

## Status

- Step: **ARBITRATION-AUDIT-4 — Application/runtime and release materialization**
- Completion state: **COMPLETE**
- Qualification level: **Level 2 app-integration milestone** (includes all required Level 1 step-specific checks)
- Exact qualified implementation SHA: `554e16a3a3656cb61ab1819b60c10eb7c8fa8f93`
- Initial durable evidence commit SHA: `c62861fbc8fc04d80650ce9ec9ede98b689c49a8`
- Qualification workflow: `420Arbitration audit qualification`
- Workflow run: **37237412184** (#22)
- Qualify job: **111539203484 — PASS**
- Security job: **111539203626 — PASS**
- Qualification merge-base: `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`
- Current `main` observed at closeout: `38a5326cd12e0b48851945be07957a87265b6642`
- Audit branch: `audit/420arbitration-complete-20261004`
- PR: **#509**
- Closeout confirmation head: `80aa33fe1666e1f6015614015dc02ac2dc71b0a8`
- Closeout confirmation workflow run: **37238594853** (#27)
- Closeout confirmation qualify job: **111542609087 — PASS**
- Closeout confirmation security job: **111542608940 — PASS**
- Live testnet qualification: **not claimed; owned by ARBITRATION-AUDIT-5**

## Implementation completed

ARBITRATION-AUDIT-4 resolves every repository-side materialization gap retained from the initial audit:

1. **Canonical service endpoint**
   - added `ArbitrationRouter420`;
   - canonical ProtocolRegistry service `420/service/arbitration/v1` resolves to that router;
   - router is read-only and binds the exact Policy, Case and Ruling registries;
   - constructor rejects an inconsistent Case->Policy or Ruling->Case graph.

2. **Canonical address authority**
   - added `arbitration-router` to `contracts/config/genesis-address-namespace.json`;
   - status is `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`;
   - no new fixed Genesis predeploy and no invented CREATE2 address.

3. **Deterministic release materialization**
   - added `contracts/config/arbitration/arbitration-audit-4-release-materialization.json`;
   - fixed the seven-step deploy/bind/register/publish sequence;
   - defined artifact paths, Registry publication commitments and live-evidence ownership;
   - added local-EVM deployment/Registry binding tests.

4. **Wallet-integrated user runtime**
   - added `wallet/web/core/arbitration-runtime.js`;
   - verifies canonical service ID, chain/version, router code identity and distinct Policy/Case/Ruling code identities;
   - fails closed on wrong/unverified/aliased runtime identities;
   - maps supported state-changing actions to the owning registries without auto-signing or acquiring resolver/governance/remedy authority.

5. **Static-analysis remediation**
   - the two Medium `unused-return` findings were source-located to tuple values intentionally discarded from `rulingContext`;
   - added purpose-specific `rulingSubmissionContext` and `finalizationContext` reads;
   - RulingRegistry now consumes exactly the values required;
   - the exact-head Slither gate confirms **zero High findings and zero Medium unused-return findings**.

## Exact-head qualification results

### Qualify job — 111539203484

PASS:
- exact-head checkout verification;
- `forge fmt --check` for Arbitration source and both Arbitration test files;
- Arbitration graph build;
- `scripts/verify-420arbitration-audit.py`;
- `scripts/verify-arbitration-audit-4-release.py`;
- shared Genesis namespace authority verifier;
- all **12/12** namespace adversarial unit checks;
- Wallet Arbitration runtime node tests: **3/3 passed**;
- Arbitration Foundry suites: **13/13 passed, 0 failed, 0 skipped**:
  - deployment/Registry binding: **2/2**;
  - canonical lifecycle/hardening suite: **11/11**;
- forbidden `tx.origin` / `selfdestruct` / `delegatecall` scan.

### Security job — 111539203626

PASS:
- exact-head checkout verification;
- hardening-profile Arbitration Foundry suites: **13/13 passed**;
- targeted Slither execution;
- High-severity findings: **0**;
- Medium `unused-return` findings: **0**.

Retained Low Slither findings:
- two `reentrancy-events` reports in `ArbitrationRulingRegistry420` because events are emitted after calls to the immutable trusted CaseRegistry;
- four `timestamp` reports for evidence, appeal and finalization deadline comparisons.

Disposition:
- the reentrancy-event reports do not identify an attacker-controlled callback path: the immutable CaseRegistry transition functions do not call back into the RulingRegistry; state/ruling existence is established before the CaseRegistry transition. They remain documented Low static-analysis observations.
- timestamp comparisons are intentional protocol deadline semantics. They remain bounded by the configured evidence/appeal windows and are documented as a consensus-timestamp design dependency, not silently removed.

Neither Low class is promoted to a production-security declaration; final production security remains ARBITRATION-AUDIT-6.

## Shared/dependency qualification

The Audit-4 workflow directly runs the shared Genesis address-namespace verifier because this step added the registry-resolved Arbitration router entry. That verifier and its 12 adversarial tests pass on the exact implementation SHA.

The repository-wide Solidity workflow was triggered automatically by the contract changes as run `37237412266` (#4711). It ultimately concluded **cancelled after the branch advanced into evidence-only closeout commits**. It is not a required Level-1/Level-2 check for this step under the phase qualification model and is therefore not substituted for, or counted as, passing AUDIT-4 evidence. Canonical Level-3 full-inventory ownership remains with Solidity Contracts at final app-phase closeout.

## Main divergence at closeout

At durable closeout, current `main` had advanced to `38a5326cd12e0b48851945be07957a87265b6642`; the audit branch remained based on merge-base `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`.

A repository compare of the 109 main-only commits found **no overlap with the Arbitration source/config/runtime/docs paths changed by AUDIT-4**. Final branch reconciliation is therefore intentionally deferred to the later Level-3 merge-candidate closeout rather than duplicating repository-wide work here.

## Exit-criterion check

- canonical user-facing runtime path resolved: **PASS**
- ProtocolRegistry implementation endpoint defined: **PASS**
- Registry-resolved address authority defined without fixed-address invention: **PASS**
- deterministic deployment/binding graph materialized: **PASS**
- local ProtocolRegistry publication/deprecation/recovery proof: **PASS**
- artifact identity policy recorded: **PASS**
- Wallet app/runtime discovery bound to verified identities: **PASS**
- Indexer/API authority handled without inventing a canonical descriptor: **PASS**; live same-deployment projection/reorg evidence belongs to AUDIT-5
- retained Medium Slither debt resolved: **PASS**
- required app-specific qualification: **PASS**
- live production-equivalent testnet evidence: **intentionally deferred to ARBITRATION-AUDIT-5**

## Final closeout confirmation

After the durable Audit-4 evidence/roadmap bookkeeping was committed, the exact branch head `80aa33fe1666e1f6015614015dc02ac2dc71b0a8` was requalified by Arbitration workflow run **37238594853** (#27). Both jobs passed: qualify **111542609087** and security **111542608940**. This confirms the documentation/evidence closeout did not invalidate the qualified repository state.

ARBITRATION-AUDIT-4 is therefore **formally COMPLETE**. No repository-local work remains in Audit-4.

## Next canonical step

**ARBITRATION-AUDIT-5 — Production-equivalent public testnet qualification.**

It is blocked only on availability/freeze of the approved live public testnet candidate. Repository/local-EVM evidence must not be promoted to live completion evidence.
