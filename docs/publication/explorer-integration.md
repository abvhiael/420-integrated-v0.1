---
title: Explorer publication integration
audience: [developer, operator]
category: publication
status: current
version: current
---

# DOC-17.6 — 420 Explorer integration

420 Explorer now exposes a canonical 420Docs help entry and a deterministic contextual-help resolver for `CTX-EXPLORER-001` through `CTX-EXPLORER-006`.

The resolver is navigation-only. It cannot change chain identity, indexed data, safe/finalized heights, transaction status, registry state, or any other Explorer interpretation. Those remain derived from the qualified Indexer/RPC/runtime path.

Only `development` and `genesis` documentation environments are currently published. Testnet and mainnet requests fail closed. Only `current` version intent is accepted; no cross-environment or cross-release substitution is permitted.

`explorer/web/static/docs-context.json` mirrors the DOC-14 Explorer map. `explorer/web/static/docs-help.js` resolves stable IDs to the committed production 420Docs target. `scripts/validate-doc-explorer-integration.py` verifies the map, production root, fail-closed markers, visible Help entry, and absence of runtime-authority behavior.

If documentation is stale or unavailable, Explorer state is unchanged. Users may lose help navigation, but Explorer must not reinterpret finality, invent canonical state, or weaken consistency checks.
