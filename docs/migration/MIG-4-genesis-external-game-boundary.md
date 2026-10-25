# MIG-4 — Genesis external game boundary

Status: scoped Level 2 qualification pending GitHub Actions.

## Canonical repositories and release ownership

| Game | Independent repository | Qualified ecosystem integration SHA | Migration Level 2 run |
| --- | --- | --- | --- |
| Green Road | https://github.com/abvhiael/420-green-road | `fb0c2e72730c4a562cb465fdc526036d79164766` | #40150016317 |
| Smoke & Chrome | https://github.com/abvhiael/420-smoke-and-chrome | `861feb3561ed22dd6c8c8a8209c30321bab3e599` | #40150019483 |
| Budtender | https://github.com/abvhiael/420-budtender | `9ab751e3cdf1fa2e8725dda0981749208ab038f5` | #40150022759 |
| Arcade and MadBuds | https://github.com/abvhiael/420-arcade | `d8bdb101dcef59048c48fe387078f7a6295462b4` | #40150036461 |

Release versions, game art, engine projects, independent builds and their qualification are owned by the external repositories. Preserve historical evidence in Genesis documentation and its Git history, not duplicated working game source. Original MadBuds Godot history: https://github.com/abvhiael/MadBuds-Godot ; archived Unity gameplay is historical only.

## Boundaries and launch decision

- `config/genesis-applications.json` removes 420Arcade from Genesis public launch requirements under the explicit Oct 24, 2026 amendment. It **retains 420 Gaming Protocol** as a separate Genesis protocol and retains High Country's Genesis continuation. Ordinary Arcade gameplay is wallet-free and the Arcade candidate catalog is NOT on-chain registration.
- `packages/420-gaming-sdk/` remains the canonical Genesis-owned versioned contract and client boundary; external games integrate through SDK version `0.1.0` and their own release SHAs. Do not import game source or copy Genesis protocol authority into game repositories.
- `docs/migration/MIG-3-level2-ecosystem-qualification.md` is the latest four-repository Level 2 evidence. Real wallet, live registry, entitlement and exactly-once settlement acceptance remain deferred to `docs/migration/MIGRATION-TESTNET-ROADMAP.md`.
- Genesis keeps `clients/highcountry-access-v1/`, the protocol SDK, chain contracts, registry, governance, and protocol-owned qualification. Game-specific packages, art, frontends and build workflows were retired from the Genesis working tree after hash-verified MIG-2 extraction.
- Game feature changes are tested and released in their own repositories. Genesis CI must not gate on deleted game-specific paths or externally-owned art/animation builds.

## Historical evidence

The pre-extraction files remain recoverable from earlier Git commits; individual destination Git blobs were verified exact in MIG-2, including all 682 Budtender, 481 Arcade and 196 MadBuds Godot files. MIG-3 integrated tests passed in each game repo. This cleanup does not assert new on-chain registration or testnet deployment.
