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
