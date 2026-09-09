# 420GP-7 — Shared Gaming SDK

## Status
Initial reusable SDK extraction from the High Country reference integration.

## Package
`packages/420-gaming-sdk`

## Purpose
Provide a game-neutral client integration surface for the 420 Gaming Protocol without forcing games to import High Country-specific policy or raw contract storage concepts.

## Public surface
- progressive player state: guest / registered / wallet-linked
- access requirements: core / registered / wallet
- contextual prompts: none / register / link-wallet / connect-wallet
- scoped game client creation through `createGamingClient420({ gameId, adapters })`
- profile lookup/create adapter boundary
- entitlement lookup adapter boundary
- guest migration preparation and claim lookup boundary
- SmartAccount/session-status adapter boundary
- scoped cross-game attestation verification boundary

## Architecture
The SDK is transport-neutral. RPC, indexer, backend, wallet, or test adapters are injected by the consuming application. Every adapter call receives the configured `gameId`, preventing the SDK from silently crossing game namespaces.

The SDK does not hold private keys, create a parallel session authority, store raw guest saves, or enumerate player activity across games.

## High Country reference migration
`clients/highcountry-access-v1` now consumes the shared progressive-access evaluator and retains only its game-specific feature mapping and reason codes. This removes the duplicated access-state implementation while keeping the High Country UX stable.

## Invariants
1. Core play is available to guests without registration or wallet.
2. Registered-only benefits never require a wallet.
3. Wallet-only features prompt for linking only when deliberately entered.
4. A linked but disconnected wallet prompts for reconnect only at a wallet-feature boundary.
5. Unknown access requirements and missing adapters fail closed.
6. Every protocol adapter operation is scoped to one configured game ID.
7. The SDK does not grant pay-to-win gameplay advantages.

## Next work inside 420GP-7
This slice establishes the SDK foundation. Later SDK increments can add production RPC/indexer adapters, ABI bindings, normalized protocol errors, typed schemas, and packaged integration helpers for additional game engines/frameworks.
