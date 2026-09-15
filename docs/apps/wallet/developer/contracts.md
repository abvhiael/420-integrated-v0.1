---
title: 420 Wallet contracts
audience:
  - developer
category: developer-guide
status: development
version: current
---

# 420 Wallet contracts

Wallet integrations should discover and use the canonical account/authorization contracts for the active network rather than hard-code client-local authority.

## Core contract families

- `SmartAccount420` — canonical account execution and account-level authority boundary.
- `SmartAccountFactory420` — account deployment/discovery semantics.
- `SmartAccountScopes420` — shared scope definitions used by account authorization.
- `CapabilityRegistry420` — reusable capability registration, validation and revocation.
- supported signature-verification primitives such as `ECDSA420` and qualified passkey/P-256 paths.
- 420 Registry / `ProtocolRegistry` — canonical discovery of deployed protocol/service identities and compatible versions.

## Integration requirements

Applications should bind calls to the intended chain, account and target contract. They should request only the authority required for the immediate workflow and should re-check canonical authorization when executing later under a reusable capability/session.

Do not assume a frontend connection record, browser storage entry or cached session object proves current on-chain authority.

## Version discovery

Use Registry-backed deployment/interface discovery where available. If an integration requires a particular interface revision, verify compatibility before constructing state-changing calls.

## Generated references

Exact addresses, ABI tables, signatures and machine-derived contract references belong in DOC-10. This page defines the contract families and safety expectations rather than duplicating generated artifacts.
