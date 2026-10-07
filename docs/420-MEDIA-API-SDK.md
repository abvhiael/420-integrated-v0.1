# 420Media — Stable /v1 API and typed SDK

Roadmap step: **MEDIA-AUDIT-9 — Stable /v1 API and typed SDK**

## Purpose

MEDIA-AUDIT-9 exposes the already-qualified Media application boundaries through the common GEN-SVC API/SDK contract without creating a new protocol authority or claiming a deployed public service.

The implementation consists of:

- `media/api` — versioned HTTP contract and backend composition boundary;
- `sdk/media420` — typed client, compatibility validation, service discovery and external Wallet-signing handoff.

Live deployment, Registry publication and a production origin remain later roadmap work.

## Stable API identity

Canonical service ID:

`420/service/media/v1`

Stable API version:

`v1`

Compatibility major:

`1`

All service responses use a versioned JSON envelope.

Error responses use stable machine-readable error codes plus a human-readable message.

## Stable routes

Read/discovery:

- `GET /v1/status`
- `GET /v1/capabilities`
- `GET /v1/compatibility`
- `GET /v1/assets`
- `GET /v1/assets/{id}`
- `GET /v1/livestreams/{id}?controller=...`
- `GET /v1/search`

Retriable writes:

- `POST /v1/uploads/prepare`
- `POST /v1/livestreams`
- `POST /v1/livestreams/{id}/start`
- `POST /v1/livestreams/{id}/stop`
- `POST /v1/notifications/subscriptions`
- `DELETE /v1/notifications/subscriptions/{id}?user_ref=...`
- `POST /v1/signing/intents`

The API package defines a backend interface rather than embedding deployment wiring. Deployment composition is intentionally deferred.

## Cursor pagination

List endpoints use only:

- `cursor`
- `limit`

Rules:

- default limit: 50;
- maximum limit: 200;
- cursor is opaque to the HTTP and SDK layers;
- cursor length is bounded;
- offset pagination is rejected;
- duplicate/unknown pagination parameters fail closed;
- responses expose `next_cursor` only when the backend supplies one.

The API/SDK never interprets a canonical backend cursor as an authority-bearing ID.

## Timestamps

All API timestamps are normalized to UTC and encoded through Go's RFC3339 JSON time representation.

Normalized fields include:

- `created_at`;
- `updated_at`;
- `observed_at`;
- signing-intent expiry;
- rate-limit reset metadata.

The API never returns a local timezone as canonical service time.

## Stable IDs and errors

Application IDs are opaque strings. The API does not derive authority from ID structure.

Stable machine error codes include:

- `invalid_request`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `idempotency_conflict`
- `rate_limited`
- `unavailable`
- `internal_error`
- `unsupported_version`

Backend errors may expose a code through the API error-code interface. Unknown dependency failures fail closed as `unavailable`.

Malformed/unknown JSON fields are `invalid_request`, not dependency outages.

## Idempotency

Every retriable Media write requires `Idempotency-Key`.

The repository implementation provides a bounded-process in-memory replay store suitable for the service contract/test boundary.

Semantics:

1. fingerprint method + path + query + exact request body;
2. first successful response is retained by idempotency key;
3. exact retry returns the original status/body without re-executing the backend;
4. reuse of the same key with a different fingerprint returns `idempotency_conflict`.

Production multi-instance durable idempotency storage remains deployment architecture work and must preserve these semantics.

## Request/response bounds

- maximum request body: 128 KiB;
- maximum SDK response body: 2 MiB;
- page limit: 1..200;
- cursor length is bounded;
- idempotency key length is bounded;
- JSON decoding is strict and rejects unknown fields/trailing objects.

Responses include:

- JSON content type;
- no-store caching;
- `X-Content-Type-Options: nosniff`;
- service/API identity headers;
- explicit rate-limit metadata.

## Provenance

Authority-bearing API views carry explicit provenance fields:

- source;
- authority;
- chain ID;
- block number/hash;
- transaction hash;
- log index;
- finality;
- observation time.

The API remains a service/presentation boundary. Provenance metadata does not make HTTP state canonical.

Search remains derived from the already-qualified public Media projection.

## Capabilities and compatibility discovery

`GET /v1/capabilities` exposes:

- canonical service ID;
- API version;
- compatibility major;
- non-canonical service designation;
- feature availability;
- resource names;
- Wallet-signing mode;
- cursor-pagination contract;
- timestamp convention;
- maximum page limit;
- stable error vocabulary.

`GET /v1/compatibility` exposes:

- service ID;
- API version;
- compatibility major;
- minimum supported client major;
- runtime chain ID/network where configured.

The server rejects a backend that reports a mismatched service/version/compatibility contract.

## Typed SDK

Package:

`sdk/media420`

Typed client coverage includes:

- status;
- capabilities;
- compatibility;
- asset list/get;
- upload preparation;
- livestream create/get/start/stop;
- public Media search;
- notification subscription create/delete;
- signing-intent preparation.

The SDK validates:

- secure service URL;
- response version;
- typed JSON response envelopes;
- page bounds;
- idempotency requirements;
- compatibility major;
- expected chain/network before authority-bearing writes;
- signing-intent chain/network/domain.

Non-loopback HTTP endpoints are rejected; HTTPS is required outside local development.

## Canonical service discovery

The SDK exposes an injected `ServiceDiscovery` interface.

`Discover` resolves exactly:

`420/service/media/v1`

A discovered endpoint must supply:

- matching service ID;
- base URL;
- nonzero chain ID;
- network identifier.

The SDK then constructs the same compatibility-enforcing typed client.

No production Registry address or endpoint is invented by this step.

## Wallet signing handoff

The service and SDK never accept or retain wallet private keys.

`POST /v1/signing/intents` returns a backend-qualified signing intent containing:

- stable intent ID;
- domain `420/MEDIA/API/SIGNING/V1`;
- wallet;
- chain ID;
- network;
- action;
- resource ID;
- payload hash;
- replay nonce;
- expiry;
- message to sign.

The server verifies the returned intent exactly matches the requested wallet/chain/network/action/resource/payload boundary.

The SDK exposes `WalletSigner`:

```text
Sign(context, message) -> signature
```

`PrepareAndSign` passes only the prepared message to the caller-provided Wallet signer. The SDK does not request, store or derive a private key.

A signature does not by itself authorize Media state; the authoritative Media/Identity/Rights/stream/Pay/Compute boundary must still validate the eventual action.

## Security invariants

- **MEDIA-API-INV-001:** stable service routes are namespaced under `/v1`.
- **MEDIA-API-INV-002:** pagination is cursor-based; offset pagination is not part of the stable contract.
- **MEDIA-API-INV-003:** API timestamps are UTC.
- **MEDIA-API-INV-004:** retriable writes require idempotency keys.
- **MEDIA-API-INV-005:** idempotency-key reuse with a different request fails closed.
- **MEDIA-API-INV-006:** strict JSON rejects unknown/trailing input.
- **MEDIA-API-INV-007:** stable machine error codes remain separate from human-readable messages.
- **MEDIA-API-INV-008:** compatibility/chain/network mismatch blocks authority-bearing SDK writes.
- **MEDIA-API-INV-009:** non-loopback SDK endpoints require HTTPS.
- **MEDIA-API-INV-010:** service discovery resolves the canonical Media service ID rather than a hard-coded production address.
- **MEDIA-API-INV-011:** Wallet signing is an external handoff; no private key enters the Media API/SDK.
- **MEDIA-API-INV-012:** signing-intent wallet/chain/network/action/resource/payload substitutions fail closed.
- **MEDIA-API-INV-013:** API/SDK state does not become protocol authority.
- **MEDIA-API-INV-014:** capability/version discovery is explicit and machine-readable.

## Qualification level

MEDIA-AUDIT-9 is an ordinary roadmap step and is qualified at **Level 1 app-scoped fast qualification**.

It introduces an application-local HTTP/SDK boundary over already-qualified components and does not change a canonical shared protocol.

No new Level 2 milestone is documented or required.

## Qualification scope

Required fast qualification:

- canonical Media verifier;
- gofmt for `media/api` and `sdk/media420`;
- Media Go tests;
- Media SDK tests;
- Media Go vet including SDK;
- GEN-SVC validator;
- retained Search dependency tests;
- retained Media Solidity/Phase-1/Anvil regression gates;
- exact implementation SHA assertion.

## Deferred work

- live HTTP executable/deployment composition and durable multi-instance idempotency storage — MEDIA-AUDIT-10/12/13 as appropriate;
- production Registry/service endpoint publication — MEDIA-AUDIT-12/13;
- user-facing Wallet signing UX — MEDIA-AUDIT-10;
- rate-limit infrastructure/provider enforcement and abuse closeout — MEDIA-AUDIT-11/12;
- production TLS/origin/monitoring evidence — MEDIA-AUDIT-12/13.
