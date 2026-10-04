---
title: VERIFY-7 Proxies and Upgrades
audience: [developer, auditor]
category: application
status: development
version: current
---
# VERIFY-7 — proxies and upgrades

420Verify treats a proxy shell and its implementation as separate verification targets. A verified proxy shell never implies that the implementation is verified, audited, safe, official, immutable, or that its admin configuration is safe. Likewise, a verified implementation never implies that the proxy shell or proxy admin is safe.

## Canonical relationship resolution

VERIFY-7 resolves proxy relationships from canonical chain state when possible. The first supported forms are EIP-1967 implementation storage and EIP-1167 minimal proxies. EIP-1967 implementation, admin, and beacon storage are observed at a canonical block and preserved with the observation block hash.

The relationship is bound to chain ID, proxy address, proxy runtime code hash, proxy kind, implementation address, and canonical observation block. Unknown or unsupported proxy patterns are not guessed.

## Separate verification state

Proxy verification and implementation verification remain independent result classes. The implementation must be verified against its own deployed address and runtime code hash; the proxy result cannot be copied to the implementation, and the implementation result cannot be copied to the proxy.

## Upgrades and freshness

The proxy package can maintain append-only relationship generations when canonical observations are supplied to its tracker. Historical verification evidence remains valid for the block at which it was observed, and a new implementation must be independently verified against its own deployed-code binding.

The production `verify420` entrypoint does **not** currently run that tracker continuously. Persisted proxy relationship evidence therefore must be treated as historical block-scoped evidence, not as a continuously refreshed assertion of the proxy's present implementation.

A downstream UI or integration may display the recorded implementation and observation block, but it must revalidate canonical proxy state before describing that relationship as current. A proxy upgrade never transfers verification from the old implementation to the new one.

This preserves the Genesis rule that verification never becomes authority over proxy administration or upgrade policy while avoiding a false continuous-monitoring claim.
