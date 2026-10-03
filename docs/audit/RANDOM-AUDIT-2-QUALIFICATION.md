# RANDOM-AUDIT-2 qualification evidence

Step: **RANDOM-AUDIT-2 — repository qualification**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository state

- Repository: `abvhiael/420-integrated-v0.1`
- Audit branch: `audit/420randomness-remediation`
- PR: **#496**
- Baseline/current `main`: `edfd0752e825fc5379700851358e8398efb0b9c5`
- Qualified implementation SHA: `f40d9b89e9e4c8626a8105c61385041b986853ca`
- Branch divergence at qualification: **21 ahead / 0 behind main**
- Qualification workflow: **420Randomness audit qualification**
- Workflow run: **37094231759**
- Job: **111120749696**

## Canonical requirement

RANDOM-AUDIT-2 requires the complete retained generalized 420Randomness repository set to pass the app-specific verifier, formatting qualification, canonical build, all retained `Randomness*.t.sol` tests and the app-scoped static security scan on one exact branch head.

This is an ordinary Level 1 qualification step. Repository-wide Solidity, Genesis Address Authority, 420 Integrated/global qualification, Docs/global qualification and unrelated app workflows are intentionally deferred to Level 3 phase closeout unless a changed dependency makes them directly applicable.

## Gap found and remediated

The first strict RANDOM-AUDIT-2 qualification attempt exposed formatting debt in retained Randomness implementation, interface and test files. This was a repository hygiene defect, not a protocol-behavior failure: the canonical verifier passed before the formatter stopped the run.

The retained set was normalized with the same Foundry stable formatter used by CI:

- `contracts/src/randomness/RandomnessDraw420.sol`
- `contracts/src/randomness/RandomnessIds420.sol`
- `contracts/src/randomness/RandomnessProfileRegistry420.sol`
- `contracts/src/randomness/RandomnessRegistry.sol`
- `contracts/src/randomness/RandomnessRouteRegistry420.sol`
- `contracts/src/randomness/RandomnessRouter420.sol`
- `contracts/src/interfaces/IRandomnessRouter420.sol`
- `contracts/src/interfaces/IRandomnessVerifier420.sol`
- `contracts/test/Randomness420.t.sol`
- `contracts/test/RandomnessDraw420.t.sol`

`contracts/test/RandomnessAudit420.t.sol` was already formatted and remained included in the full formatting gate.

A temporary CI-assisted formatting path was used only to apply deterministic formatter output. It was removed before qualification. The permanent `420randomness-audit.yml` workflow was restored to `contents: read` before the qualified implementation SHA was established.

No protocol semantics, tests, assertions, permissions, authorization rules, fallback behavior, replay protections or safety gates were changed to obtain the pass.

## Exact-head Level 1 qualification

Exact implementation SHA: `f40d9b89e9e4c8626a8105c61385041b986853ca`

Results:

- exact qualification HEAD verification: **PASS**
- canonical Randomness inventory and Genesis wiring verifier: **PASS**
- full retained Randomness Solidity formatting check: **PASS**
- canonical Randomness graph build: **PASS**
- `forge test --match-path 'test/Randomness*.t.sol' -vvv`: **PASS**
- forbidden primitive scan for `tx.origin`, `selfdestruct`, and `delegatecall`: **PASS**

Foundry result:

- `RandomnessAudit420Test`: **5 passed / 0 failed / 0 skipped**
- `RandomnessDraw420Test`: **5 passed / 0 failed / 0 skipped**
- `Randomness420Test`: **10 passed / 0 failed / 0 skipped**
- total: **20 passed / 0 failed / 0 skipped**

## Security/adversarial coverage retained

The qualified suite covers:

- invalid route/operator/verifier rejection;
- invalid profile timeout/fallback shapes;
- one-time RandomnessRegistry router binding and router-only mutation;
- deterministic/domain-separated bounded draws;
- no-replacement sampling and invalid draw bounds;
- request binding to profile and exact route revisions before entropy;
- route-revision freezing;
- proof validation and unauthorized operator rejection;
- exactly-once fulfillment including a zero provider word;
- predetermined single-stage fallback;
- VOID profile behavior;
- request lifetime/deadline bounds;
- late-primary rejection after the fallback window;
- expiry-to-void terminal behavior;
- requester-nonce replay resistance;
- static rejection of forbidden authority/code-execution primitives in canonical Randomness sources.

## Diagnosed superseded qualification attempt

Run `37094086169` on SHA `2e1a3fd8ef8c14f8f44de22c728e67c3e90b10dc` failed at the intentionally strengthened full formatting gate. The canonical verifier passed; build/tests were correctly skipped after the deterministic formatting failure. The root cause was fixed by normalizing the retained repository set instead of narrowing or bypassing the check.

## Milestone status and deferred work

RANDOM-AUDIT-2 is **not** a Level 2 integration milestone.

- Level 2 retained app integration: **intentionally deferred** until a meaningful Randomness deployment/integration milestone.
- Level 3 comprehensive phase closeout: **intentionally deferred** until the accumulated Randomness audit phase is ready for reconciliation and merge.

The following are outside RANDOM-AUDIT-2 and remain for later canonical steps:

- deterministic retained `RandomnessRegistry.json` compiler/runtime artifact;
- source blob, runtime hash and storage layout retention;
- `RandomnessRegistry-predeploy-state.json`;
- deployment ordering and constructor arguments;
- ProtocolRegistry publication and one-time `bindRouter`;
- production-equivalent testnet qualification;
- independent production security/release closeout.

## Exit criteria

- dedicated verifier passes on exact branch head: **PASS**
- complete retained Randomness formatting gate passes: **PASS**
- canonical Randomness graph builds: **PASS**
- every retained `Randomness*.t.sol` test passes: **PASS**
- app-scoped static security scan passes: **PASS**
- exact implementation SHA is recorded: **PASS**
- no skipped/cancelled/missing required Level 1 check substituted for evidence: **PASS**
- temporary write-capable CI remediation path removed before qualification: **PASS**
- durable repository evidence recorded: **PASS**

**RANDOM-AUDIT-2 is COMPLETE.**

Next canonical roadmap step: **RANDOM-AUDIT-3 — deterministic Genesis materialization.**
