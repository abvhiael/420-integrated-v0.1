---
title: Pay, Token, Swap/Exchange and Bridge
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Pay, Token, Swap/Exchange and Bridge

DOC-7.3 documents the canonical value-movement protocols used by 420 Integrated. These protocols overlap operationally, but they own different domains: 420 Pay defines invoice/payment/settlement semantics; 420 Token creates governed-template ERC assets; 420 Swap supplies canonical liquidity/execution primitives; 420 Exchange qualifies assets and markets and routes bounded trades; and 420 Bridge admits external chains/assets through explicit proof, route, risk and replay boundaries.

None of these protocols can manufacture authority belonging to another. A token deployment does not make an asset trade-eligible. A bridge proof does not make an asset canonical. An Exchange listing does not create bridge backing. A payment quote does not bypass wallet authorization, settlement health or replay protection.

## Authority map

| Protocol | Canonical authority | Explicit non-authority |
| --- | --- | --- |
| 420 Pay | invoices, payment identity/status, bounded settlement authorization, refund/accounting state | arbitrary spending, exchange price setting, bridge verification, wallet signing |
| 420 Token | approved token templates, deterministic factory deployment/provenance | native `$420` issuance, automatic exchange listing, bridge backing, post-deployment token ownership |
| 420 Swap / 420 Exchange | qualified assets/markets/routes, bounded execution, fee routing, exchange-specific emergency controls | external-chain truth, arbitrary token custody, oracle price setting, confiscation |
| 420 Bridge | admitted external-chain identities, bridge assets/routes, proof adapters, transfer lifecycle, risk and reconciliation evidence | general oracle authority, Exchange price discovery, arbitrary supply repair, consensus/finality authority |

## Native `$420` and tokenized assets

Native `$420` is the chain currency. It pays gas and participates directly in protocol settlement where supported. It is not an ERC token produced by 420 Token.

Where ERC-oriented execution requires a token surface, 420 Exchange may use the canonical wrapped-native representation. Wrapping is an execution convenience and does not redefine the underlying native currency.

Application-created ERC20/ERC721/ERC1155 assets are separate assets. Before another protocol treats one as a canonical settlement, exchange or bridge asset, that protocol must independently apply its own registry, verification and governance rules.

## 420 Pay

420 Pay separates merchant billing intent, payment identity, conversion/settlement execution, finalization and refund accounting.

### Invoices

`InvoiceRegistry420` supports `SINGLE_USE`, `MULTI_USE` and `PARTIAL_PAYMENT` invoices and acceptance classes `FAST`, `FINALIZED` and `HIGH_VALUE`.

An invoice commits merchant identity/address, metadata hash, currency, amount, expiry/refund window, accepted-assets hash, settlement-plan hash, tip policy, slippage bound and mode. The signing root is domain separated under `420/APP/420PAY_INVOICE`.

Current constraints include:

- supported invoice currencies `CAD`, `USD` and `420`;
- expiry must be in the future;
- refund window cannot precede expiry;
- invoice slippage cap cannot exceed 42 basis points;
- single-use invoices cannot enable arbitrary partial payments;
- partial-payment invoices cannot exceed the declared invoice total;
- multi-use invoices without partial-payment permission require the full invoice amount per use.

Optional invoice metadata must agree with the shared metadata commitment when one is supplied.

### Payment identity and lifecycle

`PaymentRegistry420` derives a payment ID from the invoice, payer, merchant, input asset/amount, settlement asset/amount, quote ID and payer nonce under `420/APP/420PAY_PAYMENT_ID`.

The lifecycle distinguishes `SUBMITTED`, `INCLUDED`, `CERTIFIED`, `FINALIZED`, `SETTLED`, refund states and failure. Finalization does not merely mean a frontend saw a transaction; the canonical registry only accepts the allowed predecessor states and verifies invoice/settlement fields before marking the payment finalized.

Settlement assets must be canonical under the shared asset interface. Duplicate payment IDs are rejected.

### Quotes, payer bounds and replay protection

`PaymentRouter420` currently uses a 42-second quote lifetime and a maximum default slippage bound of 42 basis points. The payer supplies explicit ceilings for input amount, gas cost, slippage, tip, conversion fee and protocol fee.

The current 420 Pay router requires the Pay protocol fee to be zero. A shared fee quote must match the requested conversion fee and remain unexpired.

Before swap-backed settlement the router checks:

1. payer/governance authority;
2. operational safety state;
3. payment authorization has not already been consumed;
4. shared replay state has not consumed the payment ID;
5. quote timestamp and lifetime;
6. canonical settlement asset and market health;
7. shared fee quote;
8. payer limits;
9. merchant minimum settlement amount;
10. live settlement adapter.

Replay authorization is consumed before external settlement execution. Post-execution checks ensure input did not exceed the payer's maximum and delivered settlement did not underpay the invoice.

### Splits and refunds

`SettlementRouter420` supports at most eight recipients. Basis-point shares must total exactly 10,000. Integer rounding remainder is assigned deterministically to the declared primary recipient so the split always reconciles to the source amount.

Refund accounting is bounded to the original payment entitlement. `PaymentRegistry420` and `RefundManager420` prevent cumulative refunds from exceeding the refundable payment amount, while preserving partial-versus-complete refund state.

## 420 Token

420 Token is a self-service factory for known ERC token profiles. It is not the issuer of native `$420`.

### Template registry

`TokenTemplateRegistry420` currently exposes frozen version-1 profiles for:

- fixed-supply ERC20;
- owner-mintable ERC20;
- capped mintable ERC20;
- burnable ERC20;
- EIP-2612 permit ERC20;
- vote-checkpoint ERC20;
- ERC721 collection;
- ERC1155 multi-token.

Governance may disable a template for future factory use. Disabling a template does not rewrite an already-deployed token's code or balances.

### Factory and provenance

`TokenFactory420` charges an exact creation fee of **42 native `$420`**. That fee is atomically forwarded to the configured community treasury vault; if treasury forwarding fails, deployment reverts rather than leaving value stranded in the factory.

Deployments are deterministic/provenance-bearing: creator, template identity/version and configuration hash are recorded, and CREATE2 salt construction includes creator and creator nonce inputs.

The factory does not retain token custody or post-deployment mint authority. Token-level ownership/mint/burn/permit/vote behavior comes from the selected template and the deployed token's own state.

## 420 Swap and 420 Exchange

420 Swap and 420 Exchange are related but not synonymous. 420 Swap supplies the canonical liquidity/execution layer. 420 Exchange adds asset qualification, market identity, route adapters, scoped authorization, bounded multi-hop routing, fee policy, oracle sanity checks and narrow emergency controls.

### Asset and market eligibility

`ExchangeAssetRegistry420` records canonical chain/asset identity, local exchange token, category/status, verification hash, metadata and moderation flags.

An external asset is trade-eligible only when it is currently `VERIFIED` and has no active moderation flags. Verification can therefore be invalidated operationally without pretending historical trades never occurred.

`ExchangeMarketRegistry420` requires active markets to reference eligible assets and a live execution venue. Native `$420` is handled as the configured native asset identity; other assets are dynamically rechecked through the asset registry.

### Routes and 420 Swap

`ExchangeRouteRegistry420` governs approved quote and execution adapters. The registry explicitly keeps **420 Swap as the underlying liquidity layer** while allowing Exchange to route through approved venues/adapters.

`CanonicalSwapAdapter420` is the Exchange boundary to canonical 420 Swap. Route data is bound to the canonical market, and execution verifies market/pair identity plus delivered output rather than trusting a venue return value alone.

### Capability authorization

`ExchangeAuthorization420` is a read-only facade over `CapabilityRegistry420`. Swap and bridge-related permissions are scoped by market or asset and include amount bounds. Wallet connection alone does not authorize a trade.

### Atomic routing

`ExchangeAtomicRouter420` provides bounded exact-input routing with a maximum of four hops. The submitted path is hashed and must match the expected path hash. Repeated-token loops are rejected.

For each hop the router rechecks market activity, user authorization, route activity, exact input accounting, minimum output and oracle health. Intermediate approvals are cleared after use.

Native `$420` may be wrapped at the start of an atomic path or unwrapped at the end. The router uses transient custody only where needed for intermediate/delegated execution and checks that intermediate/final balances return to their expected baselines.

### Oracle boundary

`ExchangeOracleGuard420` is a provider-neutral fail-closed circuit breaker. Its reference oracle does **not** set the executable market price. Instead, the guard checks that the realized/quoted execution price is fresh and within the configured deviation band.

A disabled guard, stale reference, invalid price or excessive deviation fails the guarded execution path rather than substituting an unverified price.

### Exchange fees

`ExchangeFeePolicy420` caps the retained Exchange protocol fee at 100 basis points and requires any nonzero fee configuration to have a complete 10,000-basis-point split and valid recipients. The developer-payment portion of retained Exchange protocol revenue is capped at 10% of that retained fee.

`ExchangeFeeRouter420` handles retained Exchange protocol revenue only; LP/provider fees are explicitly outside this router. Authorized collectors are replay-protected by trade reference, and the router pulls value only from the calling collector before atomically splitting it across configured destinations.

### Emergency controls

Exchange emergency controls are domain specific: swaps, limit orders, bridge deposits, bridge withdrawals, market activation and fee routing can be halted separately. A halt records an incident hash.

The emergency controller has no custody or confiscation authority and cannot rewrite completed ownership or settlement history.

## 420 Bridge

420 Bridge treats every external chain, asset representation, route and proof adapter as explicit configuration. External proof validity is necessary but is not sufficient by itself to move value.

### Chain identity

`BridgeChainRegistry420` binds a compact `routeChainId` to a chain key, network fingerprint, native asset identity, verifier family and chain family. Supported family categories include EVM, Solana, UTXO, XRPL, Tron, shielded and custom systems.

The network fingerprint is important: a familiar numeric chain identifier alone is not enough to distinguish forks/testnets or another network with the same external numbering convention.

### Bridge assets

`BridgeAssetRegistry` binds a bridge asset ID to its local token representation, issuer/bridge type, metadata, status and whether it is the canonical local representation.

An active bridge asset must agree with the shared canonical-asset registry. Bridge configuration cannot independently declare an arbitrary local token canonical.

### Routes and adapters

`BridgeRouteRegistry` binds each route to:

- asset ID;
- source and destination chain IDs;
- source and destination asset identities;
- adapter ID;
- verifier-configuration hash;
- version/status;
- independent inbound/outbound enable flags.

Routes move through explicit states such as approved-inactive, active, suspended and deprecated. Direction can be disabled independently.

`GatewayRouter420` maps governed adapter IDs to contracts whose self-reported ID must match. For inbound transfers, the adapter verifies the external proof, but the router still rechecks local asset usability, route health/direction, risk limits and replay-safe transfer creation. For outbound transfers, it performs the same local policy/risk checks before asking the adapter to initiate the external message.

### Risk and replay

`BridgeRiskManager` enforces both route-level and asset-level single-transfer, hourly, daily and TVL constraints and also checks shared protocol risk limits. Only trusted bridge routers can consume those limits.

`BridgeTransferRegistry` derives a transfer ID from route, asset, sender, recipient, amount, source transaction ID and source message ID under the `420/BRIDGE_TRANSFER` domain. Shared and local replay protection prevent the same canonical transfer identity from being created twice.

Transfer state distinguishes source pending/finalized, proof pending, verified, destination pending, completed, failed/retryable, expired, paused, disputed and refunded states. External release/mint/burn logic must respect the route's required source finality/proof semantics rather than interpreting creation as completion.

### Accounting evidence

`BridgeAccountingRegistry` stores authorized-versus-observed supply reconciliation plus an evidence hash and health result. It explicitly does **not** mint, burn or repair balances.

A mismatch is evidence of an unhealthy bridge state that should stop unsafe value movement and trigger reconciliation/incident handling; it is not permission for the accounting registry to silently change user balances.

## Exchange ↔ Bridge provenance

`ExchangeBridgeQualification420` binds an external Exchange asset listing to live Bridge provenance. Qualification requires agreement among:

- Exchange asset verification/provenance;
- canonical external chain identity;
- active canonical bridge asset representation;
- active route and required direction;
- route asset/source/destination identities;
- verifier configuration;
- live gateway adapter whose reported adapter ID matches.

Qualification is revalidated against live dependencies when consumed. It is not a one-time governance assertion that stays valid after a route, asset, chain or adapter becomes ineligible.

Bridge qualification does not execute a bridge transfer, and Bridge does not become an Exchange price oracle.

## Cross-protocol composition

A typical value workflow can compose the protocols without merging their authorities:

1. Wallet authorizes a bounded action.
2. 420 Pay binds invoice/payment identity and payer limits.
3. If conversion is required, Pay invokes the canonical settlement adapter.
4. 420 Exchange validates market/asset/route/capability state and executes against 420 Swap/approved venues.
5. For an external asset, Exchange requires current Bridge qualification.
6. Bridge independently validates external proof, canonical route/asset state, direction, risk and replay.
7. Canonical chain state records the resulting settlement/transfer lifecycle.
8. Indexer/Explorer project that state but do not manufacture payment, trade or bridge finality.

A TokenFactory-created asset can later participate in Pay, Exchange or Bridge only after satisfying those protocols' separate registration and qualification rules.

## Reorganizations and finality

Payment, trade and bridge events follow canonical chain history. Before finality, derived views must tolerate rollback/replay.

For local payments, `FINALIZED` must correspond to canonical protocol/finality state rather than a UI label. For cross-chain movement, the bridge adapter/route must apply the source-finality/proof rule appropriate to the external network before irreversible destination-side value is released.

A reorg or provider disagreement must never be resolved by an indexer inventing a completed payment or bridge transfer.

## Failure and recovery behavior

- **Stale/mismatched payment quote** — fail settlement; obtain a new quote rather than widening payer limits silently.
- **Unhealthy conversion market** — fail the conversion-backed payment or trade; do not bypass the health/oracle guard.
- **Duplicate payment/transfer/trade reference** — reject under replay protection.
- **Exchange asset/market/route becomes ineligible** — block new affected execution while preserving historical records.
- **Bridge route or direction is suspended** — reject new affected bridge movement even if an adapter can still parse a proof.
- **Bridge proof is valid but risk limits are exhausted** — fail closed; proof validity does not override risk policy.
- **Bridge accounting mismatch** — record unhealthy reconciliation evidence and halt/escalate according to safety policy; do not automatically mint/burn/repair balances.
- **Emergency halt** — stop only the bounded domain affected; do not confiscate unrelated assets or rewrite settled history.
- **Derived service disagreement** — recover from canonical chain/protocol state outward, then rebuild projections.

## DOC-7.3 invariants

- **VALUE-001** — native `$420` is the chain currency and is not an ERC asset created by 420 Token.
- **VALUE-002** — TokenFactory's exact 42 `$420` creation fee is atomically forwarded to the configured community treasury; the factory does not retain the fee or token custody.
- **VALUE-003** — template disablement affects future factory deployments and cannot rewrite existing token code, balances or ownership.
- **VALUE-004** — payment identity binds invoice, payer, merchant, assets, amounts, quote and payer nonce; the same authorization cannot settle twice.
- **VALUE-005** — Pay validates quote freshness, fee identity, canonical settlement health and payer-defined limits before external settlement execution.
- **VALUE-006** — swap-backed Pay settlement must not spend more than the payer maximum or deliver less than the invoice settlement amount.
- **VALUE-007** — split/refund accounting must reconcile deterministically and cumulative refunds cannot exceed canonical refundable value.
- **VALUE-008** — Exchange execution requires current asset/market/route eligibility plus explicit scoped authorization; a UI listing or wallet connection is insufficient.
- **VALUE-009** — Exchange reference-oracle data is a sanity/circuit-breaker input and cannot unilaterally set executable market price.
- **VALUE-010** — atomic Exchange paths are bounded, path-hash committed and balance-checked; transient routing custody must not become persistent protocol custody.
- **VALUE-011** — an external asset is qualified for Exchange only while its live canonical Bridge chain/asset/route/adapter provenance remains valid.
- **VALUE-012** — Bridge route identity binds the external network, asset direction, adapter and verifier configuration rather than relying on a display symbol or chain number alone.
- **VALUE-013** — a bridge proof/attestation cannot bypass canonical asset, route direction, settlement-health, risk, safety or replay checks.
- **VALUE-014** — bridge reconciliation records supply health evidence but cannot mint, burn or repair user balances by itself.
- **VALUE-015** — emergency controls are scoped halts and cannot become confiscation or arbitrary history-rewrite authority.
- **VALUE-016** — Wallet, Indexer, Explorer, quote services and bridge/exchange providers are derived or operational surfaces and cannot manufacture canonical payment, trade or bridge finality.

## Related documentation

- [Core protocol architecture](index.md)
- [Protocol integration model](protocol-integration-model.md)
- [Gas, fees and native `$420`](../chain/gas-fees-native-420.md)
- [Transactions](../chain/transactions.md)
- [Wallet signing and transaction review](../../users/wallet/signing-and-transaction-review.md)
- [Oracle and external-provider infrastructure](../infrastructure/oracle-external-provider-infrastructure.md)
