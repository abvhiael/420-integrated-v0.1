# 420 Bridge security

Verify network fingerprints, route direction, canonical asset representation and recipient. Treat copied symbols, unofficial wrapped tokens and arbitrary gateway addresses as unsafe.

Fail closed on suspended/deprecated routes, mismatched adapter IDs, stale/invalid proof configuration, exhausted risk limits, replay collisions, accounting-health failures or emergency halts.

Never provide private keys or source-wallet recovery secrets to bridge support.


## Derived-data and event safety

420Indexer, Explorer, Exchange UI, Wallet activity views, Notifications and Analytics are non-authoritative consumers. They must use the canonical `420Bridge` event vocabulary—especially `TransferCreated`, `TransferStatus` and `TransferTransition`—and preserve chain/block/transaction/log provenance.

A derived `COMPLETED` or `REFUNDED` label is presentation of canonical event history, not authority to settle or refund value. If a derived consumer is stale, reorged, missing an event or disagrees with the owning Bridge contracts, fail closed and reconcile against canonical state before retrying any value movement.

