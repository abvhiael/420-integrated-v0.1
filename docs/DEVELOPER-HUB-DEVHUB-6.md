# 420 Developer Hub — DEVHUB-6 420 CLI

## Status

DEVHUB-6 adds the repository-native `420` command-line interface as a thin developer-control surface over the Developer Hub runtime, `@420/sdk`, canonical contract catalogue, and DEVHUB-5 local-devnet bootstrap.

The CLI does not become a source of protocol authority. It discovers network identity through DEVHUB-1, resolves verified contract metadata through DEVHUB-2, binds RPC calls through the DEVHUB-3 SDK, exposes wallet authority-contract metadata without acquiring signer authority, and delegates local-network lifecycle actions to DEVHUB-5.

## Initial commands

- `420 version` — report CLI package identity;
- `420 network` — display the selected canonical network manifest;
- `420 service NAME` — resolve a Developer Hub service endpoint;
- `420 contract NAME` — resolve verified canonical contract metadata;
- `420 rpc METHOD [PARAMS_JSON]` — execute JSON-RPC through the SDK-selected endpoint;
- `420 wallet-contracts` — expose the canonical Smart Account Factory and Capability Registry when present in the selected catalogue;
- `420 devnet plan|doctor|prepare|up|smoke [SECONDS]` — delegate local-network lifecycle operations to DEVHUB-5.

Network, catalogue, and RPC overrides are explicit options: `--manifest`, `--catalogue`, and `--rpc`. SDK chain-identity binding remains authoritative, so a mismatched network/catalogue pair fails closed.

## Signer boundary

DEVHUB-6 does not accept private keys, seed phrases, or mnemonic material. It does not autonomously sign transactions or session operations. Wallet signing remains within the qualified 420 Wallet runtime introduced through DEVHUB-4. Future CLI transaction commands must use that wallet boundary rather than adding a CLI-owned keystore.

## Invariants

- **DEVHUB-INV-033** — CLI network identity comes from DEVHUB-1 discovery; command-line convenience must not infer or override chain authority silently.
- **DEVHUB-INV-034** — CLI contract identity comes from the DEVHUB-2 verified catalogue; unknown contracts fail closed.
- **DEVHUB-INV-035** — RPC execution is bound through `@420/sdk`, including network/catalogue chain-identity checks and declared RPC endpoint restrictions.
- **DEVHUB-INV-036** — local devnet lifecycle commands delegate to DEVHUB-5 and may not introduce a second validator or execution topology.
- **DEVHUB-INV-037** — the CLI must not embed, import, persist, or solicit private keys, mnemonics, or seed phrases.
- **DEVHUB-INV-038** — wallet-related CLI metadata never grants signer, session, capability, or smart-account authority.
- **DEVHUB-INV-039** — machine-readable command output uses deterministic JSON for scripting and CI.

## Exit criteria

DEVHUB-6 is complete when:

1. the repository exposes an installable `420` executable package;
2. network, service, and verified-contract discovery are available from the command line;
3. JSON-RPC calls use the shared SDK instead of an independent chain configuration path;
4. canonical wallet authority contracts can be inspected without moving signing authority into the CLI;
5. DEVHUB-5 plan/doctor/prepare/up/smoke are available through one CLI namespace;
6. unknown contracts, invalid RPC parameters, and unavailable wallet authority metadata fail closed;
7. CLI tests run in the dedicated 420 Developer Hub GitHub Actions gate;
8. no CLI command surface handles raw private-key or mnemonic material.

## Next

DEVHUB-7 adds developer templates and starter projects that consume the CLI and `@420/sdk` foundation.
