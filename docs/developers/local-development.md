---
title: Local development
audience:
  - developer
category: developer
status: development
version: current
---

# Local development

420 Integrated local development reuses the repository's qualified real15 machinery. Developer Hub does not define a parallel consensus implementation or a convenience-only chain with different authority semantics.

## Frozen local profile

The canonical local Developer Hub profile is:

| Property | Local value |
| --- | --- |
| Environment | `local` |
| Chain ID | `420` |
| Execution nodes | 15 |
| Consensus validators | 15 |
| Broker transport | `devnet-tcp` |
| Broker | `127.0.0.1:9420` |
| RPC ports | `8545..8559` |
| Engine API ports | `8551..8565` |
| Execution P2P ports | `30303..30317` |
| Data root | `devnet-data/real15` |

These values describe the local development profile only. They do not identify public testnet or mainnet.

## Lifecycle commands

Run the Developer Hub lifecycle from `developer-hub/`.

### Inspect

```bash
npm run devnet:plan
```

`plan` prints the deterministic bootstrap sequence without changing local state.

### Diagnose

```bash
npm run devnet:doctor
```

`doctor` verifies the required repository scripts, canonical execution genesis, pinned/compatible Geth dependency and local-only configuration. Do not continue past a failed doctor result by manually substituting unknown binaries or network files.

### Prepare

```bash
npm run devnet:prepare
```

Preparation builds the local `fourtwentyd` and `node420` components and initializes the real15 development data directories/JWT material through the repository's existing preparation path.

Local Engine JWTs are operational secrets for the local environment. They are not application credentials and must never be copied into browser applications, starter repositories or public documentation.

### Run

```bash
npm run devnet:up
```

This uses the canonical real15 orchestration path rather than creating a separate topology.

### Bounded smoke run

```bash
npm run devnet:smoke
```

The packaged smoke command uses a bounded 30-second run, which is useful for validating a workstation or CI environment before a longer development session.

## CLI equivalents

The 420 CLI delegates these operations to the same Developer Hub bootstrap:

```text
420 devnet plan
420 devnet doctor
420 devnet prepare
420 devnet up
420 devnet smoke [SECONDS]
```

The CLI is an orchestration surface only. It does not own consensus state, validator authority, Engine authority or application signing keys.

## Pinned Geth boundary

The local bootstrap expects the repository's qualified Geth dependency. `NODE420_GETH` may explicitly point to a compatible verified local Geth binary when necessary.

An override is not permission to use an arbitrary binary. If the selected execution binary is incompatible with the repository's expected Engine/execution behavior, treat the environment as unqualified.

## Local data and reset expectations

Local chain data under `devnet-data/real15` is development state. Applications should never assume it is durable user data or portable network identity.

When rebuilding or resetting a local environment:

- preserve any developer artifacts you actually need outside the devnet data root;
- expect chain history, nonces, receipts and deployed local addresses to change when local state is rebuilt;
- rediscover contracts/services from the selected local catalogue/manifest after a reset;
- never copy local addresses into production/testnet configuration as if they were canonical deployments.

## Health checks for application developers

Before debugging application code, verify the lower layers in this order:

1. `devnet:doctor` passes;
2. the devnet processes are running;
3. the selected manifest says `local` and the expected chain ID;
4. the RPC endpoint responds;
5. the SDK/CLI accepts the network/catalogue pairing;
6. the required canonical contract or service resolves;
7. only then debug application reads/writes.

This order prevents a stale or wrong environment from masquerading as an application bug.

## Security boundary

Local tooling must not contain or solicit:

- production validator keys;
- production/testnet private keys or mnemonic phrases;
- passkey private material;
- production Engine JWTs;
- production API/service credentials.

Use purpose-built local/test accounts and the qualified Wallet boundary for signing behavior. A local development shortcut must not create an insecure production integration pattern.

## Related guides

- [Developer quickstart](quickstart.md)
- [Prerequisites](prerequisites.md)
- [Source of truth](source-of-truth.md)
- [First read and Wallet-authorized write](first-read-write.md)
