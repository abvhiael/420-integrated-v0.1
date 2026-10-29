# Universal CI qualification isolation policy

Status: implemented reusable Foundry workflow; broader-workflow migration is opt-in and requires a per-workflow evidence audit.

## Why
Repeated GitHub-hosted runner cancellations (exit 143 or an explicit cancellation) during long sequential compilations must not require successful unrelated suites to rerun. A successful test suite is historical evidence only for the exact commit, configuration and scope on which it ran. Workflow success with a required test job skipped is not a full qualification certificate.

## Required policy for every qualification workflow

1. Divide distinct independently certifiable suites into **separate jobs**, each bound to the same explicit PR head SHA, instead of concatenating four expensive tests into one long-lived job. A failing or cancelled job must not erase passing sibling results.
2. Disable fail-fast on matrices requiring all elements; keep every mandatory item in the coverage inventory. Failure/cancellation of one suite is *not* equivalent to passing the entire workflow.
3. Re-run only a demonstrated failing/cancelled job at its same SHA, not all passing jobs. If source/workflow changes, qualify affected scopes on the new SHA; preserve prior passing results as historical evidence, not a substitute for new required checks.
4. Use precise path filters and conservative classifiers to avoid unrelated full-repository tests for test-only/doc-only changes. Mixed source changes and genuine phase-closeout Level 3 retain the complete inventory and existing coverage assertions.
5. Preserve per-job exit status, test totals, suite name, SHA, run ID and diagnostic logs. Never convert `cancelled` or `skipped` into `success` for a required scope.
6. Concurrency cancellation must be reviewed if unrelated jobs share a group. Do not globally disable cancellation or blindly extend timeouts without demonstrating its root cause.
7. Do not let test fixtures silently replace real production/economic/cryptographic authorization, or claim a mock fixture proves official network deployment.

## Reusable implementation

Use `.github/workflows/reusable-scoped-foundry.yml` as a **workflow_call** within Foundry milestones, with stable job names, `suite_name` and exact `match_path` inputs. It checks out and verifies the PR head, pins Foundry 1.8.6 and runs only the supplied test path. The calling workflow owns its trigger and its phase exit-criteria gate. Other runtimes (Node.js, PostgreSQL, HTTP, Go, browser, cloud) should apply the **same independent-job policy**, but require their own toolchain/database setup and must not be falsely routed through a Foundry-only runner.

BET-AUDIT-5D.9 example: `420bet-sports-5d9-level2.yml` now calls three isolated Foundry jobs (real OracleRouter funded, event lifecycle, signed odds). `420bet-sports-5d9.yml` remains the separate authoritative adversarial owner; both exact-head workflows are required for full scoped qualification. A separate Level 3 inventory, if applicable, remains mandatory at final phase closeout.

## Rollout constraint

Do not rewrite legacy unrelated workflows en masse. Migrate each when actually touched: identify its test inventory, external dependencies, scoped qualifier and security invariants; separate jobs; verify SHA and passing evidence; retain full Level 3 only when expressly required. This policy is repository-wide, but no claim is made that every existing workflow has been migrated.
