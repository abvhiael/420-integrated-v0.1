# Universal Qualification Execution Policy — v1

This is a **repository-checkable contract**, not a declaration that CI path filters or branch-protection permissions have already been changed.

## Operational order
1. Retrieve canonical roadmap and original exit criteria; enumerate affected sources, dependencies, active PRs, affected tests, security and negative cases.
2. Implement all locally executable work and tests. Do not launch formal qualification while implementation remains incomplete.
3. Reconcile current `main`, audit automatic workflow triggers, freeze candidate, verify required inputs (SHA-256), fixtures, workflow ownership, and runner readiness.
4. Run only scoped Level 1 or Level 2 checks, or a separately authorized complete Level 3 phase closeout. Preserve independent passing evidence.
5. Diagnose actual failures before targeted correction. Evidence-only documentation changes must not invalidate unrelated implementation qualification.
6. Verify exact qualified implementation, mergeability, and the actual resulting `main` SHA before claiming merger.

## Executable checker
`python3 scripts/qualification-policy/preflight.py --manifest .qualification/preflight.json --base origin/main --head HEAD`

A candidate must supply an explicitly scoped manifest with all required fields (step, roadmap, level, base_sha, candidate_sha, classification, scope, tests, required_workflows, exit_criteria, frozen_inputs, external_gates). Use `candidate_sha: HEAD` to bind the runtime checked-out exact SHA; a literal recorded SHA is also accepted when externally supplied without a self-referential commit problem. `base_sha` must match the specified reconciliation base. For Level 3 the input digest mapping must be populated and checked fully. The checker refuses unclassified files, stale frozen input digests, missing roadmap or workflow references, and global qualification attached to Level 1/2.

## Protection deployment limitations
The workflow initially runs on policy and workflow changes and checks the manifest **when present**. It does **not** yet make every repository PR subject to qualification, nor can it stop GitHub from queuing other existing workflows before a job starts. GitHub branch protection / rulesets must make this check mandatory; those settings need administrator permission and coordinated migration of existing PRs. Heavy existing workflows must add a lightweight preflight job as a dependency, or adjust their path filters / triggers, to prevent premature expense. Do not describe this baseline as universal blocking until the complete workflow migration and required-check configuration have been verified.

## Rollout
A. Check this policy and its selftests (this PR).
B. Add a canonical signed or reviewed per-step preflight manifest and make the guard required for new work.
C. Inventory and harden existing expensive workflow triggers and dependencies without deleting test inventories.
D. Enable repository ruleset / required check after existing PR compatibility is addressed.
E. Record CI run IDs, exact SHAs, and actual required-check status in the evidence ledger.
