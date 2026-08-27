# 420 Market V1 Model

**Status: FROZEN FOR V1 IMPLEMENTATION**

This document is normative for the first production implementation of **420 Market**, the universal marketplace protocol of 420 Integrated.

## 1. Scope

420 Market is a universal marketplace state protocol for lawful commerce across:

- physical goods
- services
- digital goods
- licenses
- game assets
- creative products
- merchant inventory

420 Market records marketplace intent, agreement, fulfillment state, dispute state, and references to canonical payment/asset/right systems. It is not itself the canonical owner of inventory, rights, funds, identity, or private delivery data.

## 2. Authority boundaries

420 Market MUST NOT:

- custody buyer or seller funds except through a future explicitly approved escrow module
- become the canonical ownership registry for listed assets
- mint or transfer rights merely because an order exists
- infer identity authority from names, profiles, or credentials
- execute arbitrary calls supplied by buyers or sellers
- treat a submitted payment transaction as finalized payment
- store plaintext private shipping, tax, legal, or delivery information on-chain
- mutate economic terms of an already-created order through a later listing edit

420 Market MAY reference:

- Identity420 profile IDs and credentials
- Names420 aliases
- ProtocolRegistry service IDs
- 420Pay invoices, payments, refunds, and settlement receipts
- 420Swap pricing or conversion routes
- oracle attestations
- entitlement/license/right registries
- game-asset or creative-asset registries
- off-chain encrypted fulfillment manifests and evidence commitments

## 3. Canonical V1 entities

### 3.1 Policy

A `Policy` defines marketplace admission and transaction requirements.

V1 fields:

- `policyId`
- `metadataHash`
- optional required credential type
- minimum Identity420 trust class
- active/inactive state

A policy is governance-curated protocol configuration. Policy changes MUST NOT retroactively rewrite existing orders.

### 3.2 Settlement Adapter

A `SettlementAdapter` identifies a protocol-approved settlement integration.

V1 fields:

- `adapterId`
- adapter/reporter address
- referenced service ID
- metadata hash
- active/inactive state

Only the active adapter address for an order's pinned adapter may report finalized payment or refund state.

### 3.3 Listing

A `Listing` is a seller-authored offer to transact under explicit terms.

Canonical V1 identity fields:

- `listingId`
- seller address
- optional seller profile ID
- item class
- immutable `assetRef`
- listing metadata hash
- policy ID
- sale mechanism
- settlement adapter ID
- quote asset
- unit price
- offered quantity
- expiry
- revision
- active state

A listing is revisioned. Existing revisions remain historically reconstructable. Economic orders are pinned to a single exact listing revision.

`assetRef` MUST NOT change across revisions of one `listingId`.

### 3.4 Order

An `Order` is a buyer/seller commercial agreement pinned to one listing revision.

Canonical V1 fields:

- `orderId`
- listing ID
- listing revision
- buyer
- seller
- quantity
- payment asset
- total amount
- settlement adapter ID
- payment reference
- fulfillment commitment/reference
- dispute commitment/reference
- status
- created/updated timestamps

Once created, the order's seller, buyer, listing revision, quantity, payment asset, total amount, and settlement adapter are immutable.

### 3.5 Fulfillment Record

A fulfillment record is a commitment to delivery/performance evidence. V1 stores commitments/references, not private payloads.

V1 fulfillment classes are frozen as:

- `PHYSICAL_SHIPMENT`
- `LOCAL_PICKUP`
- `DIGITAL_DELIVERY`
- `SERVICE_MILESTONE`
- `LICENSE_GRANT`
- `ONCHAIN_ASSET_TRANSFER`
- `GAME_ASSET_TRANSFER`
- `CUSTOM_ATTESTED`

A listing policy determines which fulfillment class is valid for that transaction.

### 3.6 Dispute

A dispute is a canonical contested-order state with a hash/reference to evidence and, later, a versioned dispute-resolution module.

V1 dispute creation MUST preserve all prior order/payment/fulfillment history. No dispute operation may delete or rewrite historical evidence commitments.

## 4. Canonical item classes

The following item classes are frozen for V1:

- `420/MARKET/ITEM/PHYSICAL_GOOD/V1`
- `420/MARKET/ITEM/SERVICE/V1`
- `420/MARKET/ITEM/DIGITAL_GOOD/V1`
- `420/MARKET/ITEM/LICENSE/V1`
- `420/MARKET/ITEM/GAME_ASSET/V1`
- `420/MARKET/ITEM/CREATIVE_PRODUCT/V1`
- `420/MARKET/ITEM/MERCHANT_INVENTORY/V1`

Additional classes require a versioned protocol extension and MUST NOT be silently interpreted as an existing class.

## 5. Sale mechanisms

The following mechanisms are canonical for the V1 protocol family:

- `FIXED_PRICE`
- `REQUEST_FOR_QUOTE`
- `AUCTION`

The first implementation path MUST fully harden fixed-price before RFQ or auction settlement is treated as production-ready.

A sale mechanism does not change the canonical order object; it changes how mutually agreed order terms are derived before order creation.

## 6. Listing state model

A listing revision has two externally meaningful availability states:

- `ACTIVE`
- `INACTIVE`

Inactive includes seller cancellation or protocol-ineligible state. Expiry is deterministic from timestamp and is not rewritten into history.

A seller MAY revise an active listing. A revision creates a new immutable historical revision and MUST NOT alter orders pinned to an earlier revision.

Seller-controlled mutable terms for a new revision include:

- metadata hash
- policy ID
- sale mechanism
- settlement adapter
- quote asset
- price
- quantity
- expiry

Seller identity, item class, and asset reference remain stable for the listing identity.

## 7. Order state machine

The V1 order states are frozen as:

- `NONE`
- `CREATED`
- `PAID`
- `FULFILLED`
- `COMPLETED`
- `CANCELLED`
- `DISPUTED`
- `REFUNDED`

Allowed state transitions:

```text
NONE -> CREATED
CREATED -> PAID
CREATED -> CANCELLED
PAID -> FULFILLED
PAID -> DISPUTED
PAID -> REFUNDED
FULFILLED -> COMPLETED
FULFILLED -> DISPUTED
FULFILLED -> REFUNDED
DISPUTED -> REFUNDED
```

No other V1 transition is valid unless this frozen model is explicitly versioned.

`COMPLETED`, `CANCELLED`, and `REFUNDED` are terminal V1 states.

`DISPUTED` is non-terminal only toward a resolution outcome supported by the V1 implementation. The initial implementation supports refund as the canonical on-chain terminal dispute outcome; additional adjudication outcomes require explicit extension.

## 8. Payment semantics

An order is `PAID` only after an approved settlement adapter reports a finalized canonical payment reference matching the order.

Payment reporting MUST be:

- adapter-authorized
- order-specific
- replay-resistant
- asset-specific
- amount-specific
- finality-aware

The Market contracts MUST NOT equate wallet signature, transaction broadcast, mempool inclusion, or non-final chain inclusion with payment finality.

A refund is `REFUNDED` only after the same approved settlement domain, or a governance-approved replacement path, reports a finalized refund reference.

## 9. Inventory semantics

Finite inventory requires canonical reservation accounting before V1 is complete.

For each finite listing revision, accounting MUST distinguish:

- originally offered quantity
- available quantity
- reserved quantity
- sold/consumed quantity
- released/cancelled quantity where applicable

The accounting invariant is:

```text
available + reserved + sold + released == originally offered quantity
```

No state transition may cause available inventory to become negative or allow two live reservations to claim the same finite unit capacity.

An order MUST reserve inventory atomically at creation or through an equivalent canonical reservation step before it can become economically binding.

## 10. Fulfillment semantics

Fulfillment is item-class dependent.

The protocol stores only the canonical fulfillment class plus a hash/reference to the relevant proof or encrypted manifest.

Examples:

- physical shipment -> carrier/tracking attestation reference
- local pickup -> pickup commitment/attestation
- digital delivery -> encrypted delivery manifest hash
- service milestone -> milestone evidence hash
- license grant -> canonical issued-license ID/reference
- on-chain asset transfer -> canonical transfer/ownership reference
- game asset transfer -> game registry transfer reference

Recording fulfillment does not by itself prove legal title or ownership unless the canonical referenced registry says so.

## 11. Identity and credential semantics

Seller/buyer addresses remain the direct transaction authorities unless Smart Account capability rules authorize another operator.

Profile IDs and `.420` names are discovery/presentation references only.

Policies MAY require an Identity420 credential type and minimum issuer trust class. Credential validity is checked against Identity420; Market does not copy or become authoritative for credential state.

A credential requirement MUST be evaluated at the protocol-defined action point and MUST fail closed if the credential is revoked, expired, rejected, issuer-disabled, or below the required trust class.

## 12. Private data

The chain MUST NOT store plaintext:

- shipping addresses
- phone numbers
- legal names unless voluntarily public and independently canonical
- private order messages
- tax documents
- customs forms
- delivery access instructions
- private digital delivery secrets

Private order data is encrypted off-chain. On-chain state stores content hashes, encrypted-manifest references, authorization references, and minimal status commitments.

## 13. Cancellation semantics

V1 permits cancellation only from `CREATED` before finalized payment is recorded.

Either buyer or seller may request/perform cancellation in the initial model where no payment has finalized. Inventory reservation MUST be released exactly once.

Paid orders are not cancelled; they proceed through fulfillment, dispute, or refund semantics.

## 14. Dispute semantics

Either buyer or seller may open a dispute from `PAID` or `FULFILLED`.

A dispute requires a nonzero evidence/manifest commitment.

Opening a dispute MUST NOT:

- erase payment state
- erase fulfillment state
- rewrite listing terms
- transfer unrelated seller funds
- affect unrelated orders

Only the economic value attached to the affected order may be subject to resolution through the approved settlement/dispute path.

## 15. Completion semantics

Buyer acceptance moves `FULFILLED -> COMPLETED` in V1.

Completion MUST be idempotent in effect: a completed order cannot complete, refund, cancel, or dispute again under V1 rules.

Automatic/time-based completion is not part of the frozen first implementation unless later added by an explicit versioned policy module.

## 16. Fees

V1 protocol fee is **0% by default**.

Any future protocol marketplace fee MUST be:

- explicitly versioned
- governance-controlled
- disclosed separately from seller price, tax, shipping, royalties, and settlement costs
- unable to retroactively alter an existing order

The current frozen model does not grant Market arbitrary authority to skim settlement flows.

## 17. Smart Account delegation

420 Market MUST remain compatible with 420 Integrated programmable smart accounts.

Future delegated capabilities MUST be narrow and action-specific, including examples such as:

- create listing
- revise listing
- cancel listing
- manage inventory
- record fulfillment
- manage storefront metadata

No marketplace capability automatically grants unrestricted custody transfer, governance, validator, bridge, recovery, or arbitrary execution authority.

## 18. Protocol invariants

The V1 implementation MUST prove/test at minimum:

### MARKET-INV-001 — No overselling
Reserved plus sold quantity never exceeds finite offered quantity.

### MARKET-INV-002 — Revision pinning
An order's economic terms cannot change when its source listing is revised.

### MARKET-INV-003 — Payment authority
Only the active approved settlement reporter for the order may mark payment/refund finalized.

### MARKET-INV-004 — Payment replay protection
One settlement reference cannot finalize multiple incompatible market transitions.

### MARKET-INV-005 — Terminal state safety
Completed, cancelled, and refunded orders cannot transition again.

### MARKET-INV-006 — No unauthorized fulfillment
Only the seller or explicitly capability-authorized seller operator may record fulfillment.

### MARKET-INV-007 — No stale listing execution
New orders may not bind an expired, inactive, or non-current listing revision unless the relevant sale mechanism has already created a canonical pre-expiry commitment.

### MARKET-INV-008 — Asset identity stability
A listing revision cannot silently substitute a different canonical asset reference or item class.

### MARKET-INV-009 — Settlement amount conservation
Recorded finalized payment/refund values must correspond exactly to the order and approved settlement record.

### MARKET-INV-010 — Market authority minimization
420 Market cannot independently transfer funds, ownership, licenses, credentials, or governance authority merely from marketplace state.

### MARKET-INV-011 — Historical reconstructability
Listings, revisions, orders, payments, fulfillment commitments, disputes, and terminal outcomes remain reconstructable from canonical chain history/events.

### MARKET-INV-012 — Private-data minimization
No canonical Market action requires plaintext private delivery/personal data on-chain.

## 19. V1 implementation sequence

Implementation MUST proceed in this dependency order unless a concrete contradiction is found:

1. frozen identifiers and policy registry
2. listing revision model
3. canonical inventory reservation/accounting
4. fixed-price order creation
5. 420Pay settlement adapter integration
6. fulfillment registry/classes
7. dispute/refund state
8. identity/credential enforcement
9. reputation derived from canonical completed/disputed orders
10. RFQ/offer module
11. auction module
12. storefront/delegated-operator layer

RFQ, auctions, reputation, storefronts, and additional fulfillment automation MUST NOT weaken the frozen listing/order/payment/inventory invariants.

## 20. Change control

This model is frozen for V1 implementation.

A change requires one of:

- correction of an actual contradiction with already-frozen 420 Integrated architecture
- a security defect that cannot be resolved within the frozen semantics
- an explicit versioned V2 market decision

Implementation convenience alone is not sufficient reason to weaken these rules.
