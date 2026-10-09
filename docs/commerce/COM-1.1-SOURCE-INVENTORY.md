# COM-1.1 — Repository source and interface inventory

**Status: COMPLETE for targeted repository discovery; not a declaration that COM-1 or live integration is qualified.**
**Evidence baseline:** PR #588 branch `commerce/com-1-architecture-reconciliation`, sourced from main at `ffc6a4028676907c266714b5c1ae8ba3af9a7137`. Source inspections are GitHub authenticated file reads on this branch. **No running testnet, deployment, or Cloudflare website has been verified.**

## Actual source inventory and constraints

| Source | Existing real functionality | Commerce consequence |
| --- | --- | --- |
| `docs/420-MARKET-V1-MODEL.md` | Frozen Market V1 state, listing revision, inventory, payment finality semantics | Cannot redefine Market states or custody. |
| `contracts/src/market/MarketPolicyRegistry420.sol` | Governed policy and settlement-adapter registration; `setPolicy`, `setSettlementAdapter`, `policyActive`, `settlementAdapterActive`, `isSettlementReporter` | Checkout must use allowed policy and reporter; do not create new registry. |
| `contracts/src/market/ListingRegistry420.sol` | `createListing`, `reviseListing`, `cancelListing`, `getListing`, `getListingRevision`, `listingAvailable`; seller, profile, class, asset ref, metadata hash, policy, sale mechanism, settlement adapter, quote asset, unit price, quantity, expiry, revision, active | Product listings use canonical ID/revision and metadata commitments; images, full description and collections remain off-chain. |
| `contracts/src/market/InventoryReservation420.sol` | `reserve`, `release`, `consume`, `available`, `conserved`; order-only release/consume, governed order registry binding | Stock reservation comes from canonical inventory; off-chain catalog stock display is only a projection. |
| `contracts/src/market/OrderRegistry420.sol` | `createOrder`, `recordPayment`, `recordFulfillment`, `completeOrder`, `cancelOrder`, `disputeOrder`, `recordRefund`, `orderStatus`; fixed V1 enum `NONE CREATED PAID FULFILLED COMPLETED CANCELLED DISPUTED REFUNDED` | Extra UI states pending/confirming/shipped etc. are application projections, not new chain states. |
| `contracts/test/Market420.t.sol` | Tests revisions, revision inventory limits, inactive policy, no oversell, cancellation release, completion consume, authorized payment reporter, dispute settlement refund | Existing baseline tests must remain canonical owning tests. |
| `contracts/src/pay/MerchantRegistry420.sol` | `register`, `setStatus`, `schedulePayout`, `currentPayout`, profile IDs and payout versions | Merchant finances and payout mutation use Pay, branded storefront profile is separate. |
| `contracts/src/pay/PaymentRouter420.sol` | `executeSwapSettlement`, `executeSwapSplitSettlement`, `executeDirectTokenSplitSettlement`, `executeNativeSplitSettlement`, shared replay and health checks | Reuse Pay router with canonical adapters; validate that Market reporting wiring is implemented before real checkout. |
| `docs/420PAY-IMPLEMENTATION-STATUS.md` | Describes Pay invoice registry, payment state, settlement router, refunds, gas sponsor, accounting and swap-bound settlement adapters | Do not recreate these contracts. Live Genesis binding explicitly remains unqualified. |
| `contracts/src/libraries/ServiceIds420.sol` and `docs/420WALLET-W14.5-APP-CATALOG.md` | Canonical IDs; Commerce has no distinct canonical service ID | Treat Commerce as branded application unless governance separately authorizes a service identity; no invented Wallet manifest. |
| `config/genesis-applications.json` | Frozen Genesis decision | Do not alter Genesis catalogue just for Commerce. |
| `contracts/config/genesis-dapp-contract-map.json` | Existing Genesis contract inventory | Reuse authoritative contract ownership map for additions. |
| `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` | Shared public business locations, events, geosearch and privacy | Optional merchant location links remain opt-in and projection-only. |
| `wallet/web/package.json` | Node >=22, JS test/check scripts and testnet qualification script; no generic `build` script | Do not assume wallet build applies to Commerce. |
| `grow/web/package.json` and `grow/web/README.md` | Node >=22, `npm run qualify`, `npm run build`, output `grow/web/dist`; static read-only site uses fail-closed runtime config | Useful proven minimal app pattern, **not** automatically Commerce's root/build/output or write architecture. |
| `contracts/foundry.toml` | Solidity 0.8.24, Cancun, optimizer/via-IR and canonical `contracts/test` layout | Foundry qualification belongs to owning workflow. |

## Interface implications / actual gaps for COM-1.2–1.7

- **Existing native order state:** Market's seven active values, not the longer proposed UI lifecycle. Shipping/cancellation requests, refund pending and payment submitted must remain derived/UI/service state unless a governed V2 model changes the chain protocol.
- **Payment integration:** Source confirms Market settlement-reporter authorization and Pay router settlement operations, but **does not yet prove the actual runtime adapter tying Pay finality to Market `recordPayment` and `recordRefund`**. Explicit dependency for COM-1.5; do not mark checkout live.
- **Catalogue presentation:** No independent Commerce product media/storefront service is established by these inspected files. New off-chain merchant branded catalog, media, taxonomy/collections and role-managed dashboards are justified, provided Market remains source of listing and reservation truth.
- **Merchant ownership:** Pay's `MerchantRegistry420` handles canonical financial identity/payout; storefront branding, operator permissions and public contact privacy require further specification and authenticated authorization.
- **Chain registration:** Commerce branded app has no separate canonical service ID. Distinct registry service creation is a governance/Genesis identity decision, not routine UI plumbing.
- **Build/deployment:** `grow/web` static build is an example only. Commerce has no verified build command, Cloudflare output root or live domain configuration at COM-1.1. Define in COM-1.6 after selecting framework.
- **Security:** avoid off-chain authoritative inventory, fake signed purchase completion and a duplicate financial ledger; special attention to revision races, reorgs, payment proofs and customer PII.

## COM-1.1 acceptance checklist

- [x] Inspect frozen Market specification and actual Market source interfaces.
- [x] Find and inspect existing Market focused test suite.
- [x] Inspect Pay merchant registry and payment router source, and Pay current implementation status.
- [x] Inspect Wallet service-ID source and unresolved Commerce service identity.
- [x] Inspect frozen Genesis app catalogue and contract map.
- [x] Inspect an existing frontend build contract and foundational Foundry configuration.
- [x] Identify Commerce-scope new services versus canonical ownership and unknown runtime integrations.
- [x] Record testnet/mainnet blockers and deployment unknowns accurately.
- [ ] **Targeted automated qualification on this evidence commit:** pending workflow evidence; COM-1.1 documentary discovery complete, CI result separately gated.

**COM-1.1 outcome:** targeted inventory finished. **Next COM-1.2:** authoritative dependency map and service-identity decision, then COM-1.3 full ABI-level integration and edge transition mapping. No COM-1 Level 3 claim and no mainnet authorization.
