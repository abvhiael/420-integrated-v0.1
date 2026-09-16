---
title: 420 AppStore APPSTORE-3 Catalogue Persistence
audience: [developer, auditor]
category: application
status: development
version: current
---
# APPSTORE-3 — catalogue persistence

APPSTORE-3 adds a persistent **noncanonical** catalogue store for the rebuildable Registry projection introduced in APPSTORE-2.

The persisted document records the configured chain ID, canonical Registry address, finalized block, and normalized Registry-derived service/version records. It does not become a source of protocol truth. On restart, the file is validated and used only to reconstruct the in-memory projection; canonical Registry evidence remains authoritative.

## Persistence properties

- schema version is explicit and validated before restore;
- files are written via a temporary file followed by atomic rename;
- service/version records are persisted in deterministic order;
- malformed JSON, unsupported schema versions, invalid chain/Registry metadata, or tampered canonical records fail closed;
- missing storage is distinguishable from corruption, allowing the service to rebuild from canonical Registry evidence;
- persisted catalogue state can be discarded and recreated without changing Registry state, service legitimacy, Wallet permissions, governance, execution, or custody.

## Restart and rebuild model

`RebuildFromSnapshot` validates a fresh canonical Registry snapshot through the APPSTORE-2 projection rules before it can be persisted. `RestoreProjection` replays the persisted document through those same canonical validation rules before making it available to the service.

This preserves APP-INV-001 through APP-INV-004: the AppStore remains contract-free and non-authoritative, canonical Registry fields cannot be silently rewritten by local catalogue state, and presentation metadata remains separate from Registry provenance.
