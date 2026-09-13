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
- [420 Trust protocol](trust.md) — domain-scoped evidence infrastructure used by ecosystem applications without creating universal reputation authority.
- [420 Commons protocol](commons.md) — community, membership, role, channel and invitation authority with off-chain content boundaries.
- [420 Pulse protocol](pulse.md) — public social graph and publication provenance with non-canonical feed/ranking and off-chain media boundaries.
- [420 Market protocol model](../../420-MARKET-V1-MODEL.md) — marketplace state, listing revision pinning, finite-inventory reservation, settlement references and privacy boundaries.
