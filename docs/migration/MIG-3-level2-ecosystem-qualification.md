# MIG-3 — Independent game ecosystem integration (Level 2)

Status: **PASS — version-pinned SDK / offline and simulated-provider integration only.** This qualification does not assert production-equivalent testnet registration, settlement, or any autonomous game protocol authority.

## Exact qualified source commits and evidence

| Independent repository | Qualified SHA | Scoped Level 2 GitHub Actions run |
| --- | --- | --- |
| abvhiael/420-green-road | `fb0c2e72730c4a562cb465fdc526036d79164766` | [40150016317](https://github.com/abvhiael/420-green-road/actions/runs/40150016317) — success |
| abvhiael/420-smoke-and-chrome | `861feb3561ed22dd6c8c8a8209c30321bab3e599` | [40150019483](https://github.com/abvhiael/420-smoke-and-chrome/actions/runs/40150019483) — success |
| abvhiael/420-budtender | `9ab751e3cdf1fa2e8725dda0981749208ab038f5` | [40150022759](https://github.com/abvhiael/420-budtender/actions/runs/40150022759) — success |
| abvhiael/420-arcade | `d8bdb101dcef59048c48fe387078f7a6295462b4` | [40150036461](https://github.com/abvhiael/420-arcade/actions/runs/40150036461) — success |

## Tests and boundaries

- Compatibility contract and immutable game-ID mapping: `@420/gaming-sdk` compatibility version `0.1.0`. Arcade's read-only external SDK checkout is pinned to Genesis SHA `f4d26e6c35ec0c77ecd04b9d8f05d015e87cedb0`. Other games use their MIG-2 pinned local SDK copies.
- Registration identity: Green Road, Smoke & Chrome and Budtender are checked against canonical stable IDs. Arcade explicitly asserts `LOCAL_CANDIDATE_ONLY`, `NOT_REGISTERED`, every game `UNREGISTERED`, and `madBuds: null` in the SDK. No registration contract transactions were made.
- Wallet linkage: core gameplay remains guest-accessible, cloud save requires registration, optional wallet entitlements require link then connection. Invalid/unsupported features fail closed.
- Entitlements: game namespace is attached to provider requests; foreign-game entitlement responses are rejected and schema validation fails closed.
- Claims: malformed/cross-game reward-claim envelopes are denied. A simulated authoritative provider deduplicates repeated `gameId:profileId:claimId` submissions (Arcade mock deduplicates claim IDs within one game). This **does not prove on-chain exactly-once enforcement**.
- Offline: connection returns guest, wallet entitlements unavailable, reward submission unavailable; game-owned gameplay remains outside the adapter.
- No Genesis-global qualification was rerun. Existing MIG-2 build/Godot evidence remains valid where game runtime files were unchanged.

## Deferred testnet requirements

The canonical `docs/migration/MIGRATION-TESTNET-ROADMAP.md` governs real contract deployment and live network integration. In particular MTN-0 (network/registration prerequisites), MTN-2 (real EIP-1193 wallet sessions), MTN-3 (authoritative exactly-once claims, disputes and ledger effects), and MTN-4 (published package installation and independent network acceptance) remain **unqualified**. The Arcade and MadBuds registration status is deliberately unresolved. Neither sidecar mocks nor local catalogs confer protocol authority.

## Gate interpretation

**MIG-3 Level 2 integration milestone:** PASS for version-pinned SDK contracts, authorization boundaries, offline behavior and simulated-provider claim idempotency across four independent repositories, with no protocol authority copied into those games.

**Production-equivalent Genesis protocol integration:** NOT PASSED; it belongs to the separately approved Migration Testnet roadmap, not this milestone.
