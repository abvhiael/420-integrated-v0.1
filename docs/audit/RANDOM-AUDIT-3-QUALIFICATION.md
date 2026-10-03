# RANDOM-AUDIT-3 qualification evidence

Step: **RANDOM-AUDIT-3 — deterministic Genesis materialization**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository state

- Repository: `abvhiael/420-integrated-v0.1`
- Audit branch: `audit/420randomness-remediation`
- PR: **#496**
- Qualification base `main`: `edfd0752e825fc5379700851358e8398efb0b9c5`
- Current `main` at durable-bookkeeping review: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`
- Qualified implementation SHA: `809cff5ea67fc48c3082f5ce0702b8572b18c663`
- Evidence lineage HEAD before this bookkeeping update: `e041f9f0d3a4a0b9fe6c3ca9c041c00db4bb0dd8`
- Branch divergence at qualification: **34 ahead / 0 behind qualification-base main**
- Branch divergence at durable-bookkeeping review: **36 ahead / 27 behind current main**
- The delta from the qualified implementation SHA through evidence lineage HEAD contains only `docs/audit/RANDOM-AUDIT-3-QUALIFICATION.md` and `docs/audit/420RANDOMNESS-COMPLETE-AUDIT-20261002.md`; no requalification-triggering files changed.
- Workflow: **420Randomness audit qualification**
- Run: **37098929839**
- Job: **111134459600**

## Canonical requirement satisfied

RANDOM-AUDIT-3 retains deterministic offline Genesis materialization for the frozen `RandomnessRegistry` predeploy at `0x0000000000000000000000000000000000000428`.

The implementation now retains:

- exact pinned compiler/toolchain provenance;
- source blob identity;
- ABI and creation bytecode;
- compiler deployed-runtime template;
- compiler-derived immutable locations;
- materialized deployed runtime with GovernanceTimelock `0x0000000000000000000000000000000000000429`;
- final runtime code hash;
- compiler storage layout;
- explicit empty Genesis mutable storage state;
- predeploy-plan bindings;
- deployment-manifest bindings;
- deterministic generator and verifier tests.

## Retained identity

- source: `contracts/src/randomness/RandomnessRegistry.sol`
- source blob SHA-1: `4f5548314eb37c7c52f8199560439f97c6c837ce`
- Solidity: **0.8.24**
- EVM: **Cancun**
- optimizer: **enabled / 200 runs**
- via IR: **enabled**
- compiler runtime template SHA-256: `530bbc0a72108e2965c9be94d94716eab93612193c467d88b27ad28e16b6bb17`
- immutable reference count: **2**
- immutable semantic identity: `governanceTimelock`
- materialized governance address: `0x0000000000000000000000000000000000000429`
- final runtime code hash: `0x0c921ab8b2282ea3ed2d7f64b5ca0f6ecb54c67d52e421a347a1449d43e8345a`
- storage roots: `randomnessRouter` slot **0**, `_records` slot **1**
- mutable constructor writes: **0**
- initial mutable storage slots: **0**
- storage root: `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`

The Genesis runtime embeds the GovernanceTimelock immutable. `randomnessRouter` remains zero and `_records` remains empty; router binding is intentionally deferred until the qualified deployment sequence in later roadmap work.

## Files added/updated

- `contracts/artifacts/RandomnessRegistry.json`
- `contracts/config/predeploy/RandomnessRegistry-predeploy-state.json`
- `contracts/config/predeploy/predeploy-plan.json`
- `contracts/config/deployment-manifest.json`
- `scripts/generate-random-audit-3-genesis.py`
- `scripts/test-random-audit-3-genesis.py`
- `scripts/verify-420randomness-audit.py`
- `.github/workflows/420randomness-audit.yml`

## Reproducibility correction

An intermediate read-only qualification exposed that Solidity's raw `immutableReferences` dictionary identifier is AST-derived and can change when the same contract is compiled alone versus within the complete Randomness graph. The actual compiler-reported byte offsets and runtime were stable.

The materializer was corrected to retain the compiler-derived locations under the stable semantic identity `governanceTimelock`. This preserves compiler authority over the offsets while removing an irrelevant build-context-dependent AST number from the canonical artifact schema. The materialized runtime and final runtime code hash did not change.

## Exact-head qualification

On exact SHA `809cff5ea67fc48c3082f5ce0702b8572b18c663`:

- exact qualification-head verification: **PASS**
- canonical Randomness inventory / Genesis wiring verifier: **PASS**
- full retained Randomness formatting: **PASS**
- canonical Randomness graph build: **PASS**
- deterministic Genesis generator `--check --print`: **PASS**
- dedicated RANDOM-AUDIT-3 verifier: **PASS**
- generated-output clean-tree check: **PASS**
- all `Randomness*.t.sol` tests: **PASS**
- forbidden `tx.origin` / `selfdestruct` / `delegatecall` scan: **PASS**

Foundry result:

- `RandomnessAudit420Test`: **5 passed / 0 failed / 0 skipped**
- `RandomnessDraw420Test`: **5 passed / 0 failed / 0 skipped**
- `Randomness420Test`: **10 passed / 0 failed / 0 skipped**
- total: **20 passed / 0 failed / 0 skipped**

## Superseded runs

- Run `37098795102` qualified the pre-materialization SHA. Its verifier correctly failed because the newly required retained artifact/state did not yet exist; the materialization job then generated them.
- Run `37098855306` on `b808685dc06113e1734ba9de4e8ff0217dac2667` exposed the unstable raw compiler AST immutable identifier described above. Verifier, formatting and build passed; deterministic materialization reproducibility failed. The root cause was fixed before final qualification.

No protocol semantics, authorization, tests, assertions, replay rules, fallback rules or safety gates were weakened.

## Exact-SHA / evidence-only authority

The exact implementation authority remains `809cff5ea67fc48c3082f5ce0702b8572b18c663`, qualified by run `37098929839`, job `111134459600`.

Subsequent RANDOM-AUDIT-3 commits through `e041f9f0d3a4a0b9fe6c3ca9c041c00db4bb0dd8` are documentation-only bookkeeping. Repository comparison confirms the only changed paths relative to the qualified implementation SHA are:

- `docs/audit/RANDOM-AUDIT-3-QUALIFICATION.md`
- `docs/audit/420RANDOMNESS-COMPLETE-AUDIT-20261002.md`

Therefore the audit's evidence-only exception applies: the implementation qualification is not recursively invalidated by these documentation updates.

Current `main` has advanced independently to `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`. Reconciliation with that newer base is intentionally deferred to the appropriate later milestone/Level 3 closeout and does not invalidate this ordinary Level 1 step's exact-SHA evidence.

## Milestone status

RANDOM-AUDIT-3 is an ordinary Level 1 materialization step, not the final app integration or phase-closeout milestone.

- Level 2 broader app integration: **intentionally deferred** to a meaningful deployment/integration boundary.
- Level 3 comprehensive phase closeout: **intentionally deferred** until the complete Randomness audit phase is ready for reconciliation and merge.

## Limitations and remaining blockers outside this step

This evidence is deterministic **offline Genesis materialization**, not live-chain deployment evidence.

Remaining roadmap work includes:

- route/profile/router deployment ordering and arguments;
- exact ProtocolRegistry publication;
- one-time `RandomnessRegistry.bindRouter` transaction definition;
- production-equivalent testnet code/storage verification and smoke tests;
- indexer projection against deployed ABI/events;
- independent production security/release closeout.

## Exit criteria

- exact compiler artifact retained: **PASS**
- source blob retained/bound: **PASS**
- compiler storage layout retained: **PASS**
- GovernanceTimelock immutable materialized from compiler-reported locations: **PASS**
- final runtime hash retained: **PASS**
- deterministic predeploy state retained: **PASS**
- predeploy plan and deployment manifest bound to identical artifact/state/hash/source identity: **PASS**
- artifact/state reproduce byte-for-byte on the exact qualification head: **PASS**
- required Level 1 Randomness tests/static checks pass: **PASS**
- durable evidence recorded: **PASS**

**RANDOM-AUDIT-3 is COMPLETE.**

Next canonical roadmap step: **RANDOM-AUDIT-4 — deployment bundle.**
