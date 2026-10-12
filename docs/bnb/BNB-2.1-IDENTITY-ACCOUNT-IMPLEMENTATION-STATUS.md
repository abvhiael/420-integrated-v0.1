# BNB-2.1 — Identity and Account Management Qualification

**Status: PARTIAL — NOT FULLY QUALIFIED.** Existing Phase 1 runtime PR #600 branch `audit/420bnb-bnb-1-1-source-reconciliation-20261009`. Implementation must not claim fully verified 420Identity/420Verify behavior from an isolated token test.

## Implemented
- `services/420bnb/identity.py`: configurable issuer/audience/public-key pinned RS256 JWT verification with mandatory sub, issuer, audience, expiry, nbf, issued-at and jti; short maximum lifetime; ignores self-asserted role, admin and verified flags; missing provider configuration fails closed.
- `services/420bnb/migrations/002_identity_access.sql`: account state, revocable external-source-bound sessions, property-grant scope and expiry with restricted capability enum. No self-provisioned financial permissions.
- `services/420bnb/api.py`: authenticated token-to-session exchange, ownership-scoped revocation, non-mutating per-property access check requiring active session and live scoped grant, no fund control.
- `services/420bnb/tests/test_identity.py`: issuer/audience/time/role spoofing and unconfigured-provider negatives. Existing runtime PostgreSQL suite and Docker readiness still required.

## Unresolved blockers
1. 420Identity's real issuer public keys, rotation, discovery, session revocation and authentic proof verification are not bound to a qualified network/provider deployment. Configured JWT key is an adapter, not an implementation of the 420Identity protocol.
2. 420Verify independent property-control and host/business/licensing attestations are not implemented or qualified; no verified host account or automatic publish permissions can be granted.
3. Account recovery requires independent 420Identity proof and active-session invalidation; there is no local password reset, credential custody or invented fallback.
4. Session issuance does not create a browser session cookie; CSRF, trusted first-party client login, session rotation, ingress isolation, and permission enforcement across the entire BnB API have not been accepted. The legacy signed ingress adapter remains separately gated and must not be publicly exposed.
5. Property scoped access is read-only; real host, delegate, moderator and guest role enforcement on every mutation, grant issuance/revocation provenance, tenant isolation, and IDOR/race tests require additional implementation.
6. No production-equivalent multi-instance Identity/Verify integration acceptance; do not enable booking or 420Pay through this slice.

**Level 1:** exact implementation SHA runtime CI + focused signed-proof negatives and PostgreSQL migration must pass. **Level 2:** M1 after BNB-2.5, only when executable integration converges. **Level 3:** BNB-2.15 and BNB-1.10 outstanding release gate; canonical Solidity once, Genesis no duplicate full Foundry.

**Next canonical step (once BNB-2.1 is closed): BNB-2.2 — Host and Property Management.**

## Repository-side Level 1 closeout (2026-10-10)

Scoped repository checks passed against implementation SHA `6186c6008a9960271d822c886af11e41dad95a1e`, runtime Actions run [38069293767](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38069293767), and all nine BNB-1 architecture workflows. Exact-SHA retained evidence is in `docs/bnb/qualification/BNB-2.1-LEVEL1-REPOSITORY-CLOSEOUT.json`. This is a **repository-side Level 1 PASS**, not full BNB-2.1 acceptance. The official Identity deployment, managed issuer rotation and live revocation, approved independent property issuer and multi-instance live acceptance remain blocked and are transferred to `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. Synthetic JWT tests and local PostgreSQL are not substitute evidence. Payment and property publication remain unavailable. Evidence-only commits inherit the qualified implementation SHA; do not mislabel this documentation SHA as a newly tested implementation or perform redundant global Level 3 work.
