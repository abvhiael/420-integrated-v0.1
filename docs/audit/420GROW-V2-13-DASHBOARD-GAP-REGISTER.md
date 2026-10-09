# GROW-V2-13 — Cultivation dashboard and mobile UX: qualification gap register

**Canonical step:** GROW-V2-13 — Full cultivation dashboard and mobile UX.
**Current disposition:** IN PROGRESS; not Level 1 COMPLETE and not production-enabled.

## Repository-grounded interface boundary

The existing `grow/web/index.html` and `grow/cmd/server/main.go` are public read-only 420Location consumers. Their public anonymous discovery rights are not valid for the separate tenant-private cultivation workspace described in [GROW-V2-01](420GROW-V2-01-EXPANDED-PRODUCT-DECISION.md). The existing Go domain packages implement multiple qualified private operations, but the public web server has no trusted private session issuer and no authenticated API aggregator binding them to HTTP.

This step adds a **separate** `grow/web/workspace.html`, `workspace.js`, `workspace.css`, and frontend tests. It packages with the existing public static build but does not modify the directory or publish tenant records. It also introduces a narrow `grow/dashboard` Go HTTP interface with injected authenticated session authority and an injected tenant-scoped projection reader; both dependencies are mandatory. There is **no default demonstration account, token, fixture tenant or trust inheritance from public 420Location**.

## Implemented UX and privacy controls

- Touch-sized, horizontal scroll mobile navigation, responsive record grid, keyboard skip link, readable status announcements and reduced-motion support.
- Sections for overview, facilities, plants, environment, equipment, cultivation, harvests, inventory, advice and notifications, rendered only if server-authorized for the current tenant.
- Explicit empty, unavailable, unauthenticated and expired-session states; no example records misrepresented as live data.
- Client checks HTTPS origin, same-origin or explicitly approved cross-origin boundary, credentialed no-cache/no-redirect requests, typed `grow-private-v1` contracts, maximum 500 records, bounded response sizes, tenant ID alignment, duplicate IDs and HTML-free text rendering.
- Server-side interface validates an externally verified unexpired authenticated session, section allowlist, scope, per-row tenant consistency, record counts, duplicate IDs, denied/unavailable routes, cache prevention, no public read fallback and no mutation endpoints.

## Open qualification requirements (must not be relabeled as passed)

1. Connect an actual, authenticated, revocable cultivation session issuer/verifier to the private HTTP handler; do not infer authority from public directory browsing.
2. Connect a real RLS-backed, per-section projection reader to the qualified Grow facility, plant, telemetry, equipment, cultivation, harvest, inventory, advice and notification modules, with explicit role/zone authorization and exact tenant isolation.
3. Implement backed, authorized create/edit/record/review/export journeys for the required home grower, technician, facility manager and quality reviewer workflows. This page currently supplies a **read-only overview**, not the full management UX or real editing forms.
4. Qualify mobile browsers and accessibility (keyboard/screen reader/touch), responsive chart rendering, failure and stale-state recovery, session logout/revocation, multi-tenant attack paths, retention and payload privacy with real authenticated backend data.
5. Run the V2-13 app fast qualification against one exact implementation SHA including the retained original Grow web/build/Go suites, as well as any newly wired private API tests. Record workflow run/job conclusions, scope limits, main divergence and remaining release gates.

A static file build passing does **not** prove live login or complete dashboard. The endpoint is disabled by default until genuine private service infrastructure is configured and qualified. GROW-V2-14 security hardening and V2-15 Level 3 do not substitute for missing V2-13 Level 1 criteria. GROW-V2-16 remains the production-equivalent testnet gate.

**Next canonical step after complete V2-13 qualification:** GROW-V2-14 — Security, privacy, adversarial and recovery qualification.
