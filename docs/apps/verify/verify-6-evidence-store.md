---
title: 420 Verify - VERIFY-6 Evidence Store
audience: [developer, auditor]
category: application
status: development
version: current
---
# VERIFY-6 - reproducible evidence store and history

VERIFY-6 persists verification evidence as a rebuildable, non-canonical history. The store is not an authority for chain state, Registry identity, Wallet permissions, governance rights, audit status, or application legitimacy.

## Binding and history

Records are grouped by the canonical verification binding:

`chainId:address:runtimeCodeHash`

A change to deployed runtime code therefore creates a different history rather than silently replacing evidence associated with an earlier runtime hash.

Each history entry preserves:

- canonical deployment evidence and provenance,
- the submitted source bundle and exact build settings,
- compiler reproduction evidence and input/output commitments,
- the VERIFY-5 classification and diagnostics,
- the binding key,
- an append sequence,
- a content hash over the complete stored record.

Histories are append-only. `Latest` is only a derived convenience view over the final validated history entry.

## Restart and reconstruction

The service rebuilds its in-memory indexes by scanning persisted evidence records at startup. Derived indexes may therefore be discarded and reconstructed without changing verification meaning. Startup fails closed if a record has an unsupported schema, a broken binding, a non-contiguous sequence, a source commitment mismatch, or a content-hash mismatch.

Records are written through a temporary file and atomically renamed into the evidence directory after the file is synced. This prevents a partially written record from being accepted as valid history.

## Non-canonical boundary

420Verify evidence remains reproducible derived data. Canonical deployed bytecode and deployment context come from chain state/RPC, while application identity comes from 420Registry where applicable. Losing the evidence store must never alter chain state or protocol authority; the evidence can be regenerated from source submissions, compiler inputs, and canonical deployment evidence.

The store does not imply that a verified contract is audited, secure, official, immutable, authorized, or endorsed.