# DOOBr R03.10 — 420Travel coarse read-only presence handoff

Canonical R03.10: 420Travel read-only coarse presence card and deep link, hard-failed checkout.
PR #601, branch `roadmap/doobr-bc-vancouver-infrastructure`. Inspected main `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`. Level 2 R03.12, Level 3 R05.10.

## Repository implementation
- `doobr/travel_card.py` defines a strict allowlisted coarse signed projection: regional state only (`AVAILABLE`, `LIMITED`, `UNAVAILABLE`, `UNKNOWN`), maximum five-minute validity, external verifier and privacy threshold required. Unrecognized fields, exact coordinates, private addresses and stale/unsigned data are denied. The card only provides informational data, never delivery legality or booking permission.
- Deep link is fixed to `https://doobr.420integrated.org/coverage`; rejects alternate schemes, hosts, query strings, fragments, embedded credentials and checkout paths. `block_checkout` raises denial unconditionally.
- `web/travel/index.html` now shows a conservative static **UNKNOWN** state and informational handoff link plus disabled checkout. This is not a deployed signed projection feed. Live state must not appear until a verified coarse publisher and client adapter are integrated.
- `doobr/storage/tests/test_travel_card.py` covers valid states, freshness, anti-leak, external verifier denial, unsafe link and checkout prohibition. Targeted CI also checks the static 420Travel card.
- Genesis Travel transactional gates remain disabled and are not modified.

## Qualification / future acceptance
R03.10 Level 1: pending exact-SHA CI; do not call queued workflows PASS. 420Travel public deployment/projection publisher and independently signed runtime feed are unqualified; preserve fail-closed UNKNOWN state. Actual external feed acceptance is testnet/provider gated under DOOBR-AUDIT-9/10. Native 420Travel web and DOOBr publication must not expose a checkout or courier location endpoint.
R03.12 client and Travel Level 2 is a later milestone, R05.10 Level 3 is deferred until accumulated phase closeout.
**Next canonical step:** R03.11 — Playwright, device, mobile, screen reader and keyboard journeys, all denial branches.
