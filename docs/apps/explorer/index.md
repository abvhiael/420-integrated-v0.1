---
title: 420 Explorer
audience: [user, developer, operator]
category: application
status: development
version: current
---
# 420 Explorer

420 Explorer is the reference chain-observability application for 420 Integrated. It presents blocks, transactions, receipts, logs, addresses, contracts, assets, validator/finality context and registered protocol information from the shared 420Indexer read boundary.

Explorer is **not canonical protocol authority**. It owns no protocol state, authorizes no action, holds no custody and requires no Explorer-specific Genesis contract. If an Explorer view conflicts with canonical chain state, canonical chain state wins.

Start with [Getting started](getting-started.md), then use the [User guide](user-guide.md). Developers should begin with [Developer integration](developer/index.md).

## Authority label
**Derived/rebuildable presentation.** Source truth remains with consensus/execution and the canonical protocol that owns each domain.

## 420 Pay evidence

Explorer can display transactions, receipts and canonical status from a qualified 420 Pay deployment through its existing views. Genesis catalogue inclusion under `420/service/pay/v1` supplies neither a deployed address nor a settlement verdict. See the [Pay application overview](../pay/index.md) for authority and deployment scope.
