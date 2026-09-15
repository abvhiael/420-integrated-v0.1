# 420 Explorer user guide

Explorer supports chain navigation through blocks, transactions, receipts/logs, addresses, contracts, assets and protocol-linked records.

## Recent activity
Recent blocks and transactions may still be pre-finality. Use the status shown by the application: **head** is the latest observed chain head, **safe** has stronger consensus confidence, and **finalized** is the canonical finalized boundary.

## Transactions
A transaction page should expose hash, sender, destination, value, gas/fee data, execution status, block inclusion and receipt/log context. A successful receipt proves EVM execution under that block; it does not by itself prove an off-chain claim or business promise.

## Contracts and protocols
Explorer may enrich deployed addresses with Registry and verification context. Labels are presentation; canonical service registration and deployed bytecode remain the authoritative sources.

## Stale data
If indexed height or finalized height is stale, treat the view as degraded and verify through another qualified source or RPC.
