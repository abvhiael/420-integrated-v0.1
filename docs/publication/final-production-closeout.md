# DOC-17.10 — Final production publication closeout

## Result

**PASS — zero blocking production publication or runtime-integration gaps remain.**

DOC-17 closes the production publication path for 420Docs without changing chain, protocol, Wallet, deployment, provider, governance, finality or application authority. Repository-controlled documentation remains authoritative for documentation content; runtime state remains authoritative only through its owning chain/protocol/application surfaces.

## Publication and release routing

- Production provider: GitHub Pages.
- Canonical production root: `https://abvhiael.github.io/420-integrated-v0.1/`.
- Publication branch: `main`.
- `development/current` and immutable `genesis/current` are the only published documentation tracks.
- Testnet and mainnet remain unavailable until DOC-13 explicitly publishes them.
- Cross-environment and cross-release fallback remain disabled.
- Built artifacts carry exact source-commit identity through `publication.json`.
- Production deployment is gated by unified 420Docs qualification and pre-upload smoke checks.
- Post-deploy smoke checks verify the deployed root, publication identity, search index, version routes and critical deep links.

## Integrated entry points

### Repository

README and repository-facing documentation entry points resolve through the committed production target. Source links remain useful navigation and never become runtime authority.

### 420 Wallet

All eight active `CTX-WALLET-*` records are bound to the production route. Resolution requires an explicitly published environment and `current` version intent, fails closed otherwise, and is marked `documentation-navigation-only`.

### 420 Explorer

All six `CTX-EXPLORER-*` records resolve through the production route. Documentation cannot change chain identity, indexed state, transaction status, safe/finalized height or RPC/Indexer interpretation.

### Developer Hub

All eight active `CTX-DEV-*` records resolve from the Hub's selected network context. Documentation remains reference/navigation only and cannot deploy, activate, verify, authorize or establish finality.

### Genesis dApps

The reusable `packages/420-docs-context` package materializes 18 published development/Genesis applications and 108 DOC-14 contextual routes. Unknown IDs, unknown surfaces, unpublished environments and unsupported version intent fail closed.

Deliberate exclusions remain:

- 420 Gaming Protocol is protocol-only and has no standalone Genesis dApp contextual namespace.
- 420 Faucet remains unavailable because its testnet documentation track is not published.

## Publication health and recovery

Publication incidents are detected through deterministic artifact checks and post-deploy reachability checks. Recovery is repository-driven: correct or revert the source, requalify, rebuild and redeploy. Operators must not edit generated Pages content in place, rewrite DOC-13 history, redirect Genesis to development, or publish an unavailable environment as a fallback.

Support diagnostics remain copy-safe and may include the public URL, source commit, failed route/check, workflow/run identity, HTTP status and timestamp. They must not include wallet secrets, signing material, credentials, bearer/session tokens or private user payloads.

## Reconciliation

At closeout, `main` remains at the DOC-17 base commit `218ca6c9d953462fa111e757176879047f60428a`; no reconciliation commit is required before final exact-head qualification.

## Merge gate

DOC-17 may merge only when the final exact PR head passes:

1. `420Docs Qualification`;
2. `420 Integrated Qualification`.

Any failure blocks merge until corrected and requalified on the new exact head.
