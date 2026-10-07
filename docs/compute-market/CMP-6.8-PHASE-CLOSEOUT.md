# CMP-6.8 — Phase closeout

Status: **LEVEL 3 CLOSEOUT CANDIDATE — exact-head comprehensive qualification required.**

## Canonical definition

Reconcile the complete accumulated CMP-6 useful-computation reward phase against current `main`, establish one exact merge-candidate implementation SHA, run required Level 3 qualification once, preserve durable evidence, and hand off to **CMP-7 — SDK, API, CLI and indexer**.

## Reconciliation baseline

Current `main` reconciled: `dff7c038160871436a5df81295ce71fd94e4ddfe`.

Reconciled branch anchor: `b5d8423589db5607bc59be282b654ff9b40a88a5`.

That anchor is a true two-parent merge of current main plus the complete CMP-6.1–6.7 implementation. Subsequent closeout/evidence/config/workflow commits are descendants of that reconciled anchor and remain zero commits behind that recorded main baseline.

## Prerequisites

CMP-6.1 through CMP-6.7 have durable qualification evidence.

Level 2 milestones are:

- CMP-6.2 — funding + canonical verification convergence;
- CMP-6.5 — pool funding + sponsor matching convergence;
- CMP-6.7 — final reward-policy/accounting convergence.

## Accumulated CMP-6 protocol surface

CMP-6 contains:

- separately funded useful-computation job/pool provenance and canonical Vault deposit;
- verification-gated reward eligibility;
- typed verified contribution accounting;
- project/metric-bound research reward pools;
- finite prefunded sponsor matching;
- anti-Sybil / anti-farming economic admission controls;
- transparent deterministic reward accounting with pool-budget and replay protection.

## Level 3 ownership

1. **Solidity Contracts** owns the canonical complete repository Foundry inventory exactly once, using four balanced PR shards.
2. **Genesis Address Authority** owns address, namespace, collision, predeploy, frozen-manifest and manifest-authority verification and must not duplicate full Foundry.
3. **420 Integrated Qualification** owns global runtime/build/Geth/fault/soak qualification.
4. **420Docs Qualification** owns global documentation/reconciliation.
5. **Compute Market Qualification** owns the retained Compute suite and all CMP-6 verifiers including this closeout verifier.\n6. **420 Genesis Contract Hardening** owns production size checks, invariant campaigns and the Slither high-severity gate as distinct security/static-analysis coverage.

Missing, cancelled, stale, superseded, skipped-required or untriggered gates are not passing evidence. Contract Hardening is required because Level 3 explicitly includes static/security analysis; its work is distinct from the canonical Solidity full-inventory owner.

## Security and economic invariants

The final candidate must preserve:

- compute rewards remain application-layer and do not replace consensus rewards;
- CMP-6.1 funding is separately supplied and canonically deposited;
- CMP-6.2 requires canonical live verification;
- CMP-6.3 contribution evidence is policy/source pinned and replay safe;
- CMP-6.4 freezes exact project and metric policy;
- CMP-6.5 sponsor matching cannot exceed prefunded sponsor capacity;
- CMP-6.6 principal/epoch/count/amount/cooldown controls fail closed;
- CMP-6.7 one contribution cannot be rewarded twice;
- CMP-6.7 pool accounting cannot exceed observable pool funding;
- no CMP-6 contract mints native $420 or replaces consensus;
- CMP-6.7 remains accounting-only and does not silently create Vault payout authority.

## Client/service applicability

CMP-6 introduces no direct implementation changes to:

- `@420/compute-sdk` — CMP-7.1;
- job/worker/verifier/research APIs — CMP-7.2 through CMP-7.5;
- Compute indexer — CMP-7.6;
- CLI — CMP-7.9;
- human-facing 420Compute application — CMP-8.

Those suites are non-applicable to CMP-6 Level 3 unless the merge candidate changes their implementation surfaces.

## Deployment/config verification

Level 3 must verify:

- no unauthorized Genesis/frozen-address claim is introduced;
- no deployment manifest/predeploy authority drifts;
- CMP-6 contracts/config are repository-consistent;
- repository qualification is not misrepresented as live/testnet deployment;
- transparent reward accounting is not misrepresented as an executed payout.

## Repository qualification versus live payout

CMP-6.8 closes the **repository phase**.

Still external/live/testnet work:

- deployment/publication of CMP-6 components;
- funded end-to-end reward distribution using canonical Vault settlement authority;
- operational sponsor/research program onboarding;
- real workload demonstrations and live economic telemetry;
- SDK/API/CLI/indexer integration in CMP-7;
- human-facing participation/earnings experience in CMP-8.

## Exit criteria

CMP-6.8 is COMPLETE only when all required Level-3 owners pass on one exact merge-candidate SHA, the candidate is reconciled to the recorded current-main baseline, durable evidence records those run results, and no required gate is missing or substituted.

## Next canonical phase

**CMP-7 — SDK, API, CLI and indexer**
