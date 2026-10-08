# CMP-8 — 420Compute application qualification evidence

Status: **COMPLETE — repository Level 1 + Level 2 + Level 3 qualified.** This is **not** live/testnet deployment evidence.

## Exact qualification identity

- Implementation / accumulated merge-candidate SHA: `1889713a30ebee9afbdfc21b151d7c69789c1e09`
- Qualification branch: `cmp-8-420compute-application-20261008`
- Current-main reconciliation base: `0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`
- Reconciliation merge anchor: `f8970cc02d5d780471c04bab955d396032eeee74`
- Comparison with main at verification: ahead 72, behind 0; PR #570 open and GitHub reports mergeable.
- Evidence-only SHA: the commit adding this file and updating roadmap/spec/PR. The qualifying implementation SHA above remains fixed.
- Canonical roadmap step: CMP-8 (one phase step, no synthetic CMP-8.x substeps).
- Level 1: affected app web, Indexer projection, Compute API, SDK and worker regressions.
- Level 2: complete human participation loop, proven by the app workflow integration job.
- Level 3: one exact accumulated SHA, canonical owning workflows only.

## Exact-SHA GitHub Actions qualification

All runs below report `head_sha=1889713a30ebee9afbdfc21b151d7c69789c1e09`, event `pull_request`, conclusion `success`.

| Owner / run | Exact job evidence |
| --- | --- |
| Solidity Contracts — [37806826398](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826398) | PR shards (0) `113414110072`; (1) `113414110116`; (2) `113414110303`; (3) `113414109962`, all success; non-sharded `foundry` skipped by canonical PR sharding |
| Genesis Address Authority — [37806826400](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826400) | cross-manifest-authority `113413184952` success; no second full Foundry inventory |
| 420 Integrated Qualification — [37806826401](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826401) | geth-engine `113413189906`, fault-matrix `113413190310`, production-dependencies `113413190408`, offline-core `113413190490`, all success |
| 420Docs Qualification — [37806826470](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826470) | qualify `113413179954` success |
| Compute Market Qualification — [37806826504](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826504) | fast-qualification `113413534378` success |
| 420Compute App Qualification — [37806826361](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826361) | web `113413187947`, indexer `113413188315`, worker `113413188566`, api `113413188835`, integration `113414976975`, all success |
| 420Indexer direct — [37806826256](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826256) | test `113413178884` success |
| 420Indexer shared — [37806826388](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826388) | qualify `113413181189` success |
| 420 Genesis Contract Hardening — [37806826365](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806826365) | hardening `113413457309` success |

Additional same-SHA successes: Compute Worker Fast Qualification `37806826204` and Compute Developer Surfaces `37806826476`.

## Affected implementation and retained protection

- `compute/web`: dashboard, job submission, local resource/project preferences, wallet handoffs, read-model client, worker onboarding, tests, config/build.
- `420-indexer`: bounded chain-scoped application read projections, HTTP routes, signed `int256` reputation decoding, reference-only stake and contribution views.
- Existing Compute API/SDK and worker daemon are reused; no browser-owned signing or custody.
- Fail-closed runtime blocks unresolved canonical endpoints and write actions.
- Indexed results remain `authoritative:false`; no synthetic stake balances, scheduler/project authorization, worker telemetry or live deployment claims.
- App/Indexer/worker/API exact-SHA regression suites and global hardening owners passed. Do not treat test success as real-network execution evidence.

## Separate unrelated workflow result

Push-triggered `governance-deployment-audit.yml` run [37806809841](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37806809841) returned `failure` on the same SHA, but the GitHub jobs endpoint returned zero jobs. No failed executable job/step can be classified from these records; this run is **not** one of the nine canonical CMP-8 Level-3 owners and is not recorded as a pass. Investigate workflow parsing/trigger metadata separately if required by PR policy. No rerun or application-code modification was performed to disguise it.

## Deferred live work / next phase

CMP-9 owns public-testnet addresses/endpoints, signed worker packages, real worker fleet, funded jobs, matching, execution, verification, reward/refund/dispute and live evidence. CMP-8 completion establishes repository qualification only.

PR #570 remains open. **Do not merge without explicit user authorization.**
