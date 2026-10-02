# 420 Governance fees

420 Governance defines no separate application-level governance fee in the canonical Civic contracts.

Users and operators still pay ordinary network transaction gas for on-chain interactions such as proposal creation, voting, finalization, queueing or execution.

A queued action batch may also commit native 420 value to target calls. `CivicGovernor420.queue` records the total committed action value, and `executeQueuedBatch` requires the Timelock to supply exactly that value.

Wallets may estimate network fees for presentation, but fee-quote services are consumer-layer helpers and do not influence Civic voting, finalization or execution authority.

No fixed gas-price or transaction-cost promise is made by this documentation.
