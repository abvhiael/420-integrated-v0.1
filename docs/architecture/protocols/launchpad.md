---
title: 420 Launchpad protocol architecture
audience: [developer, architect, operator]
category: architecture
status: development
version: current
---

# 420 Launchpad protocol architecture

420 Launchpad provides governed project registration, sale configuration and allocation state for qualified ecosystem launches.

## Canonical state

`LaunchpadProjectRegistry420` owns project identity and commitments. `LaunchpadSaleRegistry420` owns sale configuration/lifecycle. `LaunchpadAllocationRegistry420` owns protocol allocation records. `LaunchpadAuthorization420` binds privileged actions to the canonical capability/authorization model. `LaunchpadRouter420` coordinates bounded flows but does not become independent authority.

## Boundaries

Launchpad does not replace 420 Registry identity, 420 Token asset authority, 420 Wallet authorization, Treasury/Vault accounting, Governance policy or canonical chain settlement. A registered project is not automatically audited, endorsed, safe or profitable.

## Failure behavior

Unknown/mismatched project or sale identity, inactive configuration, authorization failure, unsupported asset/policy state and unverifiable network configuration fail closed. Clients must not bypass these conditions with alternate addresses or cross-environment fallback.

## Source ownership

- `contracts/src/launchpad/`
- `contracts/config/420launchpad-genesis.json`
- [420 Launchpad application manual](../../apps/launchpad/index.md)
