# BNB-5.14 — Level 3 discovery and preflight (BLOCKED, NOT QUALIFIED)

Date: 2026-10-15. This document is a repository-state checkpoint, **not** a preflight PASS or Level 3 certificate.

## Verified repository inputs
- Repo: `abvhiael/420-integrated-v0.1`.
- PR #644: draft, open, unmerged.
- Original Phase 5 audit HEAD at inspection: `7b66c2956930aeefdaee80437a5b8f4c335111f9` (BNB-5.13 certificate, evidence-only).
- Last Level 2 executable: `c76311bd5e7ea0201d0a7354bd272ae380eaeed6`.
- Current `main` at initial discovery: `728fd12e1b1c936b04354fa0746c05140dcc4098`.
- Merge base / PR base: `3f2cf64897e96c4f16213bcaf93564db72a174c9`.
- GitHub comparison: audit branch **107 commits ahead, 578 behind** `main`; therefore it cannot be qualified as a final reconciled merge tree.
- GitHub's commit-compare changed-file list for the 578-commit `main` interval was limited to 300 returned entries; an apparently empty overlap in the returned subset is **not** proof of no conflicts.
- Main's current `.github/workflows/bnb-runtime.yml` still asserts 26 migrations; the Phase 5 audit workflow asserts 30. Reconciliation must preserve the qualified 30-migration app behavior.

## Canonical Level 3 owners and observed workflow availability
- `.github/workflows/contracts-foundry.yml` — Solidity Contracts; `workflow_dispatch` declared.
- `.github/workflows/genesis-address-authority.yml` — Genesis Address Authority; `workflow_dispatch` declared; independent authority (not full Foundry).
- `.github/workflows/qualification.yml` — 420 Integrated Qualification; `workflow_dispatch` declared.
- `.github/workflows/docs-qualify.yml` — 420Docs Qualification; requires confirmation of exact dispatch/job behavior.
- `.github/workflows/bnb-runtime.yml` — retained BnB Runtime Slice; `workflow_dispatch` declared.
- Nine retained BnB guardrails must be preserved under the final candidate.
- Workflow declaration is **not** proof of successful workflow registration, exact-SHA checkout, active secrets or job availability.
- Available connected GitHub tools in this session provide read, commit, tree and selected rerun actions, but no general new-workflow dispatch action; do not claim workflows were launched.

## Preflight blockers
1. **Main reconciliation incomplete.** Resolve the 578-main-commit divergence into a dedicated candidate with current `main` and all Phase 5 changes, retaining qualification inputs and resolving actual overlaps. Do not overlay an incomplete 300-file GitHub comparison.
2. **Freeze manifests unverified.** Enumerate the actual authoritative freeze manifest(s), compute and check **all** declared hashes against the fully reconciled candidate, including workflow/policy/evaluator/dependency/config inputs. No freeze PASS is currently asserted.
3. **Workflow/job readiness unverified.** Confirm exact dispatchability and mandatory jobs for Solidity (coverage, sharded Foundry, aggregate fixture), Genesis, Integrated (production dependencies), Docs, retained BnB and any affected surfaces. Confirm required PostgreSQL/service bindings and expected runner concurrency.
4. **No final executable candidate SHA.** Current audit HEAD and last Level 2 executable cannot be substituted for a main-reconciled Level 3 tree.
5. **No final Level 3 run evidence or merge approval.** Do not run expensive workflows before the above are corrected; do not create a Level 3 PASS certificate or merge.

## Qualification discipline and unresolved acceptance
- Preserve `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`.
- Level 2 `BNB-5.13-LEVEL2-CERTIFICATE.md` remains prior exact-SHA app evidence, not a substitute for Level 3.
- Genuine external Identity/operator, live Search/Travel and Pay/Wallet, multi-host recovery, accessibility assistive technology and legal/compliance acceptance remain separately recorded in `BNB-TESTNET-WORK-ROADMAP.md`.
- **BNB-5.14 status: BLOCKED AT PREFLIGHT; no expensive Level 3 qualification dispatched.** PR #644 must remain draft/unmerged until all original exit criteria and approvals are satisfied.

## Update — actual main reconciliation completed (2026-10-15)

- Latest observed `main` before reconciliation: `d3310d153e7ccc71f5ded95639aadfd7a6f6e682`, tree `ad25baf1b213f10c47870e88a2a5f876f9610bb8`.
- Phase 5 source/evidence HEAD: `9f7ef20036ab6597e0d61137bc659c20fc09e46d`, tree `c88aa4f85ce7ead8107a1eca3da710de818bc52b`.
- Used **complete, non-truncated recursive Git trees** for the merge base (tree `6f5acc71cf3f54dec3b1378232d88c669c25dd96`), current main and audit. Verified **71 BnB Phase 5 changed blob paths**, **zero path-level concurrent modifications**, no deleted Phase 5 files, and verified `main` unchanged immediately before composing.
- Created merged Git tree `db6323822abe4798b2352c984da60aac3a47be67` by applying exactly these 71 Phase 5 blobs onto main's complete tree. Commit `7bed67de5833778a070b60e8d87aafc637a75a05` has both Phase 5 and main parents.
- Updated Phase 5 audit branch by expected-SHA fast-forward. GitHub verified PR #644 **draft, open, unmerged**, merge-base now `d3310d153e7ccc71f5ded95639aadfd7a6f6e682`, **zero commits behind main**, 109 commits ahead.
- **Candidate SHA: `7bed67de5833778a070b60e8d87aafc637a75a05`**. This is a reconciled **unqualified** implementation. The reconciliation preserves all 71 Phase 5 blob identities and the complete main tree outside those paths.

## Workflow readiness findings and still-open hard gates

- Solidity `.github/workflows/contracts-foundry.yml`: declared `workflow_dispatch`; canonical `level3-shards` and `level3-fixture` including coverage. A default audit-branch PR does not automatically engage its canonical Level 3 jobs.
- Genesis `.github/workflows/genesis-address-authority.yml`: declared `workflow_dispatch`, `cross-manifest-authority` job. Audit branch PR is excluded by its PR job condition; explicit dispatch needed.
- Integrated `.github/workflows/qualification.yml`: declared `workflow_dispatch`, `offline-core`, `production-dependencies`, `geth-engine`, `fault-matrix` jobs. Audit branch PR excluded by current job conditions; explicit dispatch needed.
- Docs `.github/workflows/docs-qualify.yml`: declared `workflow_dispatch`, `qualify` job. Audit branch PR job skipped; cannot count as a PASS.
- BnB `.github/workflows/bnb-runtime.yml`: declared `workflow_dispatch`, `runtime` job; retained nine BnB guardrails auto-triggered and passed on reconciled SHA; Runtime Slice run [#38830494034](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38830494034) auto-triggered (status must be inspected separately).
- Available GitHub connector operations in this session permit Git object/ref writing and reading Actions results but expose **no general workflow dispatch** endpoint. No Level 3 workflow dispatch is claimed.
- Canonical BNB-5.14-specific freeze inventory/digest verification is **not yet complete**; full SHA-256 manifest verification has not been represented as a PASS. Do not launch global Level 3 until this requirement is met and all mandatory trigger/dependency checks are established.

**Reconciliation complete; Level 3 preflight remains BLOCKED. Do not issue a final Level 3 certificate or merge until every required workflow completes successfully against the final candidate.**
