# R04 Level 3 — corrected-SHA qualification snapshot

**Corrections verified; full Level 3 PENDING.** No final phase certification or merge is asserted.

Exact implementation: `f7a3da6f96b62d018f69aa5e98d3819b5ad32706`; tree `35e70a63f1d532df06faaf3d274b7193cc37249c`. [Draft PR #634](https://github.com/abvhiael/420-integrated-v0.1/pull/634) remains open/unmerged. Current main re-read as `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`; candidate has zero commits behind main. This documentation-only descendant does not change the executed candidate.

## Corrected failures

- Removed only excess EOF blank lines in the eight files reported by prior run 38445112954. No executable statements changed. The corrected security job now passes both `git diff --check` and the clean-checkout assertion.
- Governance startup failed because its Python heredoc was outside the YAML literal block. The script body/delimiter are now correctly indented in YAML while remaining valid shell/Python input.
- 420Hz startup failed because a corrupt duplicated Level 2 section included stray shell text and duplicate job keys. Removed that corrupt duplicate; preserved complete original Level 1 and final Level 2 job contents. No application tests are removed.
- All 34 affected workflows pass unique-key YAML, every embedded shell syntax check and actionlint 1.7.7. Ordinary HC step/prior-milestone jobs are not redundantly repeated for this Level 3 branch; all complete tests remain owned by canonical Solidity and the retained app gate. Other step branches/manual dispatch retain their original job behavior.

## Corrected exact-SHA CI

| Gate | Run / job | Snapshot |
|---|---|---|
| Security/client/configuration | [115485838686](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248369/job/115485838686) | PASS: formatting, static lint, 106 client/shared-service tests, configuration template, runtime/test syntax, patch whitespace and clean checkout |
| Economic service | [115485838401](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248369/job/115485838401) | PASS |
| Actual PostgreSQL | [115485838471](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248369/job/115485838471) | PASS |
| Actual local-chain authenticated runtime | [115485838090](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248369/job/115485838090) | PASS |
| Retained HC Foundry/verifier | [38452248369](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248369) | PENDING: build/size passed; retained tests executing |
| Genesis address/manifests | [38452248754](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248754) | PASS |
| Canonical Docs | [38452248197](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248197) | PASS |
| Global qualification | [38452247946](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452247946) | PENDING: offline core, dependencies and fault/soak PASS; pinned Geth/engine executing |
| Canonical full Solidity | [38452248238](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248238) | PENDING: four full CI shards executing; mandatory coverage/inventory/fixture must finish |
| Repaired 420Hz workflow | [38452248264](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248264) | Registered and completed SUCCESS; Level 1 steps run; Level 2 milestone detector is false, so milestone-specific steps are legitimately skipped (no new HZ Level 2 certificate claimed) |
| Repaired Governance workflow | [38452248007](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38452248007) | Registered correctly; Governance-only PR guard legitimately skips the job on an HC PR (not a Governance runtime PASS claim) |

No corrected-SHA failed workflow was observed at this snapshot. This is not a final PASS: pending required steps and coverage/fixture artifacts must be inspected. Historical evidence on `b5d183c06421a096cc568dc3a687b1f300f748cc` is preserved and cannot certify this changed SHA.

[Machine-readable job/step evidence](R04-LEVEL3-CORRECTED-SHA-QUALIFICATION.json) records what actually executed. Keep all R04 development PRs and #627 open/unmerged. R05 is not started. Live/testnet/operator/security and R07.5 replacement/migration/rollback acceptance remain OPEN under the [canonical testnet roadmap](../HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md).
