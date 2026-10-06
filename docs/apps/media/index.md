---
title: 420Media
audience:
  - user
  - developer
  - operator
category: application
status: current
version: current
---

# 420Media

420Media is the replaceable 420Integrated media application for video upload/library/playback and basic livestreaming.

Repository qualification through MEDIA-AUDIT-11 establishes the application code, Media protocol integration, Storage lifecycle, livestream runtime, Identity/Rights/Pay/Compute boundaries, Search/Notifications projections, stable `/v1` API, typed SDK, user-facing web application, abuse/security controls and operational documentation.

420Media is **not** protocol authority. Canonical authority remains with the owning subsystem:

- 420Identity/Wallet for identity and signing;
- 420Rights for rights assertions and reuse/publication authorization;
- 420Storage for durable media-object availability;
- 420Pay for payment state;
- 420Compute for compute-market state;
- Media contracts for Phase-1 operator/job/stream/SLA/settlement state.

Raw media, stream secrets, codec payloads and live transport remain off-chain.

## Repository release state

MEDIA-AUDIT-11 is repository closeout, not live release evidence.

The repository deliberately does not claim:

- a production Media domain;
- a production API origin;
- a public-testnet deployment;
- materialized Registry publication;
- production scanner/secret-manager/egress infrastructure;
- Genesis catalog promotion.

Those are later MEDIA-AUDIT-12/13 gates.

## Guides

- [User guide](user-guide.md)
- [Developer guide](developer-guide.md)
- [Operator guide](operator-guide.md)
- [Moderation and appeals](moderation.md)
- [Security and threat model](security.md)
- [Configuration and deployment](configuration-deployment.md)
- [Known limitations](known-limitations.md)
