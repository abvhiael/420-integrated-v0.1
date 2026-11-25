# BC-4.2-R8 — Qualification failure reconciliation

Baseline: main at 66cb858f9ed3f4b190d4e3d6b9fb1fa5e5e8b0e4.
Disposition authorized by project owner on 2026-11-25.

| Failure | Disposition | Evidence |
| --- | --- | --- |
| Authoritative expiration returned dependency unavailable | Resolved in R1/R2; do not reopen | PR #1414, dedicated run 45685948426, subsequent R6 timeout races and R7 run 45708123023 |
| Obsolete Word Salad catalogue wording | Resolved in R3 | PR #1414; web verification run 45685948478 |
| Historical Chess browser recovery timeout waiting for Last move: e5 | Explicitly deferred to existing Chess work; no baseline reproduction required for R8 | Subsequent Chess runs 45708122937, 45708123060 and 45708122898 succeeded. Historical cause and independence were not established; deferral is an owner decision, not a causal finding. |
| Public website HTTP 502 / social API health endpoint unavailable | Deferred under existing website-outage exemption | Public target preflight run 45685948509 |

## Qualification evidence

- R1–R3 qualified head: 8fab41cb69ebee51b7e0f581e6e6d32b9292b6fe.
- R7 qualified head: 7c8c9f172124940e962091a27a97b7b7e5f6023e; all ten reported workflows passed, including 20 named Word Salad tests.
- R7 merged via PR #1422 at the baseline commit above.
- Public Play remains gated. No production deployment or live health recovery is asserted.
- This reconciliation does not change game logic, test assertions, CI gating or deployment configuration.
- R8 dispositions are complete under the revised owner-approved scope; R9 remains separate.

Run links: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45685948426
https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45685948478
https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45708123023
https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45685948509
