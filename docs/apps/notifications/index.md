---
title: 420 Notifications
audience: [user, developer]
category: application
status: development
version: current
---
# 420 Notifications

420 Notifications is the opt-in event and alert-delivery layer for 420 Integrated. It tells users about activity without becoming authoritative for the event itself.

Alerts preserve source provenance, network identity and relevant chain references. Wallet and originating protocols remain the action/authorization boundary.


For Bridge alerts, Notifications subscribes to the replayable 420Indexer `420Bridge` event stream rather than independently decoding or authoring Bridge state. Subscription topics use canonical events such as `TransferCreated`, `TransferStatus` and `TransferTransition`. Delivery, retries and checkpoints remain non-authoritative presentation state; a notification cannot prove `COMPLETED` or `REFUNDED` settlement by itself.

