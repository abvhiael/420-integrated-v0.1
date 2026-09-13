---
title: Developer Hub publication integration
audience: [developer, operator]
category: publication
status: current
version: current
---

# DOC-17.7 — Developer Hub integration

The Developer Hub exposes 420Docs as a navigation and reference surface only. It uses the DOC-14 `CTX-DEV-*` namespace, the DOC-17 production target, and explicit network environment plus `current` documentation version intent.

The dashboard reads its environment from its own network context. Only published `development` and `genesis` documentation may resolve. Unknown environments, testnet, mainnet, unsupported version intent, missing IDs, or unsafe fallback configuration return an unavailable help state rather than substituting another track.

Eight contextual routes are integrated: developer overview, contracts/interfaces, deployment workflow, diagnostics/correlation, API fallback/reliability, generated reference, networks/manifests, and events/finality.

Documentation is non-authoritative. A successful help resolution cannot deploy code, select or activate a network, approve a release, certify security, verify a contract, grant Wallet/Registry/governance authority, or prove settlement/finality. Developer Hub readiness, qualification, service health and diagnostics continue to derive from their existing runtime evidence sources.

`scripts/validate-doc-developer-hub-integration.py` checks the runtime bundle against the authoritative DOC-14 registry and DOC-17 production target, verifies target files and environment scopes, requires explicit network/current binding, and rejects runtime mutation primitives from the documentation resolver/UI.
