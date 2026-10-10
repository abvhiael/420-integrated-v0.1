# Budtender web client v1

This package is the first user-facing Budtender presentation client.

It is intentionally dependency-light and runs on Node.js 22 or newer.

## Start

From this directory:

```bash
npm start
```

Default local address:

```text
http://127.0.0.1:4207
```

Set `PORT` to use another local port.

## Qualification

```bash
npm run check
npm test
npm run security
npm run ops
```

## Deployment and operations

Default repository-stage operation remains loopback-only at `127.0.0.1:4207`.

Runtime configuration:

- `HOST`
- `PORT`
- `BUDTENDER_PUBLIC_ORIGIN`

Any non-loopback bind requires an explicit HTTPS public origin.

Operational probes:

- `GET /healthz` — liveness
- `GET /readyz` — readiness

SIGTERM/SIGINT initiate graceful listener shutdown after readiness is withdrawn.

See `docs/budtender/BUD-AUDIT-10-OPERATIONS-RUNBOOK.md`.

## Authority model

The browser is presentation-only.

The local host owns one `BudtenderApplicationService` instance and exposes only sanctioned commands and detached snapshots.

The browser does not own:

- cash;
- inventory;
- order settlement;
- customer terminal state;
- upgrades;
- progression;
- expansion state;
- offline reward application.

Restocking accepts product and units only. Canonical wholesale pricing remains inside the game domain.

There is intentionally no API route that applies offline rewards.

## Current scope

The UI exposes the currently implemented Budtender gameplay slice:

- inventory;
- customers/queue;
- sales;
- restocking;
- demand profile;
- upgrades;
- expansions.

The layout is responsive and touch-friendly.

## Gaming Protocol integration

BUD-AUDIT-8 wires the client to the existing `clients/budtender-access-v1` progressive-access policy without creating browser-owned wallet/session authority.

The host exposes:
- `GET /api/gaming` for canonical namespace/runtime/policy metadata;
- `POST /api/gaming/access` for non-authoritative access-policy evaluation.

These endpoints never mutate game state. Core management remains wallet-free, and the checked-in Gaming runtime is reported as deployment-pending until GP-15 live qualification.

## Security posture

BUD-AUDIT-9 hardens the repository-stage web host with:

- same-origin enforcement for browser mutation requests;
- mandatory `application/json` mutation bodies;
- 16 KiB request-body cap;
- fail-closed malformed/unknown requests;
- Content-Security-Policy and anti-framing/content-sniffing/referrer/capability headers;
- same-origin resource policy and no-store caching;
- loopback-only default bind;
- an app-scoped static security verifier for required controls and forbidden dynamic/shell execution surfaces.

These controls complement, rather than replace, the domain-level economy/replay/offline/Gaming security boundaries.

## Current limitations

State is in-memory. Restarting the host resets the game.

This package is not yet:

- durable guest/local save;
- cloud save;
- packaged native iOS/Android;
- production hosted;
- live Gaming Protocol testnet connected.

Those remain later audit/release work.

## Approved artwork library

The canonical production artwork lives at repository-root `assets/budtender/phase-3.1/` through `phase-3.14/`, with a 368-file inventory at `assets/budtender/asset_inventory.json`. Do not duplicate or regenerate these PNGs in the web client.

The web host resolves only exact inventory-listed PNG paths at `/assets/budtender/phase-3.x/<filename>.png`, with `image/png` MIME and same-origin security headers. `GET /assets/budtender/registry.json` exposes an allowlisted index of URLs, sizes and SHA-256 hashes. Unknown assets and non-GET methods fail closed.

The UI displays a preliminary layered starter-store composition from the approved Phase 3.1 environment and Phase 3.2 counter. These layers are non-authoritative; gameplay and economics remain owned by `BudtenderApplicationService`. Production camera placement, pixel-accurate seams, and mobile-browser visual approval are still required.

Run `npm run assets` to audit all 368 committed PNG signatures, lengths and SHA-256 hashes, then `npm run check && npm test && npm run security && npm run ops`. The artwork and route tests are scoped to the Budtender web client.
