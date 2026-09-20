# GEN-SVC-3.10 — 420Travel UI qualification and reconciliation

Status: **partial; NOT a Genesis UI release sign-off**. This report distinguishes an HTTP route existing from a user journey being implemented. `qualification_test.go` asserts the current HTTP and privacy boundaries. Passing Go/CI tests cannot substitute for missing routes, live dependencies, or end-to-end UI qualification.

## Required routes and actual implementation

| Route | Current behavior | Release assessment |
| --- | --- | --- |
| `GET /travel` | HTML public place cards and upcoming linked events sourced from configured GEN-SVC-2 public read-only SDK; disconnected state otherwise | Development discovery view; no destination-search form, nearby query, maps, or linked place-detail journey |
| `GET /travel/events` | Public upcoming events with bounded UTC date and destination filters; only publicly visible venues linked; no booking | Development event listing; event details, organizer provenance and save-to-trip interaction not connected |
| `GET /travel/map` | 503 navigation shell | **Blocked**: no map/list hybrid, clustering, geolocation consent, distance sorting, or event overlays |
| `GET /travel/place/{place_id}` | Valid IDs return 503; invalid IDs 404 | **Blocked**: no usable place page, Registry/Verify provenance, hours/contact/photos or Reputation travel reviews |
| `GET /travel/trips` | 503 navigation shell; `TripStore` is in-memory service only | **Blocked**: no authenticated session, durable tenant-scoped storage, share capabilities, saved place/event UI, or public-index integration |
| `GET /travel/business/claim` | 503 navigation shell; claim workflow is an in-memory service only | **Blocked**: no authenticated requester/reviewer UI, production Registry/Verify provenance adapter or durable audit trail |
| Booking / DOOBR routes | No transaction endpoints, return 404; reserved contracts report disabled operations | Correctly fail-closed for Genesis; compatibility contracts do not enable commerce |

## Required journey matrix

1. **Destination search → place page: BLOCKED.** Destination search form and place detail implementation absent; a place link emitted by the events view targets a 503 route. A generic placeholder cannot qualify this journey.
2. **Nearby discovery → event: BLOCKED.** Public events listing works, but proximity search, permissioned location input, event details and nearby map/list navigation are absent.
3. **Place → verified travel review: BLOCKED.** No place-detail or 420Reputation `TRAVEL` review UI, verified-interaction provenance or moderation/reply integration is connected.
4. **Business claim → Registry/Verify provenance: BLOCKED.** Standalone claim service checks injected evidence but does not connect authenticated UI, real Registry/Verify verification or audit persistence. No claim may grant control of a place, alter reviews or create records.
5. **Private trip → absent from public indexing: SERVICE-LAYER ONLY.** `TripStore.ListPublic` excludes PRIVATE and UNLISTED; no deployed public-index pipeline, tenant persistence, Identity session or revocable unlisted capability exists. Must qualify against real persistence/indexing before release.
6. **BnB booking path unavailable: PASS (negative journey).** Transaction routes absent; reserved service methods fail closed. Recheck once routed/integrated.
7. **DOOBR transaction path unavailable: PASS (negative journey).** Transaction routes absent; reserved service methods fail closed. Recheck once routed/integrated.

## Implemented safeguards and limits

Public place/event projections are consumed via GEN-SVC-2, and Travel does not directly query private Location/Events repositories. A repeat public-place lookup limits exposure from stale event-to-venue relationships but does not provide an atomic snapshot or a real-time revocation guarantee. HTML templates escape public names. Route tests assert no private event title appears, incomplete read-only pages return 503, reserved endpoints 404, and unsupported mutations do not activate any journey. The public endpoint still needs trusted configuration/TLS, ingress authorization where applicable, publication/revocation guarantees, operational monitoring, usability/accessibility testing and production deployment qualification.

## Reconciliation gates before `main` release sign-off

- Implement real destination and permission-aware nearby discovery, map/list behavior, place-detail pages, and event-detail links, backed only by public authoritative projections; add end-to-end destination → place and nearby → event tests.
- Wire 420Reputation `TRAVEL` reviews with verifiable interaction evidence, provenance, moderation and safe responses; qualify place → verified review.
- Wire Identity authentication, durable tenant-scoped trip and claim storage, CSRF protection, share-token authority, Registry/Verify claim adapter, independent reviewer permissions and revocation; test private trip indexing and claim authorization in integration.
- Keep the 420BnB/DOOBR transaction boundaries disabled at Genesis. Add integrated endpoint-negative tests and verify that claims cannot mutate Registry records, Reputation or protocol authority.
- Test keyboard and screen-reader usability, mobile views, errors/disconnection, privacy under revocation, logging and deployment/security configuration. Update the PR description/roadmap to reflect implemented scope and unresolved gates before merge.

**Merge disposition:** dedicated and repository-wide CI may pass for the implemented development service, but the stated GEN-SVC-3.10 release journeys are not qualified. Do not describe the entire 420Travel Genesis MVP as complete or deploy as a production user-facing service solely on those CI results.
