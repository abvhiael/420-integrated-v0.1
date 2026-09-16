---
title: 420Storage SR-9 privacy and logging review
audience:
  - developer
  - operator
  - architect
category: security
status: development
version: current
---

# 420Storage SR-9 privacy and logging review

This review closes the SR-9.10 privacy/logging requirement for the developer API, Go SDK and S3 compatibility adapter.

## Reviewed surfaces

- `execution/storage/developer_api.go`
- `execution/storage/developer_http.go`
- `execution/storage/developer_upload.go`
- `execution/storage/developer_discovery.go`
- `execution/storage/developer_helpers.go`
- `execution/storage/s3_compat.go`
- `sdk/storage420/*`
- `examples/storage420/local-testnet.env.example`
- `docs/developers/420storage-developer-hub.md`

## Findings

The SR-9 developer HTTP handler does not log request URLs, query strings, request headers, subject identifiers, session identifiers, capabilities, payload bytes, authorization failures or response bodies. Error responses are deterministic and generic; they do not echo caller credentials or internal provider errors.

Private-read metadata is transported only through the explicit `X-420-Subject`, `X-420-Session-ID` and `X-420-Capability` headers. Forwarding headers are not accepted as identity. Missing or malformed private metadata fails closed before routing.

The Go SDK sends private authorization metadata only when private mode is explicitly selected. The SDK does not expose a telemetry surface and does not serialize payload bytes into public DTO JSON.

Discovery/status responses expose operational provider/node/service identifiers and health only. They are explicitly non-authoritative and do not include credentials, secret configuration or trust grants.

The S3 adapter does not introduce an independent credential model. Private reads reuse the qualified 420 read authorization path. Private writes require an explicit write authorizer and fail closed when none is configured. S3 ETags remain compatibility metadata only and are not reused as canonical 420 object identity.

The checked-in local/testnet environment template contains placeholders only. Real subject/session values are intentionally absent and documentation directs developers to inject them at runtime outside source control.

## Logging rules for SR-9 v1

Production integrations must not log raw values for:

- `X-420-Subject`;
- `X-420-Session-ID`;
- authorization/capability tokens or future bearer credentials;
- request query strings containing canonical object/manifest/commitment identifiers unless an operator has explicitly classified those identifiers as safe for that environment;
- upload payload bytes or retrieved payload bytes;
- idempotency keys when they are treated as replay-sensitive mutation metadata;
- secret configuration, signing material, private encryption metadata or service credentials.

Operational logs may record bounded status codes, stable error categories, route tier and explicitly approved provider/node/service identifiers, provided they do not reconstruct private caller identity or secret state.

## Privacy boundary

SR-9 does not make identifiers secret by default, but it minimizes exposure. Canonical object identity and route metadata are developer-operational data; caller/session credentials and service secrets remain caller/service scoped. Applications with stricter confidentiality requirements should apply environment-specific redaction to object, manifest, commitment, provider and node identifiers as well.

## Closeout result

No SR-9 code path reviewed here contains built-in credential/request logging that must be removed before merge. The v1 documentation now treats secret and private metadata logging as prohibited by default, and the existing default-deny authorization tests cover malformed or missing private access metadata.
