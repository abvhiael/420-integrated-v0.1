# 420Analytics — Genesis Profile

420Analytics is the reference analytics and business-intelligence application for 420 Integrated. It is intentionally contract-free and derives metrics from canonical public chain state, protocol-owned reads/events, 420Registry metadata and replaceable 420Explorer-compatible indexes.

## Analytics model

Analytics may calculate network activity, asset flows, validator performance, staking, swap liquidity/volume, payments, bridge activity, marketplace activity, governance, treasury, AI/compute, resource-network, attention-economy and arbitration metrics. Every published metric must identify its chain, source set, measurement window and methodology closely enough to permit independent recomputation.

Metrics, KPIs, charts, rankings, cohorts, anomaly scores and forecasts are presentation and decision-support data. They do not change balances, ownership, rights, settlement, governance, identity, validator state or any other canonical record.

## Rebuildability and finality

The hosted analytics database is non-canonical and rebuildable. Implementations expose indexed and finalized heights, distinguish non-finalized data subject to reorg repair, and do not silently rewrite finalized history.

## Privacy and authority

Private Messenger/Commons content, encrypted Resource Protocol payloads, private Identity fields and raw Attention telemetry are excluded. Analytics may consume public aggregates deliberately exposed by an owning protocol. Operators gain no custody, smart-account, governance, bridge, validator, arbitration, payment, rights or transfer authority. Competing analytics providers and methodologies remain valid.
