# PR #368 / phase 368.0 step 5 — frozen scope and release gates

**Decision status:** scope frozen for this PR's planned work. **Implementation status:** scope contract only; publisher, source onboarding, verified publication, live Railway feed and Travel acceptance are NOT delivered by this document. Changes to this scope require an explicit reviewed amendment in the PR, with corresponding tests and release evidence; do not silently expand scope during implementation.

Inputs: [source and integration inventory](GEN-SVC-2-368-0-2-SOURCE-INVENTORY.md), [write-authority trace](GEN-SVC-2-368-0-3-WRITE-AUTHORITY-TRACE.md), [health/publication-state contract](GEN-SVC-2-368-0-4-HEALTH-AND-PUBLICATION-STATES.md). Existing components: [GEN-SVC-2 read-only HTTP handler](https://github.com/abvhiael/420-integrated-v0.1/blob/c335ac6d7b825f7c31912f052ace19f14fbc0422/genesis/svc2/httpapi/handler.go), [deployment adapter](https://github.com/abvhiael/420-integrated-v0.1/blob/c335ac6d7b825f7c31912f052ace19f14fbc0422/genesis/svc2/deployment/public.go), [Travel strict deployment](https://github.com/abvhiael/420-integrated-v0.1/blob/c335ac6d7b825f7c31912f052ace19f14fbc0422/genesis/svc3/travelapp/deployment_readiness.go).

## Purpose and in-scope deliverables

Deliver one bounded, source-qualified and operator-authorized, **public-only** Location/Events publication path consumable by the existing GEN-SVC-2 v1 HTTP API and the existing Travel public discovery client. A publisher is an explicitly authorized 420 Integrated workflow, **not** a third-party API or an operator-entered source-name variable. The canonical Location and Events models/repository lifecycle remain authoritative; import and publication must not introduce competing mutation authorities.

1. **Source qualification:** select a configurable bounded launch region and real place/event inputs; document acquisition/republishing permissions, attribution, provenance, source identifiers, acquisition versions and refresh/withdrawal obligations. No source or geographic coverage is approved or promised by this scope document. Event sources must be separately licensed or explicitly authorized by submitters.
2. **Candidate import and controlled writes:** source adapters, validation, category mapping, deduplication, reconciliation, restricted approval/correction/withdrawal workflow and audit/change reports. Use existing canonical model/repository operations, adding missing authorization-checked service operations where needed. Import never implies business ownership, Registry/Verify attestation, public visibility or organizer authority.
3. **Public publication:** immutable, versioned and checksum-bound paired Location/Events generations, source/approval evidence and a single atomic promotion pointer; one pinned generation per request. Preserve cancelled event occurrences and withdrawn places; no mixed generations, incomplete publication, unauthorized rollback or stale derived discovery.
4. **Read-only serving:** maintain `GET /v1/places` and `GET /v1/events` contracts for public projections. Implement distinct process liveness, projection availability and verified/fresh publication predicates as defined in step 4; `GET /readyz` must not return authoritative-ready merely because files are readable. Explicitly restrict public mutation routes and internal publication diagnostics.
5. **Deployment and qualification:** dedicated source-qualified publisher/operator process, least-privilege persistent storage, separately deployed read-only GEN-SVC-2 Railway service, verified HTTPS endpoint, real approved import, restart/recovery/withdrawal/outage/security tests, and public-only Travel integration with exact source and deployment evidence. Build/test/merge acceptance is tracked separately from live staging and production acceptance.

## Explicit exclusions and non-goals

- No consumer-facing booking, payment, 420BnB reservation, DOOBR dispatch/transaction, exchange, or commerce functionality.
- No enabling private Identity-bound Travel routes, Trips CRUD/sharing, authenticated operator claims, private or unlisted place/event discovery, private coordinates, or protected personal data through this public API.
- No automatic grants of place control, event organizer ownership, Registry/Verify credentials, reputation verification or trusted reviews from imported data. No claim that those services are deployed simply because an interface exists.
- No general-purpose public write endpoint, open submission-to-publication path, unauthenticated publisher/admin endpoint, or direct browser/Cloudflare mutation of canonical records.
- No unlicensed scraping, use of unsupported provider endpoints, fabricated events, fixture or empty demonstration feed presented as live content, guaranteed nationwide coverage, or guaranteed event inventory before sourcing is authorized.
- No new independent canonical place/event lifecycle database that bypasses existing validation/authorization. No distributed multi-region or multi-writer production promises from single-instance file stores or one Railway volume.
- No retroactive declaration that PR #356's private-feature gates, 420Integrated Genesis as a whole, or production deployment requirements are closed by this PR.

## State and release-claim separation

**Code integrated:** source adapters, publisher controls, generation mechanism, read-only server, tests and documentation exist on an identified GitHub commit; exact required CI passes on the reconciled PR head and separately on merged `main`. This alone does **not** mean publisher credentials, real data, persistent infrastructure or a live service are configured.

**Staging feed accepted:** documented lawful/authorized real source and operator, audited non-fixture publication (record counts and sample identifiers with private data excluded), validated generation manifest and freshness/withdrawal watermarks, persistent Railway storage, HTTPS, independent publisher and read-only service access boundaries, restart/rollback/outage tests and direct `/livez`, `/readyz`, `/v1/places`, `/v1/events` checks on identified deploy revisions. Legitimately empty query windows are allowed, but an entirely empty demonstration dataset does not fulfill the live-data launch requirement.

**Travel public integration accepted:** staging feed accepted plus verified Travel HTTPS upstream binding, API compatibility and end-to-end visible approved record/change/withdrawal; Travel fails closed when upstream is untrusted, stale or unavailable. Keep private Travel feature flags off.

**Production release:** requires separate security, licensing, operational ownership, alerting, backup/recovery, retention/deletion, availability, performance, incident response, access/secret rotation and privacy acceptance evidence. Single-instance staging file persistence or passing unit tests must never be described as production-complete.

## Merge and change control

Keep PR #368 draft until remaining design/code work is complete. Reconcile against the then-current `main`, review all shared-file edits against `main`'s authority, and test the **exact candidate head**. Merge only after required code-integration gates and explicit acceptance of documented limitations; verify the resulting `main` SHA independently. Live staging and production claims require their own evidence even if the code PR has merged. Do not set Travel `TRAVEL_PUBLIC_SERVICE_URL` to a demonstration feed or to an unqualified GEN-SVC-2 instance.

**Phase 368.0 conclusion:** steps 1–5 establish a reconciled branch, inspected interfaces/mutations, three separate health predicates and this frozen scope. Phase 368.1 begins publisher authority and provenance design; nothing in phase 368.0 creates a trusted live publisher.