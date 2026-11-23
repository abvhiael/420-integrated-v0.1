# BET-AUDIT-7 — Authoritative 420Registry integration

**Local implementation:** `clients/420bet-lobby/server/registry-verifier.mjs`
**Operator entrypoint:** `npm run verify:registry`
**Indexer linkage:** `server/sync-indexer-events.mjs` now denies all scans unless the registry, source addresses and approval are independently verified first.
**Status:** repository integration and local tests; official-network deployment/approval and real chain receipts remain open.

## What actually owns game configuration

The authoritative 420Bet system is **not one unqualified HTTP catalogue**. This integration checks the actual Solidity contracts from `contracts/src/bet`:

| Registry | Canonical record and checks |
| --- | --- |
| `BetGameRegistry420` | `getGame(gameVersionId)`: exact `gameId`, `gameVersionId`, `moduleVersionId`, `rulesetId`, four profile IDs, `manifestHash`, product class and game mode, existence and **ACTIVE** status |
| `BetModuleRegistry420` | `getModule(moduleVersionId)`: exact module ID, implementation, manifest and registered runtime-code hash; **APPROVED** status |
| `BetProfileRegistry420` | `getProfile(profileId)` for randomness, risk, settlement and access: active/existing and exact type/manifest/artifact hash |
| `BetOperatorRegistry420` | `getOperator(operatorId)`: exact operator account and manifest with **ACTIVE** (not paused/revoked) status |
| `BetAuthorization420` | `scopeForGame/Module/Operator/Vault/Wager` and `isAuthorized`: on-chain live capability decision for every independently signed required principal/action/scope/amount |
| `BetRegistry420` (wager ledger) | Actual `authorization()` immutable dependency |
| `WagerRouter420` | Actual immutable `games()`, `modules()`, `operators()`, `profiles()`, `authorization()`, `betRegistry()` must point to the validated contracts |
| `SettlementEngine420` | Actual immutable `registry()` and `authorization()` must reference the validated wager ledger/authorization; address and deployed code must match the signed manifest |
| `ProtocolRegistry` (optional per game service publication) | Actual `getService` and `getRegistrationProfile` checks for active service, exact version, implementation, code and manifest hash |

The contract's `settlementProfileId` is **not** an on-chain settlement-contract address. To avoid pretending otherwise, the integration requires an independent signed settlement-address and code-hash binding. The casino settlement target must also equal the signed canonical `casino-settlement` event source and its immutable dependency getters must match. Do not claim an equivalent constructor linkage for a sportsbook/poker/fantasy settlement engine absent the published ABI and approved deployment configuration for that engine.

## Mandatory operator manifest and trust anchor

The operator must provide a real JSON manifest at `BET_REGISTRY_MANIFEST`, and an **independently pinned** trusted signing account at `BET_REGISTRY_TRUSTED_APPROVER`. The signer is never learned from the untrusted manifest alone.

Manifest schema `bet-registry-manifest-v1`:

- `chainId`: official positive decimal chain ID; `genesisHash`: independently approved genesis block hash
- `revision`: positive decimal manifest revision; `approved:true`; `approvalAuthority`: real independent signer address; `approvalSignature`: full Ethereum EIP-191 signature
- `approvalDigest`: Keccak-256 of the **canonical normalized** manifest excluding `approvalDigest`, `approvalAuthority`, `approvalSignature`. Fields are recursively sorted and JSON-encoded before hashing; a signed message is `420Bet registry manifest v1\n<approvalDigest>`.
- `contracts`: real `{address,runtimeHash}` for `gameRegistry`, `moduleRegistry`, `profileRegistry`, `operatorRegistry`, `authorization`, `capabilityRegistry`, `wagerRegistry`, and optional `protocolRegistry`. Duplicate contract addresses are rejected.
- `sources`: exactly one approved `{id,role,address,runtimeHash,fromBlock}` for each role: `casino-router`, `casino-settlement`, `poker-ledger`, `fantasy-contest`, `sports-tickets`. No duplicate roles or ambiguous emitters; actual on-chain runtime code is verified for each source. Indexer settings must match **all** five exact IDs/roles/addresses/deployment heights.
- `games`: one or more signed bindings for every required vertical: **casino, poker, fantasy, sportsbook**. Each game defines a unique `id`, `gameId`, `gameVersionId`, `moduleId`, `moduleVersionId`, `rulesetId`, `manifestHash`, `moduleManifestHash`, `implementation`, `implementationCodeHash`, `gameMode`, settlement `{address,runtimeHash}`, `operatorId`, `operatorAccount`, `operatorManifestHash`, and four `profiles` (each `{id,type,manifestHash,artifactHash}`).
- `authorizedRoles`: non-empty, bounded approved `{action,scope,principal,scopeId?,amount?}` entries. Allowed canonical `BetIds420` actions are exactly `game-register`, `game-activate`, `game-pause`, `module-approve`, `operator-activate`, `wager-record`, `wager-settle-record`. Allowed scopes are `game`, `module`, `operator`, `wager`, `vault`; wager and vault require a `scopeId`.
- `protocolService` (optional per game): `{serviceId,version,manifestHash}`, requiring the corresponding `protocolRegistry` binding.

**There are no embedded deployment addresses, credential types, role grants or fake signer keys.** A manifest with `approved:true` but no valid signature, unsigned mutations, a wrong trusted signer, wrong genesis, paused module/operator, changed profile or missing capability must fail closed.

## Verification and operating mode

Run from `clients/420bet-lobby` in the trusted operator environment:

```sh
# Operators must provision genuine service URLs, deployed contract IDs and an
# independently approved, signed manifest before invoking these commands.
BET_REGISTRY_MANIFEST=/secure/420bet/approved-registry.json \
BET_REGISTRY_TRUSTED_APPROVER=THE_APPROVED_SIGNER_ADDRESS \
BET_REGISTRY_RPC_URL=https://YOUR_QUALIFIED_RPC \
npm run verify:registry
```

The verifier performs read-only calls at one single `finalized` block. It checks the chain ID, genesis and finalized tip, compares `keccak256(eth_getCode)` to the signed runtime hashes of the registries, game implementations, settlement contracts and Indexer source emitters, checks actual records and roles, and re-reads the block hash to catch a reorg during verification.

For Indexer sync the same `BET_REGISTRY_*` settings are now mandatory along with `BET_INDEXER_EVENT_MANIFEST` and `BET_INDEXER_EVENT_CHECKPOINT`. The Indexer source manifest and Registry-approved sources must match before a checkpoint can advance.

**No wagering authority:** Read-only Registry verification is not eligibility verification or a signing capability; this code never sends transactions, activates contracts, changes escrow or derives payout decisions.

## Qualification boundaries

Source tests are in `tests/registry-verifier.test.mjs` and the focused `.github/workflows/420bet-ecosystem-7-level1.yml` workflow. They cover missing/forged approval, genuine EIP-191 signatures, all four verticals, wrong chain/genesis, stale/reorged block, wrong module and settlement code, missing/paused operators, profiles, roles, ProtocolRegistry versions, incorrect source mappings and dependency poisoning.

Before official completion, the authorized operator must obtain actual chain/genesis and deployed contract identities, sign the exact approved manifest, independently verify runtime hashes, execute real RPC reads and negative/reorg drills, and retain exact SHA/run IDs and third-party acceptance. Those **external/testnet** gates belong under `TN-BET-7-REGISTRY` in `docs/420BET-TESTNET-WORK-ROADMAP.md`. They do not turn mock local fixtures into live deployed proof.
