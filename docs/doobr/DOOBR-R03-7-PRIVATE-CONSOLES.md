# DOOBR R03.7 — Private operator, safety and compliance consoles

**Status: PARTIAL; exact-SHA qualification pending.** PR #601, `roadmap/doobr-bc-vancouver-infrastructure`. Main at recent inspection: `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`. Canonical milestone R03.12 Level 2; R05.10 Level 3.

## Implemented in current work
- Separate `OPERATOR`, `SAFETY`, `COMPLIANCE` action allowlists in `doobr/auth.py`. Role grants are still issued and revoked only by the external trusted identity authority.
- `doobr/storage/migrations/0007_private_console_cases.sql` defines durable tenant-scoped case and event tables, strict state/revision constraints, distinct requester/reviewer identities, unique proposal and event IDs, and forced row-level security; requires controlled migration application and database permissions review before use.
- `doobr/console_cases.py` provides authenticated operator proposal, purpose-specific safety/compliance approval by a different actor/principal/token, independent authority verification, atomic serializable compare-and-set revision updates and durable audit events. Execution confirmation requires independently attested COMPLETED effect. Never trigger a payment, regulatory override, delivery, or external effect inside the database transaction.
- `web/doobr-private/index.html` provides separate operator, safety, compliance and audit sections as an **offline preview**, no forms, no client data, no public deployment, no usable commands. It is intentionally not part of the public site static build.
- Tests `test_console_cases.py`, `test_private_console.py` and an exact-SHA Level 1 workflow check separation, stale/replayed revision, denied/missing external authority and unverified execution. The existing earlier `review_dual_control` remains a read-only legacy verifier using OPERATOR grants; it is **not an approval path** and must not be substituted for the durable service.

## Follow-up authenticated private API and authority boundary
- `doobr/private_api.py` now offers strictly allowlisted server-side case command dispatch requiring trusted ingress assertions for MFA, CSRF and origin verification and an authenticated token. This is not a running HTTP API: the trusted ingress must be implemented, tested and deployed before exposing these operations. Browser-supplied booleans are not valid transport attestations.
- `doobr/private_authority.py` provides an always-denying default and a server-injected verifier contract. No live signed-decision validator or external 420Compliance/420Identity credentials have been supplied or connected. Do not mistake injection of a positive fixture for live acceptance.
- `doobr/storage/tests/test_private_api.py` provides denial tests, and the R03.7 workflow includes these tests.

## Additional case lifecycle and integration work
- `close_case` adds explicit transactional REJECT and EXPIRE actions with locked compare-and-set revisions and append-only audit events. The strict private API command router exposes these operations only behind authenticated ingress checks.
- `web/doobr-private/client.mjs` and `index.html` provide a working same-origin private API client contract for proposals, approvals, execution verification and closing cases, with CSRF headers, no-cache and denial handling. This is NOT a deployed authenticated server, and the static preview is not live.
- The R03.7 qualification workflow runs a PostgreSQL 16 service, applies migration 0007 in an isolated schema and checks forced tenant RLS flags; this is a migration smoke test, not a production-equivalent full schema, grants, failover or restore qualification.
- CI browser-client contract and API denial tests are included. Do not interpret mocked decisions as live signed authority acceptance.

## Remaining prerequisites — no invented live authority
- Independently connected, deployed and verified 420Identity/Verify/Registry issuer and role grant/revocation feed; 420Compliance versioned policy and safety/incident authority with live credentials, TLS/mTLS, rotation, revocation and audit ownership.
- Actual private API with authenticated HTTP endpoints and operator, safety and compliance browser sessions; this offline preview cannot manipulate cases. Integrate frontend with trusted API only after its contract and security review, not through direct DB/browser access.
- Controlled migration chain validation against existing schema and PostgreSQL production-equivalent roles; permission/retention review, audit immutability and restore tests; incident and approval queue lifecycle (reject/expiry/retry), cross-service exactly-once completed-effect evidence and compensating failure handling.
- Deploy private network and admission controls, operator MFA/device protections, least privilege, no public route, operational sign-off and authorization policy review.

Because these inputs are not available or independently authorized in this repository review, **production live integrations and an actual operable private console are not qualified**. Exact-source success cannot certify them. This R03.7 step remains PARTIAL pending these original requirements; do not advance claiming full completion. Client Level 2 R03.12 and full repo Level 3 R05.10 remain deferred.

**Next canonical step once R03.7 is complete:** R03.8 — Secure iOS/Android builds with platform keystore, push, foreground and narrowly scoped background GPS.

## Latest R03.7 hardening qualification inventory
Implementation SHA: `466e794e15ae562eae2dc512a1447ef6b6e1d832`. Exact-SHA workflow: [R03.7 #38166667833](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38166667833), queued at recording; a queued job is not a passing qualification. This is a repository evidence-only documentation update.
- Private API: `doobr/private_api.py`, five allowlisted case actions, authenticated server-owned transport context required; `doobr/storage/tests/test_private_api.py` rejects missing MFA/CSRF/origin, unsupported paths and untrusted field injection.
- Case lifecycle: `doobr/console_cases.py`, transactionally guarded PENDING / APPROVED / EXECUTED / REJECTED / EXPIRED pathways with event log and version preconditions. Execution records externally attested completion, never performs side effects within the transaction.
- Independent authority: `doobr/private_authority.py` defaults to denial; signed-decision verification is a dependency contract, **not an operational live issuer**.
- Connected UI contract: `web/doobr-private/index.html`, `client.mjs` and `test-client.mjs`; uses same-origin POST, CSRF token and authenticated cookie, with fail-closed responses. Real private route/session deployment is NOT implemented.
- Database checks: PostgreSQL 16 service runs migration 0007 and verifies forced RLS flags and cross-tenant denial as a restricted role through `doobr/storage/tests/console_cases_rls.sql`. This does NOT certify end-to-end migrations, backup/restore, role grants or production-equivalent HA.
- Remaining release gates: independently configured 420Identity role/revocation and 420Compliance case policies, signed execution verification, transport verification at private ingress, secret lifecycle and actual HTTPS/mTLS credentials, database migration-chain and role acceptance, deployed private operation APIs, and full audit/effect recovery. No live authority or production readiness is claimed.
