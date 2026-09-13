---
title: 420 Market V1 protocol model
audience:
  - developer
  - architect
  - operator
category: architecture
status: current
version: current
---

# 420 Market V1 Model

**Status: FROZEN FOR V1 IMPLEMENTATION**

This document is normative for the first production implementation of **420 Market**, the universal marketplace protocol of 420 Integrated.

420 Market is a universal marketplace state protocol for lawful commerce across physical goods, services, digital goods, licenses, game assets, creative products, and merchant inventory. It records marketplace intent, agreement, fulfillment state, dispute state, and references to canonical payment/asset/right systems. It is not itself the canonical owner of inventory, rights, funds, identity, or private delivery data.

## Governed 420Docs ownership

DOC-18.7 promotes this frozen normative model into the governed protocol documentation set. The complete frozen V1 semantics below remain authoritative for Market protocol documentation. Generated ABI/reference material remains separate under the generated-reference system.

Related governed architecture:
- `docs/architecture/protocols/pay-token-exchange-bridge.md`
- `docs/architecture/protocols/rights-verify.md`
- `docs/architecture/protocols/arbitration.md`
- `docs/architecture/protocols/protocol-integration-model.md`

## Core authority boundary

Market owns marketplace state: listings and revisions, finite-inventory reservation, orders, fulfillment commitments and dispute state. Payment finality remains in approved settlement systems such as 420Pay. Asset ownership, licenses/rights, identity credentials and private delivery payloads remain in their canonical systems.

## Frozen V1 invariants

- finite inventory may not oversell;
- orders pin one exact listing revision and immutable economic terms;
- only the active approved settlement reporter may finalize payment or refund state;
- terminal states cannot transition again;
- fulfillment is seller/capability authorized;
- stale, inactive or expired listing revisions cannot create new orders;
- asset identity and item class remain stable across listing revisions;
- Market cannot independently transfer funds, ownership, licenses, credentials or governance authority;
- canonical history remains reconstructable;
- private delivery/personal data remains off-chain.

## Canonical V1 state model

Listings are seller-authored offers with stable listing identity, immutable asset reference, revisioned mutable terms and explicit policy/settlement integration. Existing orders remain pinned to the revision under which they were created.

Orders progress through the frozen states `CREATED`, `PAID`, `FULFILLED`, `COMPLETED`, `CANCELLED`, `DISPUTED` and `REFUNDED` using only the allowed transitions defined by the V1 implementation. `COMPLETED`, `CANCELLED` and `REFUNDED` are terminal.

Payment cannot be inferred from signing, broadcast, mempool inclusion or non-final inclusion. An order becomes paid only after its approved settlement adapter reports finalized order-specific payment evidence. Refunds follow the same canonical settlement discipline.

Finite inventory accounting conserves originally offered quantity across available, reserved, sold and released capacity. Reservation occurs atomically before an order becomes economically binding.

Fulfillment stores classes plus commitments/references, not plaintext private payloads. Recording fulfillment does not independently create legal title or canonical ownership.

Policy, identity, rights, payment, dispute and asset integrations remain explicit protocol boundaries and fail closed when their required canonical state is unavailable or invalid.

## Change control

This model is frozen for V1 implementation. Changes require correction of an actual contradiction with frozen architecture, a security defect that cannot be resolved within the frozen semantics, or an explicit versioned V2 decision. Implementation convenience alone is not sufficient reason to weaken these rules.
