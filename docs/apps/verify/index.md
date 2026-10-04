---
title: 420 Verify
audience: [user, developer, auditor]
category: application
status: development
version: genesis
doc_release: genesis
doc_environment: genesis
publication_status: current
---
# 420 Verify

420 Verify reproduces deployed contract bytecode from published source and exact build settings. It answers whether source/build inputs correspond to deployed code; it does **not** certify that the code is secure, audited, endorsed, immutable or authorized.

Verification is bound to network, address and deployed runtime code hash.

## Status

The original GEN-10.5 / VERIFY-0 through VERIFY-10 implementation was historically merged through PR #303. The current repository-grounded VERIFY-AUDIT remediation is active in PR #503 and supersedes old blanket completion claims where current repository evidence differs.

VERIFY-AUDIT-6 passed the dedicated exact-head Level 1 workflow at `868095783962370149e685f6145c0163b84ba5e8`. Current audit-phase closeout is pending VERIFY-AUDIT-8. Public backend/frontend deployment also remains pending until real testnet endpoints are provisioned, live-qualified, and recorded in `testnet/public-services/verify/readiness.json`.

## Core documentation

- [Getting started](getting-started.md) — how verification is submitted, looked up, and interpreted.
- [User guide](user-guide.md) — result classes, history, evidence, and proxy behavior.
- [Architecture](architecture.md) — trust boundary, canonical inputs, compiler worker, evidence store, API, and integrations.
- [Security](security.md) — adversarial limits, secret rejection, fail-closed behavior, and non-authority guarantees.
- [Deployment and operations](deployment.md) — exact runtime configuration, compiler catalogue, persistence, readiness, monitoring, recovery, proxy-currentness limitations, and public activation checklist.
- [Permissions](permissions.md) — what Verify can and cannot authorize.
- [Troubleshooting](troubleshooting.md) — common mismatch, unavailable-evidence, and deployment issues.
- [FAQ](faq.md) — verification meaning and common questions.
- [Fees](fees.md) — protocol-fee boundary.

## Implementation references

- [VERIFY-5 bytecode comparison and classification](verify-5-bytecode-classification.md) — `FULL_MATCH`, `PARTIAL_MATCH`, `MISMATCH`, and `UNVERIFIABLE` plus exact runtime/creation diagnostics.
- [VERIFY-6 reproducible evidence store and history](verify-6-evidence-store.md) — append-only evidence history, restart reconstruction, content-hash validation, and non-canonical storage.
- [VERIFY-7 proxies and upgrades](verify-7-proxies-upgrades.md) — proxy relationship resolution, separate proxy/implementation verification, upgrade history, and stale-status invalidation.
- [VERIFY-8 public API and Genesis integrations](verify-8-public-api-integrations.md) — lookup/submission/evidence endpoints plus Explorer, Registry, and AppStore boundaries.
- [VERIFY-9 adversarial hardening and failure recovery](verify-9-adversarial-hardening.md) — hostile-input limits, secret rejection, compiler-abuse controls, degraded dependencies, restart/tamper recovery, and authority-preserving failure modes.
- [VERIFY-10 qualification, reconciliation and closeout](verify-10-closeout.md) — final exact-head qualification, latest-main reconciliation, deployment-readiness boundaries, and GEN-10.6 handoff.

For the complete Genesis implementation summary, see [`docs/420VERIFY.md`](../../420VERIFY.md) and [`docs/420VERIFY-ROADMAP.md`](../../420VERIFY-ROADMAP.md).

## Audit references

- [Active VERIFY-AUDIT roadmap](../../audit/420VERIFY-AUDIT.md) — current audit status and canonical remediation steps.
