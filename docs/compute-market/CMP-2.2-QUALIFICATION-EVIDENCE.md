# CMP-2.2 — Compute requests: durable Level 1 qualification

Status: **COMPLETE**
Qualified implementation SHA: `6738c1a5a5a38c40bd6482ab3338705d16dd4fe3`
Qualification date: 2026-10-03 UTC (2026-10-02 America/Regina)
Audit branch: `cmp-2.1-worker-offers-20261002`
PR: [#490](https://github.com/abvhiael/420-integrated-v0.1/pull/490)
Step base: `29aec4c53ed72e7b4152264189a804d2d53036c3` (CMP-2.1 documentation closeout)
PR/main common base: `c3fbda60247e76f26a7e183069dd6782ed0da038`
Current main observed: `b58b09a17e641a42b81d832bad913a83c7caada9`

Evidence commit is the documentation-only commit containing this file, reported by exact SHA in PR #490's description. It preserves the qualified implementation SHA above; it changes no executable source, tests, workflows, configuration, interfaces, dependencies or runtime artifacts.

## Canonical definition

> Express required resource class, runtime, verification, replication, privacy, deadline and maximum price.

Authority: [controlling roadmap](COMPUTE-MARKET-POST-CMP1-ROADMAP.md), [request specification](CMP-0.6-OFFERS-REQUESTS-AND-MATCHING.md), [step design](CMP-2.2-COMPUTE-REQUESTS.md) and frozen exit criteria in `contracts/config/compute-market/cmp-2.2-compute-requests.json`. The config's qualification-pending marker records implementation-time state; this durable evidence and the roadmap record final qualification status.

## Implementation and changed files

- `contracts/src/compute/ComputeRequestRegistry420.sol`: demand records anchored to existing requester AND payer signed authorization; explicit constraints, price bounds, direct/scoped delegated consent, immutable revisions, terminal cancellation/expiry and canonical commitment encoding.
- `contracts/src/compute/ComputeAuthorization420.sol`: distinct update/cancel request action IDs; existing scope and funding boundaries retained.
- `contracts/test/ComputeRequests420.t.sol`: ten focused behavioral and encoding tests.
- `packages/420-sdk/src/compute.ts`: typed request/policy/terms schema, boundary validation and independent static ABI encoding.
- `packages/420-sdk/test/compute-sdk.test.mjs` and `test/fixtures/compute-request-vector.json`: client adversarial checks and shared independent encoding vectors.
- `contracts/config/compute-market/cmp-2.2-compute-requests.json`: canonical scope, exit criteria, qualification boundaries and partial invariant mapping.
- `scripts/verify-cmp-2-2-compute-requests.py`: mechanical scope/schema/vector/workflow gate.
- `.github/workflows/compute-market.yml`: CMP-2.2 verifier included in exact-head app qualification.
- `.github/workflows/contracts-foundry.yml`: classification now retains full base history and propagates diff/merge-base errors before publishing a route.
- `docs/compute-market/CMP-2.2-COMPUTE-REQUESTS.md` and controlling roadmap: implementation boundaries and step status.

## Original exit criteria verified individually

| Frozen criterion | Evidence and result |
| --- | --- |
| Explicit resource/runtime/capability requirements | Canonical record test, malformed resource/runtime checks, typed SDK validation: PASS |
| Versioned verification/privacy/pricing/SLA commitments | PolicyRef record assertions, empty/zero policy rejection, SDK version/commitment checks: PASS |
| Bounded partition/replica/capacity plan | Positive counts, checked aggregate multiplication and overflow rejection with no ID allocation: PASS |
| Deadline/expiry/jurisdiction/data-access commitments | Signed deadline ceiling, invalid windows, zero jurisdiction, exclusive expiry boundary and explicit commitment schema: PASS |
| Aggregate native-$420 ceiling bounded by requester AND payer consent | Existing dual-signature authority anchor, payer identity snapshot, zero/excess price rejection, no revision budget increase: PASS |
| Direct consent or requester-approved exact-scope delegate | Exact creation Terms approval plus scoped capability; revision/action/amount-bounded update/cancel approval; outsider/wrong-scope/under-limit/stale delegation rejection: PASS |
| Single-use anchor, immutable history, terminal cancellation/expiry | Duplicate anchor and failed-call atomicity tests; predecessor/history reconstruction; cancellation after expiry; no resurrection/replay: PASS |
| Typed SDK and independent static ABI vectors | Solidity hash assertions agree with independently generated fixture and TypeScript ABI preimages: PASS |
| Negative/boundary/authorization/replay/overflow/failure paths | Ten focused tests plus retained signed-authority, capability, offer, accepted-price and entitlement regressions: PASS |
| Required Level 1 green on one exact SHA and durable evidence | Both required workflows below pass on `6738c1a5a5a38c40bd6482ab3338705d16dd4fe3`; this file and roadmap closeout preserve that head: PASS |

## Exact-head required CI evidence

| Workflow | Run | Job | Result |
| --- | --- | --- | --- |
| [Compute Market Qualification #175](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37080154323) | 37080154323 | fast-qualification 111078782833 | SUCCESS |
| [Solidity Contracts #4369](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37080154446) | 37080154446 | compute-fast 111078841579 | SUCCESS |

Each required job checked out and verified the exact implementation SHA before building/testing. Both retained Compute runs passed **448 tests in 68 suites, zero failed/skipped**, including ten CMP-2.2 tests. The app workflow passed all retained mechanical verifiers, the CMP-2.2 verifier, expected fail-closed live-readiness checks and the affected SDK build/tests (**23 passed, zero failed/skipped**).

The corrected Solidity classifier job 111078798967 produced the actual changed-file list without a missing merge base. `compute-fast` ran; `foundry` and `pr-shards` were intentionally skipped. These skips are routing evidence, not substitutes for required tests. No full repository Foundry inventory was requested as ordinary-step qualification.

## Additional applicable checks

- Local focused request suite: 10 passed; retained signed-request/authorization/offers/accepted-price/entitlement suite: 71 passed; no failures/skips.
- SDK TypeScript build and 23 tests: PASS.
- CMP-2.2 mechanical verifier and Python compilation: PASS.
- Diff whitespace checks: PASS.
- Request registry ABI exposes required create/update/cancel/expire/read/history/commitment functions and no payable entry point: PASS.
- Production runtime/initcode size checks from compiled output: 11,706 / 12,001 bytes, within EVM limits: PASS.
- Real full-history classifier scenarios: Compute-only selects fast, mixed shared-source selects full, missing merge base fails before route publication: PASS.
- Automatically triggered Indexer and Genesis Address Authority checks also passed; no unrelated workflow was rerun.

The first CMP-2.2 implementation head `23550185d01548c5952807c7a6ca21d957e07532` is superseded. Its Solidity scope job exposed the shallow-fetch/process-substitution defect. Only the corrected implementation head above is authoritative final evidence.

## Scope, milestone status and blockers

CMP-2.2 is **Level 1 COMPLETE**. Level 2 is deliberately deferred until **CMP-2.3 — Replaceable matching engine**, when offers/requests/matching converge. Level 3 full Solidity inventory, Genesis/global/Docs reconciliation, affected complete clients/services and comprehensive phase release/deployment checks remain deferred to **CMP-2.8 — Phase closeout**.

Requests advertise demand; they do not prove current policy eligibility, Vault custody, funded capacity, accepted matching or paid execution. Legacy JobRegistry admission stays intact. Market-to-job/match consumption and immutable accepted snapshots converge in CMP-2.3/CMP-2.5. No fixed Genesis address was added/reassigned, and no live deployment or publication is claimed.

No blocker remains within CMP-2.2's frozen exit criteria. Live deployment, funding/assignment and external qualification remain later-phase work.

420Docs #4586 (run 37080154309, job 111078676426) failed orphan-navigation for `docs/apps/pay/deployment-operations.md`. This is the retained unrelated 420Pay defect, not a Compute regression or required CMP-2.2 Level 1 gate. The failure is recorded truthfully and has not been counted as green.

Current main was four Wallet-only commits beyond the common base; no Compute shared dependency changed there. Main reconciliation is deferred to CMP-2.8. PR #490 remains open and unmerged.

Next canonical step: **CMP-2.3 — Replaceable matching engine**. No CMP-2.3 implementation is included in this closeout.
