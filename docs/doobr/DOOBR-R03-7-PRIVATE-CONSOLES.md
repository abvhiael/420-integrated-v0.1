# DOOBR R03.7 — Private operator, safety and compliance consoles

**Status: PARTIAL; exact-SHA qualification pending.** PR #601, `roadmap/doobr-bc-vancouver-infrastructure`. Main at recent inspection: `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`. Canonical milestone R03.12 Level 2; R05.10 Level 3.

## Implemented in current work
- Separate `OPERATOR`, `SAFETY`, `COMPLIANCE` action allowlists in `doobr/auth.py`. Role grants are still issued and revoked only by the external trusted identity authority.
- `doobr/storage/migrations/0007_private_console_cases.sql` defines durable tenant-scoped case and event tables, strict state/revision constraints, distinct requester/reviewer identities, unique proposal and event IDs, and forced row-level security; requires controlled migration application and database permissions review before use.
- `doobr/console_cases.py` provides authenticated operator proposal, purpose-specific safety/compliance approval by a different actor/principal/token, independent authority verification, atomic serializable compare-and-set revision updates and durable audit events. Execution confirmation requires independently attested COMPLETED effect. Never trigger a payment, regulatory override, delivery, or external effect inside the database transaction.
- `web/doobr-private/index.html` provides separate operator, safety, compliance and audit sections as an **offline preview**, no forms, no client data, no public deployment, no usable commands. It is intentionally not part of the public site static build.
- Tests `test_console_cases.py`, `test_private_console.py` and an exact-SHA Level 1 workflow check separation, stale/replayed revision, denied/missing external authority and unverified execution. The existing earlier `review_dual_control` remains a read-only legacy verifier using OPERATOR grants; it is **not an approval path** and must not be substituted for the durable service.

## Remaining prerequisites — no invented live authority
- Independently connected, deployed and verified 420Identity/Verify/Registry issuer and role grant/revocation feed; 420Compliance versioned policy and safety/incident authority with live credentials, TLS/mTLS, rotation, revocation and audit ownership.
- Actual private API with authenticated HTTP endpoints and operator, safety and compliance browser sessions; this offline preview cannot manipulate cases. Integrate frontend with trusted API only after its contract and security review, not through direct DB/browser access.
- Controlled migration chain validation against existing schema and PostgreSQL production-equivalent roles; permission/retention review, audit immutability and restore tests; incident and approval queue lifecycle (reject/expiry/retry), cross-service exactly-once completed-effect evidence and compensating failure handling.
- Deploy private network and admission controls, operator MFA/device protections, least privilege, no public route, operational sign-off and authorization policy review.

Because these inputs are not available or independently authorized in this repository review, **production live integrations and an actual operable private console are not qualified**. Exact-source success cannot certify them. This R03.7 step remains PARTIAL pending these original requirements; do not advance claiming full completion. Client Level 2 R03.12 and full repo Level 3 R05.10 remain deferred.

**Next canonical step once R03.7 is complete:** R03.8 — Secure iOS/Android builds with platform keystore, push, foreground and narrowly scoped background GPS.
