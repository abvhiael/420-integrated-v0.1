# Budtender deployment & operations runbook

## Current release boundary

This runbook covers repository-stage operation of `clients/budtender-web-v1`.

It does not claim a live production or production-equivalent testnet deployment.

## Runtime

Required: Node.js 22 or newer.

From `clients/budtender-web-v1`:

```bash
npm run check
npm test
npm run security
npm run ops
npm start
```

Default endpoint:

`http://127.0.0.1:4207`

## Configuration

Environment:

- `HOST` — defaults to `127.0.0.1`;
- `PORT` — defaults to `4207`;
- `BUDTENDER_PUBLIC_ORIGIN` — required for any non-loopback bind.

Examples:

Local:

```bash
HOST=127.0.0.1 PORT=4207 npm start
```

Explicit remote/platform binding behind HTTPS ingress:

```bash
HOST=0.0.0.0 PORT=8080 BUDTENDER_PUBLIC_ORIGIN=https://budtender.example npm start
```

A non-loopback bind without an HTTPS public origin is invalid and must fail startup.

TLS termination is external to this Node host. The platform/reverse proxy must preserve the intended Host boundary used by the application origin checks.

## Probes

Liveness:

`GET /healthz`

Readiness:

`GET /readyz`

Use liveness to determine whether the HTTP process is alive.

Use readiness to decide whether to route application traffic.

Do not treat liveness as proof of persistence, live Gaming connectivity, or production readiness.

## Startup sequence

1. verify intended repository SHA;
2. use Node 22+;
3. run check/tests/security/ops verifier;
4. validate HOST/PORT/public-origin policy;
5. start the process;
6. confirm `/healthz`;
7. confirm `/readyz`;
8. confirm `GET /api/state`;
9. only then attach intended ingress.

## Shutdown

For planned shutdown:

1. remove/drain external ingress if present;
2. send SIGTERM (or SIGINT for local operation);
3. readiness becomes false;
4. listener closes gracefully;
5. verify the process/listener exits before replacement.

The current application state is in-memory. Shutdown/restart therefore resets gameplay state.

## Recovery

After service failure:

1. verify code/config SHA;
2. verify Node runtime;
3. verify runtime exposure configuration;
4. restart the host;
5. confirm liveness/readiness;
6. confirm presentation shell and `/api/state`;
7. restore ingress.

Because durable persistence is not yet implemented, recovery does not restore previous in-memory progression.

## Monitoring

At repository stage monitor:

- process availability;
- `/healthz`;
- `/readyz`;
- HTTP error rate;
- restart/crash frequency;
- configuration drift;
- Gaming runtime state shown as deployment-pending.

Do not log secrets or invent wallet/session authority.

## Deployment manifest

`deployment.runtime.json` is repository truth for the current deployment contract.

It intentionally records:

- `liveDeployment: false`;
- `testnetQualified: false`;
- `persistence: in-memory`;
- `gamingRuntime: deployment-pending`.

BUD-AUDIT-11 owns live testnet evidence and may update live/testnet records only when a real qualified deployment exists.

## Known limitations

- no durable save/persistence;
- no cloud save;
- no production TLS/reverse-proxy configuration committed here;
- no native mobile packaging;
- no live Gaming Protocol testnet binding;
- no production deployment claim.
