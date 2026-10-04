# 420Verify repository audit and remediation

This file is the durable roadmap for the repository-grounded 420Verify audit performed on branch `audit/420verify-20261003` / PR #503.

Repository truth is authoritative. Historical GEN-10.5 / VERIFY-0 through VERIFY-10 closeout records are retained as history, but their implementation-complete claims are superseded where this audit found contradictory current-repository evidence.

## Qualification model

Ordinary VERIFY-AUDIT steps use app-specific Level 1 qualification. Level 2 is reserved for meaningful Verify integration milestones. Level 3 is reserved for the complete app-audit closeout after reconciliation with current `main`.

## Roadmap

1. **VERIFY-AUDIT-1 — canonical scope & repository inventory** — establish authoritative requirements, files, dependencies, deployment model, branch/PR state and historical claims.
2. **VERIFY-AUDIT-2 — verification pipeline correctness** — wire the real processor, deterministic compiler target selection, and exact build-setting reproduction.
3. **VERIFY-AUDIT-3 — evidence, proxy & replay integrity** — validate chain/evidence binding, code hashes, creation evidence, persisted replay integrity, proxy evidence and freshness semantics.
4. **VERIFY-AUDIT-4 — API/frontend/application completeness** — qualify public API, embedded user-facing views and ecosystem-consumer boundaries.
5. **VERIFY-AUDIT-5 — security hardening** — hostile inputs, compiler isolation, RPC/reorg assumptions, resource limits, malformed outputs, authority boundaries and failure modes.
6. **VERIFY-AUDIT-6 — build/test/CI qualification** — app-specific exact-head formatting, tests, vet, build and CI qualification.
7. **VERIFY-AUDIT-7 — documentation/deployment readiness** — align documentation with audited behavior; document operator configuration, compiler catalogue, persistence, monitoring, recovery, proxy-currentness semantics and testnet/public activation; preserve honest deployment readiness state.
8. **VERIFY-AUDIT-8 — durable closeout** — final requirement matrix, reconciliation with current `main`, Level 3 exact merge-candidate qualification, durable evidence and formal readiness state.

## Current status

- VERIFY-AUDIT-1 through VERIFY-AUDIT-6: remediation implemented; VERIFY-AUDIT-6 app-specific qualification passed on implementation SHA `868095783962370149e685f6145c0163b84ba5e8`, workflow run `37175301638`, job `111356576146`.
- VERIFY-AUDIT-7: in progress until its exact implementation SHA passes the dedicated Level 1 workflow and durable evidence is recorded.
- VERIFY-AUDIT-8: not started.
- Public testnet deployment: pending; no backend/frontend URL is claimed.
- Level 3 reconciliation and repository-wide closeout: intentionally deferred to VERIFY-AUDIT-8.

## Known deployment limitation retained for closeout

Persisted proxy relationship evidence records historical canonical observations. The production entrypoint does not currently run the in-memory proxy tracker continuously. Downstream presentation must revalidate canonical proxy state before describing a persisted implementation relationship as current. Testnet operational monitoring may add continuous detection later; historical evidence must never be silently promoted into current authority.
