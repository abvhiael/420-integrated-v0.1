---
title: 420 Verify
audience: [user, developer, auditor]
category: application
status: development
version: current
---
# 420 Verify

420 Verify reproduces deployed contract bytecode from published source and exact build settings. It answers whether source/build inputs correspond to deployed code; it does **not** certify that the code is secure, audited, endorsed, immutable or authorized.

Verification is bound to network, address and deployed code hash.

## Implementation references

- [VERIFY-5 bytecode comparison and classification](verify-5-bytecode-classification.md) — defines `FULL_MATCH`, `PARTIAL_MATCH`, `MISMATCH`, and `UNVERIFIABLE`, including exact runtime/creation comparison and explicit diagnostics for metadata, linked libraries, and immutables.
- [VERIFY-6 reproducible evidence store and history](verify-6-evidence-store.md) — defines append-only evidence history, restart reconstruction, content-hash validation, and the non-canonical storage boundary.
- [VERIFY-7 proxies and upgrades](verify-7-proxies-upgrades.md) — defines canonical proxy relationship resolution, separate proxy/implementation verification, upgrade history, and invalidation of stale implementation status.
