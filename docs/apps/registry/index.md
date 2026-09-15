---
title: 420 Registry
audience: [user, developer, operator]
category: application
status: development
version: current
---
# 420 Registry

420 Registry is the user-facing discovery surface for the canonical `ProtocolRegistry`. It answers which implementation/version is currently registered for a service identity and preserves historical versions and registration commitments.

Registry state is authoritative only for its discovery domain. Registration does not grant custody, signing, spending, governance, or protocol execution privileges.

Use [Getting started](getting-started.md) for safe lookup, [User guide](user-guide.md) for service/version workflows, and [Developer integration](developer/index.md) for canonical discovery.

## Authority label
**User application over canonical protocol state.** The application presents `ProtocolRegistry`; the contract remains the source of truth.