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
```

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

## Current limitations

State is in-memory. Restarting the host resets the game.

This package is not yet:

- durable guest/local save;
- cloud save;
- packaged native iOS/Android;
- production hosted;
- live Gaming Protocol testnet connected.

Those remain later audit/release work.
