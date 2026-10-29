# CI-GUARD-02 — Explicit expensive-qualification dispatch

Status: locally verifiable repository policy candidate. No claim of installed GitHub ruleset.

All eleven canonical full-phase/global workflows identified by the trigger audit are changed to **workflow_dispatch only**. Their `jobs:` sections remain byte-for-byte identical to the previous `main` base, including security/adversarial tests, job timeouts, coverage, fixtures, and retained integration checks. This prevents ordinary PRs and pushes from queuing expensive qualification automatically, but explicitly authorized phase closeouts still run using GitHub Actions **Run workflow**, provided the operator selects the intended branch.

## Trigger boundaries

Ordinary roadmap Level 1/2: only app-scoped tests and its policy guard may run. Full Solidity, Genesis address authority, Integrated, and retained app Level 3 are manual opt-in at the approved phase boundary. For a Phase 3 closeout, reconcile `main`, freeze the exact SHA, verify the canonical preflight manifest, then dispatch the applicable retained inventory once, recording the actual workflow run IDs and checked-out SHAs.

## Verifier

`python3 scripts/qualification-policy/verify-trigger-isolation.py <reconciliation-base-SHA>`

The verifier compares original and candidate jobs byte-for-byte; fails for implicit PR/push triggers or absent explicit dispatch. Unit tests intentionally reject losing a job, unexpected triggers, or losing dispatch. It is executed by the existing lightweight Universal Qualification Policy Guard for this scoped CI-GUARD-02 change; no heavy phase workflow is dispatched for this change.

## GitHub administrator hard enforcement

Still mandatory: protect `main` with required check **Universal Qualification Policy Guard / validate-policy**, disallow force pushes and bypass, and verify with a deliberately invalid PR that merge is actually blocked. The connected GitHub integration does not expose ruleset mutation, and branch-protection reads return HTTP 403; repository trigger changes cannot substitute for this permission. Until administrator activation, the check reports failure but GitHub might allow merges. Record the ruleset ID and failed-PR evidence in Issue #908 before declaring universal prevention complete.

## Legacy workflows

No tests, fixtures, data, or commands were removed. Direct `workflow_dispatch` is retained for authorized phase closeout. Other workflows not in the eleven critical inventories must be examined independently before claiming the entire historical CI catalog has no expensive automatic triggers.
