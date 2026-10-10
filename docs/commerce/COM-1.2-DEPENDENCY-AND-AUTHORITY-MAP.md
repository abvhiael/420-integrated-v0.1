# COM-1.2 — Protocol requirements, canonical ownership, and ecosystem dependency mapping

**Roadmap identity:** COM-1.2 (no renumbering). **Status:** implementation COMPLETE; Level 1 CI evidence PENDING. **PR:** #588. **Reconciliation base:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137` (compare returned ahead 2/behind 0 before this change).

## Purpose and acceptance requirements

Freeze a coherent, source-grounded dependency/authority map for the branded Commerce marketplace application. Preserve Market V1 and Pay’s financial authority; identify every material ecosystem dependency, source of truth, failure behaviour and subsequent implementation owner. Explicitly resolve whether Commerce needs a new canonical service ID. This step is an *architectural decision*, not authorization to modify frozen Genesis registries or implement financial contracts.

### Decision COM-1.2-D1 — application versus canonical protocol

**420Commerce V1 is a branded, noncanonical storefront/commerce-orchestration web application** consuming canonical **420 Market** and **420Pay**. It MUST NOT mint a new `ServiceIds420` entry, impersonate Market/Pay, edit the frozen Genesis application decision, or self-register an official Wallet launch manifest. The consumer app may be distributed at `marketplace.420integrated.org` once its ownership, deployment, and security are validated, but a DNS address does not confer protocol authority. If a *distinct canonical* Commerce protocol role is later required, propose a governed, versioned registry/service design with compatibility and security review; it is **not** a COM-1.2 mutation. This resolves the product positioning while keeping the distinct service-ID request explicitly deferred rather than silently approved.

Normative evidence: `docs/420-MARKET-V1-MODEL.md`, `docs/420PAY-IMPLEMENTATION-STATUS.md`, `docs/420WALLET-W14.5-APP-CATALOG.md`, `contracts/src/libraries/ServiceIds420.sol`, `config/genesis-applications.json`, `docs/architecture/protocols/protocol-integration-model.md`.

## Requirement-to-authority traceability matrix

| Requirement | Canonical authority / evidence | Commerce-owned scope | Dependency / fail-closed rule |
| --- | --- | --- | --- |
| Listing ownership, revisions, immutable order economics | 420 Market: `ListingRegistry420` | Form/editor; listing metadata and media projections | Cannot publish/checkout against missing/inactive/expired policy or listing/revision. |
| Finite stock and atomic reservation | 420 Market: `InventoryReservation420` | Available-stock presentation; checkout orchestration | Checkout disabled when authoritative reservation cannot succeed; no separate authoritative counter. |
| Order state and fulfillment commitments | 420 Market: `OrderRegistry420` | UI pending/shipping states, private fulfilment data | UI states are derived; never mutate terminal canonical states by frontend status. |
| Policy and approved settlement reporter | 420 Market: `MarketPolicyRegistry420` | Query/validate admission for a checkout option | Unsupported adapter / reporter: fail closed. |
| Merchant financial identity, payout versions | 420Pay: `MerchantRegistry420` | Branded storefront profile and merchant administration UX | Controller and payout binding verified at action time; profile visuals confer no payout control. |
| Invoice, payment authorization and lifecycle | 420Pay: invoice/payment registries and `PaymentRouter420` | Checkout/session and receipts | Payment not finalized because wallet signed, broadcast, or one block included. |
| Settlement, splits, refunds and fee sponsorship | 420Pay settlement/refund/sponsor authorities | Display verified accounting and expose only authorized requests | Never create Commerce custody/ledger/competing refund routes. |
| Alternative-token checkout | 420Swap + Pay canonical swap/settlement adapters | Quote display with expiry, price impact, slippage and authorization | Route, health, slippage or liquidity unavailable: disable alternative asset, preserve native checkout if independently safe. |
| Wallet execution, capabilities | 420Wallet / Smart Accounts / Capability Registry | Wallet connection and least-privilege request UX | Connection alone does not grant contract or merchant mutation rights; no app keys or auto-sign. |
| Protocol identity/version, canonical discovery | 420Registry / `ServiceIds420.sol` | Resolve Market and Pay under verified manifests | Missing/unverified registry manifest: no invented launch or endpoint. |
| Identity and merchant-name display | 420Identity, 420Names | Optional profile enrichment and user-confirmed name/address display | Do not treat name/avatar as verified payout destination. |
| Credential claims and source verification | 420Verify | Provenance markers with precise meanings | Verification cannot be represented as insurance, merchant endorsement or an audit. |
| Dispute disposition | Market dispute state + bounded 420Arbitration | Customer/support submission workflow | Arbitrator cannot directly seize/reverse money absent canonical Pay remedy. |
| Merchant notifications | 420Notifications | Opt-in messaging and event projection | Delivery never changes order or payment truth. |
| Search/product discovery | 420Search and rebuildable search indexes | Product/category metadata, storefront index, filtering | Index unavailable means discovery degrades; no phantom listings. |
| Analytics and dashboards | 420Analytics / verified Market-Pay state | Per-merchant KPIs, private reports | Statistics never override financial/accounting truth. |
| Places/business geography | GEN-SVC-2 420Location/Events | Optional public business location display | No precise private coordinates or inferred private address publication. |
| Registry-class rights and digital assets | 420Rights/420Token/420ResourceProtocol when needed | Listing metadata and verified entitlement links | Listing/fulfillment does not automatically transfer title, license or rights. |
| Bridged assets | 420Bridge, Pay/Swap approved integrations | Future display of eligible settlement methods | Not assumed available; fail closed without approved safe route. |
| Governance and Treasury | 420Governance / 420Treasury | Governed fee/parameter readouts, audit references | No merchant-admin privilege to mutate governance or treasury. |
| Seller page, logo, banner, navigation and images | Commerce application (off-chain) | Templates, secure media storage, merchant menus | Never write private/customer or large media data into public chain state. |
| Store content authorization and customer PII | Commerce backend plus canonical account/merchant proofs | Per-tenant ACL, consent/privacy, retention and audit trail | Public read surface cannot escalate merchant write rights or expose shipping data. |

## Dependency graph

```text
420Commerce Web (public store + merchant dashboard)
 ├─ Commerce off-chain API/storage (branding, product metadata, carts, tenant ACL)
 │   ├─ rebuildable projections ← Market/Pay events → indexer
 │   ├─ 420Search / 420Analytics / 420Notifications / 420Location (optional)
 │   └─ private customer/shipping data (never public chain state)
 ├─ 420Wallet + Smart Accounts / capabilities (user authorization)
 ├─ 420Registry verified discovery → Market and Pay canonical service IDs
 ├─ 420Identity / 420Names / 420Verify (optional provenance)
 └─ Checkout orchestration
     ├─ 420 Market: Policy + Listing + Inventory + Order registries
     ├─ 420Pay: Merchant + Invoice + Payment + Settlement + Refund
     ├─ 420Swap (optional approved swap route)
     └─ 420Arbitration (bounded dispute outcome only)
```

## Invariants and conflict decisions

1. Market V1 order states remain `CREATED`, `PAID`, `FULFILLED`, `COMPLETED`, `CANCELLED`, `DISPUTED`, `REFUNDED` (plus `NONE` sentinel). Payment pending, swap pending, shipping and refund-requested are noncanonical UI/service states.
2. No Commerce merchant registry, listing/order contract, inventory reservation authority, payment router, settlement ledger, refund executor, Wallet signer, Registry or identity authority.
3. A listing's exact revision and economic terms must be pinned before economically binding checkout; insufficient or stale stock/order terms must fail.
4. Market `recordPayment`/`recordRefund` must have verified, approved reporter evidence. Integration correctness is **unproven** until COM-1.3/1.5 and live COM-8 tests; never infer it from source interfaces alone.
5. Financial, authorization, identity and discovery dependencies do not promote another component's metadata to canonical privilege.
6. Service outages affect only dependent operations; no silently weakened policy, substitute payout account or fake confirmed transaction.
7. No customer shipping PII, private documents or location precision escalation on chain or public product search.

## Dependency priority, scope, and milestones

- **Hard for checkout:** verified 420Registry discovery of Market/Pay, active Market policy/adapter, authoritative listing/inventory/order, wallet authorization and Pay settlement proof. 420Swap is conditional only for alternative-token checkout.
- **Hard for storefront write:** authenticated merchant controller, bounded operator permissions, tenant isolation and durable off-chain store state; optional names/credentials are not wallet authorization.
- **Soft for browsing:** 420Search, Analytics, Notifications, Location, optional verified badges. Fail visibly/degrade without asserting absent data or fabricating results.
- **COM-1.3:** inspect exact ABI/state constraints; document any missing Pay→Market reporter bridge and versioned owning-protocol remediation proposal.
- **COM-1.4:** decide schemas, event ingestion, reorg recovery, media/privacy and ACL.
- **COM-1.5:** explicit adapters, security checks, and verified manifest semantics.
- **COM-1.6:** real application UI/build/deploy design.
- **COM-1.7:** threat model and audit.
- **COM-1.8:** COM-1 Level 3 only once accumulated work and appropriate checks qualify one exact candidate. COM-8 live testnet and COM-9 mainnet stay separate blocked handoffs.

## COM-1.2 Level 1 scope and evidence

**Change class:** documentation-only architecture; no runtime, code, tests, deployed addresses, Genesis policy, frozen parameter, ABI or workflow modification. Review step by checking every owned authority and cross-link against current repository source; verify that `ServiceIds420.sol` contains no Commerce ID, the Wallet document records unresolved identity, and the frozen Market V1 model is unchanged. No Foundry or global CI is justified by this isolated change.

**Evidence policy:** No CI PASS until an exact-SHA run is actually observed. GitHub file read/commit presence is documentary verification, not a substitute for a required automated verifier. Level 2 deferred to architecture integration boundary as applicable; Level 3 deferred to COM-1.8. No testnet deployment/production claim.

**Next canonical step:** **COM-1.3 — Smart contract architecture** (ABI/state-transition reconciliation, not a second marketplace contract).
