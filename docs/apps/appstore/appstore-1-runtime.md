---
title: 420 AppStore APPSTORE-1 Runtime
audience: [developer, operator, auditor]
category: architecture
status: development
version: current
---
# APPSTORE-1 — service/runtime scaffold

APPSTORE-1 turns the Genesis AppStore profile into a runnable, contract-free service scaffold without giving the catalogue protocol authority.

## Configuration

The service is configured through:

- `APPSTORE_CHAIN_ID` — expected chain ID; defaults to `420`;
- `APPSTORE_RPC_URL` — canonical RPC endpoint;
- `APPSTORE_INDEXER_URL` — 420Indexer read API used by the production APPSTORE-2 Registry source;
- `APPSTORE_REGISTRY_ADDRESS` — canonical Registry/ProtocolRegistry deployment used for startup qualification;
- `APPSTORE_CATALOGUE_STORE` — path for the non-canonical finalized catalogue projection;
- `APPSTORE_VIEW_INPUTS` — optional strict JSON file containing non-canonical curation, security-evidence, Wallet-request and provenance-link inputs used by APPSTORE-AUDIT-4 composition;
- `APPSTORE_VERIFY_URL` — optional 420Verify base URL; its `/readyz` status controls whether current verification-class evidence may be served;
- `APPSTORE_LISTEN_ADDR` — HTTP listen address; defaults to `:8426`.

Invalid or incomplete configuration fails startup.

## Startup qualification

Before accepting traffic, the service checks canonical chain state through RPC:

1. `eth_chainId` must match the configured network;
2. the configured Registry address must contain deployed bytecode.

A wrong chain, unavailable RPC, malformed RPC response or missing Registry deployment leaves the service unready and causes startup to fail closed.

These checks establish that the service is attached to the intended network and Registry deployment. The production entrypoint then performs APPSTORE-3 catalogue bootstrap and APPSTORE-AUDIT-4 `ApplicationView` composition before accepting traffic. During runtime, each successful finalized catalogue refresh is followed by a fail-closed rebuild of the retained view set.

## Health and readiness

`GET /healthz` reports process health and explicitly returns `canonical: false`.

`GET /readyz` is owned by the composed public service. It returns 503 in `BLOCKED` mode when canonical Registry/RPC state cannot be claimed, and 200 with an explicit dependency assessment in `READY` or optional-service `DEGRADED` mode. Verify unavailability degrades the service and removes verification-class evidence rather than presenting it as current.

## Authority boundary

The runtime cannot:

- create or revoke Registry registration;
- rewrite canonical service identity or version provenance;
- sign transactions or hold wallet keys;
- grant Smart Account capabilities;
- make a listing equivalent to audit, endorsement or protocol legitimacy.

420Registry and chain state remain canonical. 420Wallet and Smart Accounts remain the authorization boundary.

## Process lifecycle

The production entrypoint is `appstore/cmd/appstore420`. It qualifies the network, bootstraps the catalogue, composes `ApplicationView` state, and then mounts one public handler containing health/readiness, `/v1/apps*`, and the embedded frontend. Public discovery requests pass through an in-memory fixed-window limiter keyed only by transport address, not Wallet/account identity. The process uses bounded HTTP timeouts and shuts down gracefully on interrupt or `SIGTERM`.
