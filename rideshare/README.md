# LIFTd / 420Rideshare

Initial passenger rideshare foundation for 420 Integrated. Canonical roadmap: [LIFTD-ROADMAP](../docs/rideshare/LIFTD-ROADMAP.md). External acceptance: [testnet work roadmap](../docs/rideshare/LIFTD-TESTNET-WORK-ROADMAP.md).

Run focused tests with Node 22 or later: `npm test --prefix rideshare`.

`src/trip.mjs` is an internal immutable trip state machine with participant authorization, revision checks, route/driver/vehicle-bound admission, suspension/exit rules and private/public projection separation. L01.2 adds pinned independent Identity/session verification, a protected trip-service adapter, HTTPS status client and Fetch-compatible HTTP handler; see [session contract](../docs/rideshare/L01.2-AUTHENTICATION-AND-SESSIONS.md). L01.4 adds a PostgreSQL trip/event/command store; no deployed listener, map integration, payment authority or production dispatch is enabled. Never pass untrusted HTTP claims directly to the internal kernel. L01.2 supplies the verified authentication boundary; L01.4 owns durable transactional state; L01.5 owns private Location integration. Admission freshness must be revalidated by independently approved adapters at assignment/arrival/start.

Trip IDs and private route references are opaque internal identifiers. They must not encode addresses, coordinates or personal data; route references are not public access tokens. The public view announces only the application and disabled live booking. No location permission or personal information is collected by this foundation.

L01.3 adds independently signed driver/vehicle projections and Vancouver-scoped passenger eligibility; see [eligibility contract](../docs/rideshare/L01.3-REGISTRY-AND-ELIGIBILITY.md). Production service assembly supplies `eligibilityAdapter` and an approved server-owned Location scope adapter. Fresh approval is required for assignment/arrival/start; live transport/Registry acceptance remains gated.

L01.4 PostgreSQL storage and required Idempotency-Key/commandId behavior are documented in [store contract](../docs/rideshare/L01.4-POSTGRES-TRIP-EVENT-STORE.md). Install with `npm ci --prefix rideshare --ignore-scripts`; run real DB tests with `LIFTD_DATABASE_URL` set to an isolated `liftd_qualification` PostgreSQL database and `node --test rideshare/test/postgres/store.test.mjs`. This suite fails rather than skips without a database.
