# GROW-V2-13 — Cultivation dashboard/mobile UX: reconciled gap register

**Canonical step:** GROW-V2-13 — Full cultivation dashboard and mobile UX.
**Audit status:** **COMPLETE / Level 1 PASS** — qualified implementation `d9ef0c17086d66df39d05349ec6829ff684c58b5`. Grow V2 workflow 37891172433/job 113692221365 and retained Grow 37891172465/job 113692221230 both SUCCESS. Follow-on GROW-V2-14 hardening qualified at `e6049e4d3ef134afabcc43af1438ba9350c5a801`.

The original pre-implementation open gaps listed in this file are now reconciled. This record describes **source-level app audit**, not live deployment.

## Resolved app-audit gaps

1. **Verified revocable session:** `grow/dashboard/auth.go`, `certificate.go` and `mount.go` authenticate enrolled TLS client certificates against SPIFFE tenant/subject and fingerprints plus current membership, issue random hashed opaque Secure/HttpOnly/SameSite cookies and check live session expiry, certificate, membership and revocation on each private request.
2. **Mounted private server and actual PostgreSQL:** `grow/cmd/private-server/main.go` is an independent TLS1.3/private HTTP service, distinct from anonymous `grow/cmd/server`; `grow/dashboard/projection.go` reads actual PostgreSQL data through the dedicated non-superuser role with tenant RLS and facility/zone scopes. The retained V2-14 regression fixed facilities horizontal access.
3. **Authorized UI workflows:** `grow/web/workspace.{html,js,css}` renders server-authorized facility/plant/cultivation/harvest/inventory/human-review and internal CSV export actions, with CSRF and role gates. Actual domain service stores and SQL tests back these operations; equipment control remains separately safety-gated.
4. **Browser, accessibility and recovery:** Chromium exercises real desktop/mobile viewports, keyboard/labels, XSS-safe DOM, stale-session recovery, logout and revoked data clearing. Go integration and negative suites cover cross-tenant/facility/zone restrictions, revoked memberships, CSRF/origin/method spoof, certificate revocation and failed database connections.
5. **Exact-SHA tests:** Grow V2 and retained Grow workflows both succeeded on exact V2-13 SHA. The subsequent V2-14 exact SHA also succeeded in both app-specific workflows and its explicit V2-14 security gate. [V2-14 qualification record](420GROW-V2-14-LEVEL-1-QUALIFICATION.md).

## Remaining *release* gates — not missing V2-13/V2-14 Level 1

- **GROW-V2-15:** Phase closeout: reconcile draft PR against then-current main, establish exact merge-candidate, complete canonical comprehensive Level 3 with Solidity and Genesis inventory ownership separated.
- **GROW-V2-16:** Authenticated production-equivalent testnet deployment, actual external browser/devices, certificate issuance/rotation, live tenant data controls and operational failure/recovery acceptance. No deployment or genuine customer records are asserted by app-audit tests.

The original `420GROW-V2-13-INTERIM-QUALIFICATION.md` remains a historical subcheck snapshot and **is superseded by** the exact-SHA V2-13 and V2-14 successful workflows above. The existing public 420Location consumer is not a private-cultivation identity provider.
