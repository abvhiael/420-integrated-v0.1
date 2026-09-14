# DOC-17.8 — Genesis dApp documentation integration

DOC-17.8 provides one reusable production documentation resolver for the supported Genesis dApp set.

## Runtime contract

`packages/420-docs-context/genesis-dapps.json` materializes the DOC-14 contextual namespace for every published development/Genesis dApp. `packages/420-docs-context/index.js` resolves a dApp surface plus `CTX-*` identifier only when the requested environment is explicitly published and the version intent is `current`.

Successful results are marked `documentation-navigation-only`. They cannot establish chain identity, ownership, authorization, deployment legitimacy, settlement, finality, Registry status or any other runtime authority.

The bundle contains 18 published dApps and 108 contextual targets. 420 Gaming Protocol remains protocol-only and has no standalone dApp namespace. 420 Faucet remains unavailable because the testnet documentation track is not published.

Cross-environment and cross-release fallback remain disabled. Unknown surfaces, unknown contextual IDs, unsupported version intent and unpublished environments fail closed.

Qualification is enforced by `scripts/validate-doc-genesis-dapp-integration.py`, which checks the runtime bundle against the DOC-14 map, the production target, target-file existence and the Gaming/Faucet exclusions.
