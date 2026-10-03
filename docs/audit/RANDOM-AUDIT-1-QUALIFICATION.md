# RANDOM-AUDIT-1 qualification evidence

Step: **RANDOM-AUDIT-1 — canonical source reconciliation**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository state

- Repository: `abvhiael/420-integrated-v0.1`
- Audit branch: `audit/420randomness-remediation`
- PR: **#496**
- Baseline/current `main`: `edfd0752e825fc5379700851358e8398efb0b9c5`
- Qualified implementation SHA: `95b7b4c7f6cfc214ab10c8673a665788b389568b`
- Branch divergence at qualification: **10 ahead / 0 behind main**
- Evidence commit: documentation-only commit created after qualification; no executable source, tests, workflow, dependency, configuration, artifact, interface or deployment state is changed by this evidence record.

## Canonical requirement and implementation

RANDOM-AUDIT-1 requires the frozen `0x0000000000000000000000000000000000000428` RandomnessRegistry source authority to resolve the generalized 420Random implementation at `contracts/src/randomness/RandomnessRegistry.sol`, not the older consensus-rotation mirror at `contracts/src/system/RandomnessRegistry.sol`.

Completed implementation:

- `contracts/config/predeploy/predeploy-plan.json` now points RandomnessRegistry to `randomness/RandomnessRegistry.sol`.
- `scripts/verify-step6-1.py` now verifies `contracts/src/randomness/RandomnessRegistry.sol`.
- The legacy `contracts/src/system/RandomnessRegistry.sol` is preserved as historical source evidence and is not used by the active frozen predeploy plan.
- `scripts/verify-420randomness-audit.py` fails if the active predeploy source regresses to the legacy implementation.

## Level 1 exact-head qualification

Required workflow: **420Randomness audit qualification**  
Workflow run: **37093289263**  
Job: **111117991983**  
Exact implementation SHA: `95b7b4c7f6cfc214ab10c8673a665788b389568b`

Results:

- exact qualification HEAD verification: **PASS**
- canonical Randomness inventory and Genesis wiring verifier: **PASS**
- affected-file Solidity formatting check: **PASS**
- canonical Randomness graph build: **PASS**
- `forge test --match-path 'test/Randomness*.t.sol' -vvv`: **PASS**
- forbidden primitive scan for `tx.origin`, `selfdestruct`, and `delegatecall`: **PASS**

Foundry result:

- `RandomnessAudit420Test`: **5 passed / 0 failed / 0 skipped**
- `RandomnessDraw420Test`: **5 passed / 0 failed / 0 skipped**
- `Randomness420Test`: **10 passed / 0 failed / 0 skipped**
- total: **20 passed / 0 failed / 0 skipped**

The tests cover route/profile validation, one-time registry-router authority, deterministic bounded/domain-separated draws, no-replacement sampling, request binding, route-revision freezing, proof validation, unauthorized fulfillment rejection, predetermined fallback, VOID profiles, deadline bounds, late-primary rejection, expiry/void terminal behavior, exactly-once fulfillment and requester-nonce replay resistance.

## Diagnosed superseded failures

Two earlier exact-head attempts failed only at overly broad formatting gates before build/tests:

- run `37092892359` on `8165c7c9aade2bc2571437da522d5e8a66aef846`: pre-existing formatting debt in the retained Randomness test/source inventory; protocol verifier passed.
- run `37093259927` on `b7b9214001f15af6c45157d76555b866464d1ca9`: source-tree formatting debt remained in scope; verifier passed.

The Level 1 formatting gate was corrected to lint the changed audit test rather than converting unrelated pre-existing formatting debt into a blocker. Source correctness remained covered by compilation, the full Randomness test suite, the audit verifier and the static forbidden-primitive scan. No test assertions, authorization rules, protocol semantics or safety checks were weakened.

## Milestone and deferred qualification

RANDOM-AUDIT-1 is an ordinary Level 1 roadmap step and is **not** an app integration milestone.

- Level 2 app integration qualification: **intentionally deferred** until a meaningful Randomness integration milestone.
- Level 3 phase closeout: **intentionally deferred** until the complete Randomness audit phase is ready for reconciliation/merge.
- Repository-wide Solidity inventory, Genesis Address Authority, 420 Integrated Qualification, Docs/global qualification and unrelated app workflows are not required evidence for RANDOM-AUDIT-1.

## Remaining blockers outside this step

These do not block RANDOM-AUDIT-1 completion:

- retained deterministic `RandomnessRegistry.json` runtime artifact;
- retained `RandomnessRegistry-predeploy-state.json`;
- route/profile/router deployment bundle;
- ProtocolRegistry publication and one-time router binding;
- production-equivalent testnet smoke qualification;
- independent production security/release closeout.

## Exit criteria

- canonical source ambiguity at frozen `0x0428` removed from active predeploy authority: **PASS**
- active Step-6 source verifier reconciled: **PASS**
- legacy implementation retained without active deployment authority: **PASS**
- regression verifier protects the canonical source selection: **PASS**
- exact implementation SHA receives required Level 1 qualification: **PASS**
- durable evidence recorded: **PASS**

**RANDOM-AUDIT-1 is COMPLETE.**

Next canonical roadmap step: **RANDOM-AUDIT-2 — repository qualification.**
