---
title: 420 Wallet production documentation integration
audience:
  - developer
  - maintainer
category: publication
status: development
version: current
---

# DOC-17.5 — 420 Wallet integration

420 Wallet now consumes stable DOC-14 contextual-help identifiers through a production documentation bundle. Documentation remains navigation-only and never becomes Wallet, signing, account, recovery, network, transaction, or finality authority.

## Runtime integration

`wallet/web/docs-context.json` materializes the eight active `CTX-WALLET-*` records from the authoritative contextual registry. `wallet/web/core/docs-help.js` resolves those IDs against the committed production 420Docs base URL.

Resolution requires an explicit environment and `current` version intent. `development` and `genesis` are published. Testnet and mainnet return unavailable until DOC-13 publishes those tracks. Unknown IDs, unsupported version intents, invalid publication metadata, or enabled cross-environment/cross-release fallback also return unavailable.

Successful results are marked `documentation-navigation-only`. They may open help, but cannot authorize writes, sign transactions, change account/capability/recovery state, infer finality, or bypass Wallet security checks.

## Qualification

`scripts/validate-doc-wallet-integration.py` verifies that the Wallet bundle matches the authoritative DOC-14 records, every target exists, production URL/environment state matches the DOC-17 publication contract, fallback remains disabled, and the resolver/tests preserve fail-closed navigation-only behavior.

`wallet/web/test/docs-help.test.js` covers published Genesis resolution and fail-closed behavior for unpublished environments and unknown IDs.
