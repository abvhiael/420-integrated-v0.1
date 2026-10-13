# LIFTd / 420Rideshare

Initial passenger rideshare foundation for 420 Integrated. Canonical roadmap: [LIFTD-ROADMAP](../docs/rideshare/LIFTD-ROADMAP.md). External acceptance: [testnet work roadmap](../docs/rideshare/LIFTD-TESTNET-WORK-ROADMAP.md).

Run focused tests with Node 22 or later: `npm test --prefix rideshare`.

`src/trip.mjs` is an internal immutable trip state machine with participant authorization, revision checks, route/driver/vehicle-bound admission, suspension/exit rules and private/public projection separation. It has no server, credential verifier, storage, map integration, payment authority or production dispatch. Never pass untrusted HTTP claims directly to its principal/admission inputs. L01.2 owns actual authentication; L01.4 owns durable transactional state; L01.5 owns private Location integration. Admission freshness must be revalidated by independently approved adapters at assignment/arrival/start.

Trip IDs and private route references are opaque internal identifiers. They must not encode addresses, coordinates or personal data; route references are not public access tokens. The public view announces only the application and disabled live booking. No location permission or personal information is collected by this foundation.
