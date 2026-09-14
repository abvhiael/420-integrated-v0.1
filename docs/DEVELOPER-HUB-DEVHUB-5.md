# 420 Developer Hub — DEVHUB-5 Local Devnet

## Status
DEVHUB-5 exposes a reproducible local-development bootstrap around the repository's existing qualified 15-node devnet machinery.

The Developer Hub does not define a second consensus topology. It reuses `scripts/prepare-real-devnet15.sh` and `scripts/run-real-devnet15.py`, which already initialize and run 15 execution nodes plus 15 consensus validators against the local chain.

## Developer commands

From `developer-hub/`:

- `npm run devnet:plan` — emit the exact deterministic bootstrap plan without mutating local state;
- `npm run devnet:doctor` — verify canonical repo scripts, genesis, pinned Geth, and local-only profile constraints;
- `npm run devnet:prepare` — build `fourtwentyd` / `node420` and initialize the real15 datadirs/JWTs;
- `npm run devnet:up` — prepare and run the qualified local real15 network;
- `npm run devnet:smoke` — run the same path for a bounded 30-second smoke session.

`NODE420_GETH` may override the pinned local Geth binary path when a compatible verified binary is supplied.

## Frozen local profile

- environment: `local`
- chain ID: `420`
- execution nodes: `15`
- consensus nodes: `15`
- deterministic broker transport: `devnet-tcp`
- broker: `127.0.0.1:9420`
- RPC ports: `8545..8559`
- Engine API ports: `8551..8565`
- execution P2P ports: `30303..30317`
- canonical data root: `devnet-data/real15`

The local profile is development infrastructure only and does not define or infer production/testnet chain identity.

## Invariants

- **DEVHUB-INV-027** — DEVHUB-5 never creates an alternate consensus implementation or validator topology.
- **DEVHUB-INV-028** — the bootstrap must consume the repository's canonical execution genesis and existing real15 preparation/run scripts.
- **DEVHUB-INV-029** — the frozen Developer Hub profile is local-only and must never silently target testnet or mainnet.
- **DEVHUB-INV-030** — no private keys, mnemonic phrases, or production secrets may be embedded in the bootstrap profile.
- **DEVHUB-INV-031** — chain ID is explicit and fixed to the local manifest value `420`; it is never inferred from a connected wallet or RPC endpoint.
- **DEVHUB-INV-032** — the `plan` command is side-effect free so tooling and CI can inspect the exact commands before execution.

## Exit criteria

DEVHUB-5 is complete when:

1. developers have deterministic `plan`, `doctor`, `prepare`, `up`, and bounded `smoke` commands;
2. the Hub reuses canonical `node420`, `fourtwentyd`, execution genesis, JWT generation, and real15 orchestration;
3. the local topology and port ranges are explicit and machine-readable;
4. doctor mode fails closed when required repo assets or the pinned Geth binary are missing;
5. tests prove the profile is local-only and contains no signer secrets;
6. Developer Hub and repository qualification remain green.

## Next

DEVHUB-6 adds the 420 command-line interface on top of network discovery, the shared SDK, Wallet integration, and local-devnet bootstrap.
