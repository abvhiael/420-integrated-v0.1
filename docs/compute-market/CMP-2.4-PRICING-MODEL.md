# CMP-2.4 — Pricing model

Status: **COMPLETE — Level 1 exact-head qualified on `880aee2edd699f54467145d7cf99cbde3871a6cc`.**

Durable evidence: [CMP-2.4 qualification](CMP-2.4-QUALIFICATION-EVIDENCE.md).

Canonical definition: **Support fixed-price, work-unit, CPU-time, GPU-time and verified-result pricing.**

CMP-2.4 adds deterministic integer-only pricing with fixed-price, work-unit, CPU-time, GPU-time and verified-result models. Variable terms bind unit rate/scale, minimum/maximum charge and maximum billable units. Arithmetic is checked, division rounds upward, published charge bounds apply, and the quote must remain within the requester's signed maximum price.

Offer revisions freeze a pricing terms commitment. Legacy fixed-price publication/update remains available. Priced offers use explicit bounded terms. Matching preserves the legacy fixed-price proposal path and adds a priced proposal that binds billable units and the deterministic maximum; acceptance revalidates and freezes the full pricing snapshot.

Schedulers remain proposal-only. CMP-2.4 creates no metering oracle, custody, settlement, execution or capacity authority. Capacity reservation remains CMP-2.5.

CMP-2.4 is Level 1. CMP-2.3 already provided the offers/requests/matching Level 2 integration milestone. Level 3 remains reserved for CMP-2.8.
