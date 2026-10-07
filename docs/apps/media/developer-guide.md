---
title: 420Media Developer Guide
audience:
  - developer
category: reference
status: current
version: current
---

# 420Media developer guide

## Stable service contract

Service ID:

`420/service/media/v1`

The stable HTTP contract lives in `media/api`; the typed Go client lives in `sdk/media420`.

Core resources include:

- capabilities and compatibility;
- assets and upload preparation;
- livestream create/get/start/stop;
- public Search projection;
- notification subscriptions;
- signing intents;
- moderation reports/decisions/appeals.

## Secure server composition

`api.NewServer` remains an internal/backward-compatible composition surface.

Any deployed authority-bearing Media API must use:

`api.NewSecureServer(backend, SecurityConfig)`

SecurityConfig requires:

- a verified SessionVerifier;
- a ModerationService;
- expected chain ID;
- expected network.

Protected writes require a Bearer session with:

- nonempty session/actor/wallet identity;
- unexpired expiry;
- exact chain/network;
- action capability.

The server binds verified actor/wallet identity to upload owner, stream controller, notification user, signing wallet and moderation actor to reject substitution.

## SDK session handoff

`sdk/media420.Config.Session` accepts a `SessionTokenProvider`.

The SDK asks the provider for a token at request time and sends it as a Bearer header. The SDK does not persist, mint or refresh session credentials by itself.

Production apps should obtain the session from the qualified Wallet/authentication gateway and keep it memory-scoped.

## Moderation API

Secure routes:

- `POST /v1/moderation/reports`
- `POST /v1/moderation/reports/{id}/decisions`
- `POST /v1/moderation/decisions/{id}/appeals`

All are idempotent writes.

Moderator decisions require the domain-scoped `media.moderate` session capability plus the injected moderator authorizer.

Moderation state is application-layer evidence only. It never mutates protocol ownership, Rights, Pay, Compute or Wallet authority.

## SSRF and outbound endpoints

Use `media/security.ValidateOutboundEndpoint` before accepting external media-control targets.

For deployments that resolve hostnames, use `ValidateResolvedEndpoint` and enforce an independent egress network policy to defend against DNS rebinding and resolver changes.

Deny:

- loopback;
- RFC1918/private ranges;
- link-local;
- multicast/unspecified;
- localhost/.local names;
- embedded URL credentials;
- plaintext WHIP/WHEP and RTMP in the Media service boundary.

## Content scanning

`security.QuarantineGate` is the application boundary for a deployed scanner.

It fails closed when:

- media metadata is invalid;
- scanner is unavailable;
- scanner verdict is unknown;
- content is quarantined/rejected.

The repository does not bundle a malware/codec scanning engine. MEDIA-AUDIT-12 must prove the selected testnet scanner and quarantine path.

## Webhook verification

`security.WebhookVerifier` provides:

- HMAC-SHA256 signatures;
- key IDs/versioning;
- timestamp skew/expiry;
- event-ID replay cache;
- constant-time signature comparison.

Settlement/payment consumers must still re-check canonical owning state before acting on any external callback.

## Shared fixtures

Media tests reuse the GEN-SVC fixture semantics through `media/fixtures`:

- USER;
- CREATOR;
- MODERATOR;
- SVC-JOURNEY-001;
- SVC-JOURNEY-008;
- SVC-JOURNEY-009;
- SVC-JOURNEY-010.

## Non-authoritative data

Do not promote these into authority:

- Search rankings;
- Notification delivery;
- playback/upload URLs;
- application moderation visibility;
- scanner metadata;
- Indexer projections.

Canonical state is always revalidated against its owning subsystem.
