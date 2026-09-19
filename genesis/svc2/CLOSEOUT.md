# GEN-SVC-2.24 — implementation closeout and merge review

Date: 2026-09-19. PR: #346. Scope: repository implementation of 420Location, Maps, and 420Events. This record distinguishes **merge qualification** from **deployed/product readiness**.

## Reconciled implementation ledger

| Phase | Repository deliverable |
| --- | --- |
| 2.1–2.4 | Location model/service, file persistence, geographic index and nearby/route queries. |
| 2.5–2.7 | Provider abstraction, OSM adapter and provider-swap coverage. |
| 2.8–2.10 | Place visibility/precision controls, Registry and Verify interfaces. |
| 2.11–2.13 | Canonical Events service, lifecycle and bounded recurrence with exceptions. |
| 2.14–2.16 | Public discovery, search projection and notification integration. |
| 2.17–2.19 | Public map and event UI projections, read-only v1 HTTP endpoints and typed SDK. |
| 2.20–2.22 | Security regressions plus Location and Events repository-to-HTTP-to-SDK integration tests. |
| 2.23 | Read-only cross-app consumer adapter, integration tests and explicit application-release gates. |
| 2.24 | This reconciliation, evidence links and merge review. |

These are repository implementation milestones, **not** claims that every product frontend is connected, live, or independently security-certified. The phase descriptions in the original PR body were stale after 2.13; this ledger supersedes them for repository closeout.

## Merge evidence and scope

- PR #346 feature head before this documentation closeout: `e5294bfb6cf3fac0b92760d7546d5e99cefbd57c`; dedicated GEN-SVC-2 Implementation run #58: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35465560879 (success); 420 Integrated Qualification run #4787: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35465560889 (success).
- The dedicated workflow runs `go test ./location/... ./events/... ./genesis/svc2/...` and `go vet` over the same packages. Repository-wide qualification includes `go test ./...` and additional chain/build/smoke jobs. Verify the **new closeout commit's** checks before merging; then verify the resulting `main` merge commit separately.
- The public read-only API and SDK expose public projections, not authenticated write or private-audience flows. This is not evidence of a deployed service.
- No formal independent security audit or live application certification is asserted by this closeout.

## Post-merge gates — not satisfied by this PR

1. Wire actual 420Travel, map, calendar, merchant and other consumer frontends to the versioned public projection. Capture specific UI routes, integration PRs, browser/mobile results and private/unlisted/approximate-location leakage tests. See `CROSS-APP-QUALIFICATION.md`.
2. Deploy with reviewed ingress/TLS, access and abuse controls, rate limits, request-size bounds, monitoring, and provider-privacy controls. Prove app and map-provider network traffic does not reveal private coordinates.
3. Wire a reliable discovery rebuild/publication strategy to every canonical create/update/delete, cancellation and recurrence-exception change. Stale indexes can omit new events; canonical rechecks address some disclosure risks but are not a substitute for verified occurrence integrity.
4. Before relying on individual recurring occurrence removal, verify occurrence state against the canonical recurrence rule at read time **or** publish canonical state and discovery atomically. Check the outstanding recurrence note in `SECURITY-QUALIFICATION.md`.
5. Run realistic concurrency/race, load, rollback, retention, and live deployment/consumer checks before any production or genesis-readiness claim.

## Merge disposition

Passing repository CI supports merging this implementation branch as **code integration**, subject to the latest-head and merge-commit checks. Keep all five production and consumer gates open; merging must not mark them delivered. Record the actual merge SHA and post-merge CI results on PR #346 rather than speculating here.
