# ARB-PRE-02 — Contract and protocol qualification

## Scope and provenance

This audit is specific to the five canonical 420Arbitration files in `contracts/src/arbitration` and the existing `ArbitrationGenesis420.t.sol`, `ArbitrationDeploymentBinding420.t.sol`, and new `ArbitrationProtocolQualification420.t.sol` suites. It extends, rather than supersedes, ARBITRATION-AUDIT-1 through -4. The implementation has no transfer, custody, generic remedy execution, slashing, or privileged governance shortcut.

**Evidence authority:** The successful `420Arbitration audit qualification` GitHub Actions run attached to the *exact PR implementation head*. Both `qualify` and `security` jobs must pass, along with the dedicated format/build, invariant, namespace, Wallet, Slither and forbidden-primitive gates. A cancelled, superseded, or failed run is not completion evidence. The PR discussion retains run and job IDs before phase closeout.

## Contract review and correction

- `ArbitrationIds420`: immutable component/action identifier namespace; no external entry points.
- `ArbitrationPolicyRegistry420`: only GovernanceTimelock may set domain policies; zero domain/resolver/windows, unbounded appeal caps and missing appeal resolver are rejected. Unknown or inactive domains cannot open cases.
- `ArbitrationCaseRegistry420`: validates claimant/respondent separation, origin identifiers, commitments, policy snapshot, evidence parties/deadlines/round uniqueness, capped appeals and finality. Its one-time `bindRulingRegistry` now refuses an EOA, a missing-code address, and any candidate whose `cases()` does not point to this very CaseRegistry; it remains governance-only and irreversible.
- `ArbitrationRulingRegistry420`: retains exactly one resolver-authorized ruling per round, nonzero outcome/ruling/remedy, case-controlled state transitions, appeal-window checks, and permissionless post-deadline finalization. It never executes a remedy.
- `ArbitrationRouter420`: immutable, read-only dependency inspection now rejects a graph unless all three deployed contracts have code, the Case->Policy and Ruling->Case links match, and the Case->Ruling one-time binding is reciprocal. The ProtocolRegistry publication remains the sole service identity authority; no new fixed address is introduced.

No policy durations, max-appeal limit (three), event signatures, existing case records, service identifier, storage layout for existing fields, or custody/remedy authority is altered. The two added validation errors provide fail-closed error paths; no valid deployments are loosened.

## ARB-INV traceability

| Invariant | Contract source and proof |
| --- | --- |
| ARB-INV-001 | CaseRegistry `openCase` / `getCase`; `testCaseOriginAndUniqueIdentity`, `testCaseRejectsInvalidFields`, fuzz identity test |
| ARB-INV-002 | Policy snapshot in CaseRegistry; `testPolicyDeactivationDoesNotChangeExistingCase`, `testFuzzPolicyWindows` and retained policy snapshot test |
| ARB-INV-003 | CaseRegistry `submitEvidence` and `appeal`; `testEvidencePartyDeadlineAndRoundIsolation`, `testEvidenceExactDeadlineAndAfter` |
| ARB-INV-004 | RulingRegistry `submitRuling`; `testRulingAndFinalityAuthorization` and retained wrong-resolver test |
| ARB-INV-005 | RulingRegistry `_rulings[caseId][round]` and CaseRegistry `maxAppeals`; `testAppealDeadlineAndExhaustedAppeals`, retained cap test |
| ARB-INV-006 | RulingRegistry commitments and no custody methods; `testRulingAndFinalityAuthorization`; static API/forbidden-primitive scan |
| ARB-INV-007 | CaseRegistry `finalize`, RulingRegistry `finalizeRuling`, round-specific history; `testAppealDeadlineAndExhaustedAppeals`, retained deadline test |
| ARB-INV-008 | All five contract APIs; no external transfer/remedy execution, negative interface/primitive scan |
| ARB-INV-009 | Explicit absence of origin-protocol custody/remedy execution in all five contracts; consumer-specific remedy qualification remains owned by ARB-PRE-07 |
| ARB-INV-010 | Governance-only `setPolicy`; `testPolicyStartsInactiveAndRejectsUnknown`, `testPolicyRejectsInvalidBoundaries`, `testGovernanceOnlyPolicyAndBinding` |
| ARB-INV-011 | Case, evidence, ruling, appeal and finalization events plus `getCase`/`getRuling`/router reads; reconstruction/projection is separately owned by ARB-PRE-06 |
| ARB-INV-012 | Domain/origin-scoped commitments and no general legal/enforcement claim, including `testCaseOriginAndUniqueIdentity` and noncustodial interface review |

## Additional adversarial boundaries

- Illegal zero deployment inputs and mismatched/unbound graph rejected.
- One-time governance binding refuses invalid targets, retains correct bind, and rejects replay.
- Evidence submitted exactly at deadline is permitted; after deadline rejected.
- One evidence hash may be reused in a later *round*, but duplicate use in the same round is rejected.
- Expired appeal rejected; three distinct appeal rounds and history preserved; finalization after deadline is permanent.
- Outsider cannot submit evidence or rulings or directly mark cases ruled/finalized.
- Fuzzed case origin/claim/remedy commitments survive storage; fuzzed policy windows and cap survive case creation.

## Qualification boundary

The dedicated workflow runs all three Arbitration suites under `pr` and `hardening`, with `FOUNDRY_SRC=src/arbitration` and a test-only directory so unrelated CADC vendor fixtures are not compiled. This does not change shared `foundry.toml` or skip any applicable Arbitration test. Successful targeted Slither and forbidden-primitive gates are mandatory.

Repository contract qualification does not substitute for Wallet app UI, real Indexer/reorg recovery, origin-protocol remedy execution, or live testnet deployment. These remain separate canonical phases.
