# DoobTube — baseline qualification evidence

Roadmap step: **DOOBTUBE-0 baseline / pre-architecture audit**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Scope

This qualification covers only the repository-grounded naming/audit baseline. It does **not** qualify a DoobTube runtime, contracts, frontend, backend, API, deployment, testnet release, Genesis release, or production release.

The exact-head CI workflow:

- checks out the PR head explicitly;
- asserts `git rev-parse HEAD == github.event.pull_request.head.sha`;
- runs `scripts/verify-doobtube-baseline.py`;
- verifies the name/audit/roadmap records;
- verifies the canonical 420Media service remains `420/service/media/v1` named `420Media`;
- verifies DoobTube/420Video has not been silently added to the frozen Genesis application catalog;
- verifies no DoobTube runtime or contract namespace is introduced before the architecture gate;
- rejects false deployed/testnet/Genesis/production readiness claims.

## Initial qualification

Initial pre-evidence PR head:

`1d051a0eaa7ee408d11a920fcf263363963049c7`

Workflow: **DoobTube baseline audit**
Run: **37554811033**
Job: **baseline / 112578492241**
Result: **PASS**

All steps, including **Assert exact implementation SHA** and **Verify DoobTube audit baseline**, passed.

## Final-head rule

Because this evidence file is itself a repository change, the initial run above is historical evidence only. It must **not** be used as exact-final-head evidence for the later evidence commit.

The final qualified head is therefore the PR head validated by the latest successful **DoobTube baseline audit** run after this file is committed. The workflow's exact-SHA assertion is authoritative for that final head.

## Readiness boundary

This baseline establishes:

- application name: **DoobTube**;
- repository absence of a pre-existing 420Video/DoobTube implementation;
- non-equivalence to 420Media;
- stable DOOBTUBE-0 through DOOBTUBE-13 remediation numbering.

It does not change the readiness findings in `docs/DOOBTUBE-AUDIT.md`: all runtime/release readiness states remain **NO**.
