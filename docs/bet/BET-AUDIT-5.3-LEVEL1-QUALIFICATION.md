# BET-AUDIT-5.3 — Level 1 Qualification Certificate

**Disposition:** PASS — scoped executable qualification at frozen implementation SHA; independent deployment/economic approvals are NOT claimed.

- **Repository:** `abvhiael/420-integrated-v0.1`
- **Implementation SHA:** `81e91dba80e06e311a45ab9a5523c654bd3b87b3`
- **Workflow:** `420Bet Video Poker Secure Draw and Economics Level 1`
- **GitHub Actions run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39081895575
- **Result:** completed / success, inspected job logs.
- **Solidity scoped tests:** 45 PASS, 0 FAIL, five suites (5 economics, 7 foundation, 9 deck, 22 secure draw, 2 funded settlement/expiry).
- **Stand-pat analytic universe:** 2,598,960 hands, PASS (not the optimal RTP).
- **Full optimal-strategy verification:** exact 2,598,960 initial deals × 32 possible holds, PASS.
- **One–four-credit optimal gross RTP:** `35523565111/36110924850` (exact).
- **Five-credit optimal gross RTP:** `1653526326983/1661102543100` (exact).
- **Verifier output SHA-256:** `afce1363d6a0b1f84da7294d3840705e64819433e07f59011b9cc2e3fa428d8e`.

## Qualification inheritance

This certificate is evidence-only: the implementation tested at the SHA above remains the qualified executable input. A subsequent documentation-only certificate commit does not replace the tested SHA or require retesting. Any new executable/relevant config changes, or altered input through reconciliation, require direct impact assessment and appropriate scoped requalification.

## Explicit exclusions

No independent replacement provider identity, key-custody or non-collusion approval; no live official-testnet proof; no independently authorized economics/risk/legal release approval; no production wagering activation. Those external gates remain in `docs/420BET-TESTNET-WORK-ROADMAP.md`.

Phase 5 Level 2 and Level 3 are not asserted by this certificate.
