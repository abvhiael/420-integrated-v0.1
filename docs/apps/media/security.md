---
title: 420Media Security and Threat Model
audience:
  - security
  - developer
  - operator
category: architecture
status: current
version: current
---

# 420Media security and threat model

## Scope

This document applies the shared GEN-SVC threat model to the complete repository-qualified 420Media surface.

## Protected assets

- canonical Media job/stream/SLA/settlement state;
- creator/controller authorization;
- rights/provenance references;
- upload object identity and integrity references;
- raw media payload confidentiality where visibility is restricted;
- stream credentials;
- operator signer/lease state;
- moderation audit history;
- session tokens;
- derived public Search/Notification projections.

## Trust boundaries

1. Wallet/private keys remain outside Media.
2. Media API sessions are application authorization, not protocol identity.
3. 420Rights is authoritative for rights claims.
4. 420Storage is authoritative for canonical media readiness.
5. Pay/Compute remain authoritative for their own state.
6. Search/Notifications are derived.
7. moderation affects application visibility only.
8. upload/playback endpoints are external transport metadata.
9. codec/transport processes are hostile-input execution boundaries.

## Shared threat domains

### SPAM / resource exhaustion

Applied controls:

- bounded API request bodies and pagination;
- report limiter primitive;
- deployment-required per actor/network rate limits;
- bounded upload size policy;
- bounded session duration/reconnect;
- bounded worker parallelism/lease semantics;
- deployment CPU/memory/PID limits.

### SYBIL

Pseudonymity remains allowed.

Application sessions distinguish a verified Wallet-controlled interaction from arbitrary body-supplied identity. High-impact actions remain subject to the owning Identity/Rights/Pay/Compute authority.

### CONTENT_RIGHTS_ABUSE

Public Search projection requires canonical Rights authorization.

Moderation can hide/quarantine suspected infringement but cannot rewrite Rights records.

Content/provenance hashes are preserved for review.

### MODERATION_ABUSE

Moderator authority is domain scoped, capability checked and auditable.

Appeals preserve decision history.

Moderation cannot move funds, change protocol identity or execute Wallet actions.

### INDEX_POISONING

Only READY + PUBLIC + Rights-authorized assets project publicly.

Projection provenance/finality is retained and rebuildable; reorg/rebuild/privacy-negative tests are retained.

### WEBHOOK_REPLAY

The Media security package provides HMAC-SHA256 signature verification with key ID, timestamp expiry and event-ID replay cache.

Any future settlement-affecting callback must re-check canonical owning state after webhook verification.

### MESSAGING_ABUSE

Media Notification subscriptions are opt-in and derived. The Media service does not grant message-delivery actions Wallet authority.

## Media-specific threats

### Stream-key leakage

Controls:

- credentials are opaque references;
- endpoint userinfo is rejected;
- application service requires encrypted WHIP/WHEP and RTMPS endpoints;
- resolved secrets are bounded and injected at transport edge only;
- repository/runtime diagnostics redact sensitive URL components;
- deployment requires secret manager and token rotation.

### SSRF / endpoint abuse

Controls:

- scheme/host validation;
- localhost/.local denial;
- loopback/private/link-local/multicast denial;
- DNS-aware resolved-IP validation primitive;
- deployment-required egress network policy.

Residual risk: DNS rebinding cannot be solved solely by URL parsing; infrastructure egress policy remains mandatory and must be proven live in MEDIA-AUDIT-12.

### Parser/codec/process isolation

Controls already retained:

- operator-controlled static processing profiles;
- bounded codecs/containers/dimensions/runtime;
- direct argv execution;
- no shell;
- deadline cancellation;
- abort-on-failure output semantics.

Deployment profile additionally requires no-new-privileges, dropped capabilities, read-only root, private temporary storage, seccomp and CPU/memory/PID bounds.

### Malicious media

The `QuarantineGate` requires a configured scanner and fails closed for unavailable/unknown/quarantine/reject results.

Repository qualification proves the boundary, not a particular third-party scanner. Testnet must prove actual scanner behavior before release.

### Operator compromise

A compromised operator is not allowed to become global protocol authority.

Recovery requires operator suspension/deactivation, credential rotation, lease/session invalidation, output quarantine, canonical state reconciliation and derived projection rebuild.

### Session/actor substitution

Secure API composition requires an expiring session tied to chain/network/capability.

The server cross-checks verified actor/wallet against authority-bearing request identity fields.

### External-provider compromise

Transport endpoints, upload endpoints, playback locators and scanner output are external data.

They cannot create ownership, Rights, Pay or Compute authority.

## Security invariants

- MEDIA-SEC-001 private keys never enter Media.
- MEDIA-SEC-002 raw media remains off-chain.
- MEDIA-SEC-003 body-supplied actor cannot substitute a verified session actor.
- MEDIA-SEC-004 unsafe/private livestream endpoints fail closed.
- MEDIA-SEC-005 plaintext WHIP/WHEP/RTMP control endpoints fail closed at service boundary.
- MEDIA-SEC-006 media metadata is size/type bounded.
- MEDIA-SEC-007 scanner unavailable/unknown fails closed.
- MEDIA-SEC-008 webhook tamper/expiry/replay fails closed.
- MEDIA-SEC-009 moderator privilege is domain scoped.
- MEDIA-SEC-010 appeals preserve prior decision history.
- MEDIA-SEC-011 moderation cannot mutate protocol ownership/rights/funds.
- MEDIA-SEC-012 derived indexes cannot widen visibility.
- MEDIA-SEC-013 process execution is profile-driven argv, never requester shell text.
- MEDIA-SEC-014 deployment must enforce resource and egress sandboxing.
- MEDIA-SEC-015 operator compromise recovery starts from canonical owning state.

## Repository tests

Security regressions cover:

- private/local/resolved SSRF targets;
- rate-limit exhaustion/reset;
- scanner unavailable/quarantine/clean;
- webhook signature/expiry/replay/key version;
- unauthorized moderation;
- non-moderator action rejection;
- appeal/audit trail;
- session expiry/chain/network/capability;
- shared fixture personas/journeys;
- secure API missing-session and actor substitution;
- invalid upload metadata;
- unsafe livestream endpoints.

Live infrastructure threats remain MEDIA-AUDIT-12 evidence.
