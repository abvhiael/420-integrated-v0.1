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

## Upgrades

420Verify maintains an append-only relationship history per chain and proxy address. When the canonical implementation changes, VERIFY-7 creates a new generation and invalidates any inherited/current implementation verification binding. Historical verification evidence is retained, but it is no longer reported as current for the upgraded proxy until the new implementation is independently verified.

This enforces the Genesis rule that a proxy upgrade invalidates inherited implementation status and that verification never becomes authority over proxy administration or upgrade policy.
