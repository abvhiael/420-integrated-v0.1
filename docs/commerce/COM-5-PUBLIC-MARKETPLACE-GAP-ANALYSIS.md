# COM-5 — Public marketplace: initial repository-grounded gap analysis

Status: **IN PROGRESS — NOT QUALIFIED**. This document records discovery, not implementation evidence or a Level 1 PASS.

Canonical source: `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`, unchanged COM-5: “marketplace landing, merchant pages, product detail, browse/search, single-merchant cart, $420 checkout, supported swaps, receipts and accessible mobile design; Playwright and targeted integration gates.” Detailed UX/security acceptance: `COM-1.6-MARKETPLACE-STOREFRONT-UX.md` and `COM-1.7-SECURITY-THREAT-MODEL.md`.

Starting source: qualified COM-4 evidence HEAD `0cfa8cf2ee971b26d7010093d0cbbdfc8ef29d1f`; COM-4 implementation `594bd4e1e1554a1b8e34445eefd506765ffd9594`; PR #594 on `audit/420commerce-com-2-upstream-adaptations`; base at discovery `41d173dbcfbeb8299f54f22e7c049f1fec20336d`. Before qualification re-read the live PR/main refs.

## Existing foundations (do not duplicate)
- COM-3 already exposes anonymous public GET `/v1/storefronts`, `/v1/storefronts/{slug}`, `/v1/products/{id}`, `/v1/search`, `/v1/categories`, `/v1/products/{id}/availability`, and scoped public media via `commerce/src/http.mjs`.
- SDK `packages/420-sdk/src/commerce.ts` already defines public store/product/page types, a non-authoritative cart-line shape, and an order-plan type with `paymentAllowed: false`, `reserved: false`. Never reinterpret that plan as a paid order.
- `commerce/web/app.js`, `core/builder.js`, and `index.html` implement a private merchant builder, not a public shopper application. COM-4 explicitly hands public browse/cart/checkout to COM-5.
- Canonical Market V1 owns listing revisions, finite-stock reservations, orders, fulfillment/disputes; Pay owns merchant financial identity, invoice, payment and settlement; approved reporter alone marks Market paid. No parallel contract, invented receipt, or off-chain stock authority.
- Swaps are strictly optional and unavailable where no independently approved executable quote/route exists.

## Remaining COM-5 implementation and qualification inventory
1. Implement anonymous marketplace landing, merchant pages, product details, categories, browse/search facets, sorting/pagination and correctly sourced availability/freshness/error/degraded states. Escape all merchant content; do not present projections as authoritative real-time stock.
2. Implement a session-scoped **single-merchant** cart that tracks listing ID/revision, variant and exact quantity/asset, enforces merchant isolation, disables unsupported checkout combinations, validates limits and expires/revalidates stale estimates.
3. Implement server-side checkout prepare/revalidate and explicit Wallet reviewed Market `createOrder` authorization only after finalized merchant/listing/revision/stock/policy checks. Protect replay, double-click, wrong network/account, stale revision, oversell, fork/reorg, rejected transactions, idempotency and reload/resume. Do not treat submitted transaction as reserved order before canonical evidence.
4. Integrate approved Pay invoice/payment/settlement lifecycle **only** where the repository proves each authoritative capability; enforce invoice-before-payment, exact asset/amount/seller/recipient, finality and reporter state. Unsupported upstream flows must fail closed with a user-facing unavailable state rather than simulated success.
5. Supported Swap route only with actual verified quote, slippage/expiry and settlement adapter; absent quote means route unavailable. Native $420 first subject to canonical capability.
6. Receipt/tracking from canonical Market+Pay references, provisional vs finalized states, independently verified order/payment links and informative unavailable/reconciling states. No fabricated paid/verified badge.
7. Implement mobile-first responsive/accessible public screens, keyboard/screen-reader and axe checks, 320px flow, transaction review and pending/error/resume UX.
8. Extend SDK and service/Indexer/Search/RPC only as needed by real path contracts; add focused unit/integration/negative/security tests and real Playwright browser→signed API/SQLite/Wallet mock flows with exact implementation-SHA CI.
9. At the checkout authority integration milestone, run retained app-specific Level 2 Market/Pay/Commerce service/SDK/Indexer/browser tests without broad repository inventories. Record individual exit criteria, run IDs and SHAs. Defer full Solidity/Genesis/global/Docs to COM-7 Level 3.

## Current qualification truth
No COM-5 implementation or exact-SHA Level 1/Level 2 passing CI is established by this discovery record. COM-4 passes cannot be inherited as COM-5 acceptance. COM-5 remains **IN PROGRESS**, not COMPLETE. COM-6 Merchant operations is the next canonical step only after every COM-5 criterion passes. COM-8 live testnet and COM-9 mainnet remain separate blocked gates.

## COM-5 implementation work in progress — October 9, 2026
This is **not** a COM-5 qualification closeout. Preserve the original nine requirements above.

Implementation through `9363820ca1f50bdcab9a69a4f47e4f08e4e0bf5f`:
- Public storefront browsing, search/category/merchant filters, product details, sorting, pagination and single-merchant cart in `commerce/web/public.html`, `public.js`, `public.css`, and `public-core.js`.
- Explicit buyer action after signed API checkout prepare, independently revalidating the approved OrderRegistry, wallet, finalized Market order absence, listing revision/price and available stock, with RPC simulation and no-value contract call before wallet sends, in `commerce/web/buyer-order.js`. Successful broadcast says **NOT FINALIZED / NOT PAID** and requires a later canonical status refresh.
- Targeted `commerce/web/test/public.test.mjs` and `buyer-order.test.mjs` negative tests, plus static build inclusion.
- Existing authoritative backend already supplies buyer-scoped cart, prepare, Market order correlation, invoice and finalized reporter payment status. No Commerce-owned inventory/order/payment authority added.
- Latest builder CI run for the prior public-only candidate `7abc5162502685930ccef60bf287bf32a74bdf7b`: [37961527849](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37961527849) PASS. **Do not use this run as passing qualification of the later buyer-order SHA**. Later buyer-order candidate workflow [37961957723](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37961957723) was still queued at documentation writing; Commerce service [37961957852](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37961957852) queued. Missing or incomplete runs are NOT green.

Unresolved COM-5 exit criteria:
- Actual native $420 Pay invoice/payment authorization/settlement execution and independent status evidence beyond existing read-only correlation. Canonical invoice must be merchant-issued, and Pay settlement/finality governed; a buyer cannot silently mint an invoice or infer paid from a router transaction.
- Swap execution only if an independently approved canonical quote/route and expiry/slippage controls are available; otherwise fail closed. No unsupported quote or payment path is enabled.
- Browser end-to-end tests specifically exercising public shopper routes, buyer signing, reload/resume, accessibility and security; newly added focused unit tests do not replace these.
- Full exact-latest-SHA Commerce fast CI and app milestone retained Level 2 qualification, including checks currently queued. No Level 1/2 PASS claim on `9363820c`.
- Live RPC, Wallet, deployment and real transaction acceptance still belongs to COM-8, not mock CI.

Do not advance to COM-6 or merge the phase before closing these items. Level 3 full Solidity/Genesis/Integrated/Docs remains reserved for COM-7 accumulated phase closeout.

## Subsequent native Pay implementation and qualification state

Latest executable candidate in this handoff: `491ca1a43de75fbe7f5fa974233d2d5cd5c66654`. This is a candidate, NOT a qualified merge SHA. The branch is still PR #594, audit/420commerce-com-2-upstream-adaptations. Main at most recent verified PR reconciliation: `41d173dbcfbeb8299f54f22e7c049f1fec20336d`.

### Committed code
- `commerce/web/native-pay.js`: **two explicitly buyer-authorized native $420 stages**, Pay PaymentRegistry420.createPayment followed only after finalized matching SUBMITTED evidence by PaymentRouter420.executeNativeSplitSettlement (single primary recipient); both simulate before send, independently revalidate exact approved binding, onchain invoice/order, payout, account/network, replay and asset/amount. Both broadcasts deliberately remain NOT PAID. Verified live Pay and Market reporter status governs final receipt.
- `commerce/web/core/wallet.js`: optional approved Pay Router contract is validated by code hash, version and Registry component identity, not invented address. Missing binding fails closed.
- `commerce/web/public.js`: shopper-triggered stage-specific review and consent; no background sends, fabricated funding, or Pay success on broadcast.
- `commerce/src/service.mjs` + SDK: native zero-address representation allowed for upstream Market/Pay validation; buyer-scoped canonical order economic terms and finalized paymentId/receiptHash references for receipts.
- Security: native route additionally requires **independently approved SHA-pinned** native accepted-assets commitment `nativePayment.native420AcceptedAssetsHash` (plus `approved:true`) matching invoice, a simple zero-hash invoice settlement/tip plan, zero-hash merchant payout plan and current activated primary recipient. Absent proof is unavailable. Do not invent an accepted-assets hash.
- `commerce/web/test/native-pay.test.mjs`: authoritative RPC fixture regression for consent, wrong invoice/order/payout, missing router, premature settlement, replay, rejected signature and pending/paid distinction. `commerce/test/native-receipt.test.mjs` protects native asset semantics and unconfirmed receipt truth. `commerce/web/test/browser.mjs` exercises public shopping against real signed HTTP/SQLite and immutable projected listings, including mobile/axe.
- Swap routes remain explicitly **unavailable** without a qualified canonical executable quote, adapter, fee and expiry proof. No route is invented.
- No new custody contract, Commerce service ID, Genesis change or deployment.

### Qualification and nonclaims
A previous COM-5 service run [37962764866](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37962764866) exposed a genuine test-fixture failure `invalid_item_class`, not a protocol flaw: the new native-asset test passed an arbitrary bytes32 class instead of canonical Market PHYSICAL_GOOD. Corrected in commit `e2a109c0428600edab3cd2b7eec472109a92f9b1`. Superseded runs may be cancelled by subsequent implementation commits and are never final evidence.
Latest implementation candidate workflows were triggered: [builder 37963673340](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37963673340), [service 37963673248](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37963673248), [upstream 37963673046](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37963673046). At evidence writing they were pending/queued: **not PASS**. Prior passing runs apply only to prior SHAs.
Level 1 COM-5: **NOT YET QUALIFIED**. Level 2 app milestone: **NOT YET QUALIFIED**. Level 3 repository-wide inventory remains deferred to COM-7; COM-8 live acceptance still requires approved addresses, merchant-issued invoice and governed settlement/finality.

### Remaining completion gates
1. Verify exact candidate SHA and every required builder/service/upstream job and its completed steps. Diagnose and fix each real failure; changes to executable code force fresh exact-SHA qualification.
2. Full browser Wallet-to-Pay-to-Market payment lifecycle, seller-issued canonical invoice, buyer Pay creation/settlement, governed inclusion/certification/finality, approved reporter and matching receipt. Mock stages are not live network proof.
3. Obtain an independently approved same-chain manifest including Pay Router, native asset commitment and approved payout policy; source and document whether any Swap route has a qualified executable quote/fee/health adapter. Without those bindings, production financial controls **must remain disabled**.
4. Level 2 retained app-specific Market/Pay/Commerce/Indexer/SDK/browser qualification at integration milestone. Keep full global Solidity/Genesis/Integrated/Docs out of ordinary COM-5 step.
5. COM-5 must NOT be declared COMPLETE or COM-6 started solely from these committed sources.
