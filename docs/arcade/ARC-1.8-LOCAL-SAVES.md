# ARC-1.8 — Versioned local save and progress interfaces

The offline guest progress API at `packages/arcade-saves/` implements `read(gameId,playerRef?)`, `writeIfRevision(gameId,expectedRevision,progress)`, `migrate(gameId,fromVersion,toVersion)` and `restoreBackup(gameId,revision,version)`. It uses injected browser localStorage-compatible storage and WebCrypto SHA-256 checksums, immutable per-game IDs from the frozen eleven-game manifest, explicit schema and content versions, strictly increasing revisions, updated timestamps, and guest ownership. Unregistered/wallet-free mode only. It never claims authenticated cloud sync or score verification.

Every record is JSON-safe and bounded; corrupt values, checksum mismatches, unsupported future schemas, foreign IDs/player owners, future timestamps, overlarge saves and stale revisions fail closed. Data is defensively copied. Pure one-version-at-a-time migration functions are explicit; migration writes a separate durable backup *before* promoting the upgraded record. Backup inspection never implicitly rolls back newer progress. No runtime upgrade without qualified migration steps.

**Important concurrency boundary:** the localStorage storage interface has no cross-tab atomic compare-and-swap. In-process concurrent operations are serialized per game, but cross-tab/cloud revision authority is *not* claimed. Future cloud synchronization requires authenticated revision-safe backend ownership. No local record is wallet-bound or uploaded.

Test owner: `.github/workflows/arcade-1-8-level1.yml`, with adversarial save and migration tests, retained runtime adapters, and launcher build. Live testnet/Registry and device acceptance are separate gates.
