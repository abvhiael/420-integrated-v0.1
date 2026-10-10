# COM-6 — Merchant operations API and SDK integration

**Canonical roadmap:** COM-6 Merchant operations — orders, settlement display, authorized refund workflow, analytics, notifications, credentials/names, dispute handoff and developer examples. **Status: partial implementation, pending exact-SHA CI and external integrations.** This is a branded Commerce application; Market and Pay are the only chain authorities.

## Implemented application-scoped operations

A seller/controller connects an approved Wallet using the existing signed Commerce SDK. Commerce requires the same-origin signed HTTP challenge and a fresh canonical merchant controller check; **editor delegates are not permitted to view financial operations**, even if granted branding/catalogue rights.

- `GET /v1/merchant/storefronts/{storeId}/operations/orders` — first 25 checkout attempts for an authorized store, read through canonical Market/Pay finalized status, with order ID, payment state, invoice/payment commitment where available and source provenance. This is explicitly paginated/limited and is *not* an invented on-chain order index.
- `GET /v1/merchant/storefronts/{storeId}/operations/analytics` — first 100 attempts only; returns `partial`, explicit sample scope, order counts and **asset-separated** paid/refunded base unit totals, avoiding any unsupported FX aggregation or unfinalized revenue.
- `GET /v1/merchant/storefronts/{storeId}/operations/integrations` — fail-closed status of 420Identity, 420Verify, 420Names, 420Notifications, 420Search and 420Analytics external bindings, explicitly NOT_VERIFIED or NOT_CONFIGURED when none is approved; no spoofed credential or delivery.
- `POST /v1/merchant/storefronts/{storeId}/operations/orders/{attemptId}/refund` — canonical Pay refund handoff eligibility, only when canonical paid/finalized invoice/payment is proven; **does not issue refunds, sign on behalf of the merchant, or invoke governance**.
- `POST /v1/merchant/storefronts/{storeId}/operations/orders/{attemptId}/dispute` — restricted dispute handoff eligibility to Market/420Arbitration; **no disposition, dispute creation or transfer executed**.

The browser `commerce/web/operations.html` (bundled `operations.js`) renders those endpoints, with accessible tables-as-lists, mobile layout, explicit order/payment truth and no fabricated financial action. Existing builder and marketplace link to it. The SDK exposes `merchantOperations`, `merchantAnalytics`, `merchantIntegrations` and `merchantRemedy`.

## Developer example (SDK)

```ts
import { createCommerceSdk420 } from '@420/sdk/commerce';
// Inject a verified Wallet + pinned chain manifest; do not embed signing keys.
// Use the SDK constructor and WalletSession patterns from commerce/web/app.js.
const sdk = createCommerceSdk420({ baseUrl, origin, chainId, wallet, host });
const operations = await sdk.merchantOperations(storeId);
const analytics = await sdk.merchantAnalytics(storeId);
const adapters = await sdk.merchantIntegrations(storeId);
if (operations.provenance.finalized) {
  for (const order of operations.items) console.log(order.orderId, order.state, order.paid);
}
if (adapters.notifications.status !== 'CONFIGURED') {
  // Display an unavailable state; do NOT claim a notification was dispatched.
}
const handoff = await sdk.merchantRemedy(storeId, attemptId, 'refund');
if (!handoff.executed) {
  // Refer seller to governed Pay support workflow. No balance has changed.
}
```

## Exit-criterion / dependency matrix

| Requirement | Evidence | Status |
| --- | --- | --- |
| Merchant orders and settlement display | Signed owner-only operations, canonical `status` and finalized provenance | Implemented; CI pending |
| Authorized refund workflow | Eligibility + canonical Pay governance handoff, no unauthorized writes | Partial: no governed submission/approval execution |
| Analytics | Bounded owner-only first-100 aggregation, per asset and partial marker | Implemented preview; full pagination/time series/420Analytics integration missing |
| Notifications | Explicit unavailable status | Blocked: no approved Notifications transport/registration/opt-in delivery |
| Credentials/names | Explicit NOT_VERIFIED; no false verification | Blocked: no approved Identity/Verify/Names read adapters |
| Dispute handoff | Permission-controlled governed Market/Arbitration eligibility | Partial: no signed canonical dispute lifecycle |
| Developer examples | SDK usage above | Implemented basic example |
| Browser accessible dashboard | operations.html/js plus Playwright mock Wallet/real HTTP/SQLite test | Pending exact-SHA completion |
| Live acceptance | Main/testnet deployment and approved addresses | Deferred to COM-8 testnet |

## Security and qualification

Do not use SQL totals as authoritative bank balances; `paid` derives from canonical Market/Pay correlation. No cross-merchant read or delegated financial access; no browser private key, wallet auto-sign, fabricated recipient, mutation of canonical payment/refund or dispute state. No production support/service impersonation. Test suite `commerce/test/com6-merchant-operations.test.mjs` checks owner/IDOR, nonfinality, sums, refund/dispute fail-closed semantics and optional adapter states; Playwright checks the merchant operations screen with real HTTP/SQLite and simulated Wallet.

**Level 1:** targeted commerce service, SDK/Indexer and builder/browser CI only, plus pre-existing directly relevant upstream workflow triggered by branch paths. Exact SHA and run IDs must be written only after completion. **Level 2:** broader Commerce/Market/Pay app integration at a meaningful completed milestone (not substituted by Level 1). **Level 3:** defer to COM-7 app-phase closeout; Solidity owns full Foundry inventory; Genesis owns address authority without duplicate Foundry.

**Remaining blockers:** canonical external notification, names/credential proof, governed refund/dispute execution path, complete all-order analytics, payment-testnet acceptance, Level 1 full green and Level 2 retained milestone evidence. **Do not mark COM-6 COMPLETE until individually satisfied.**

**Next canonical roadmap step after completing COM-6:** COM-7 Security/ops.

## COM-6 Level 1 exact-SHA qualification (2026-10-09)

Implementation SHA: `16787cb83ec3c65ef1f9ec96234f74c8913ed603`.
PR #594 (`audit/420commerce-com-2-upstream-adaptations`), draft and unmerged; verified PR base `41d173dbcfbeb8299f54f22e7c049f1fec20336d`.
The preceding browser-failure candidates are **NOT** PASS evidence. Root causes were asynchronous Wallet-connect ordering, missing EIP-1193 mock injection in the new browser page, and an actual 320px overflow from long chain identifiers. Corrected without disabling checks or weakening assertions.

- Commerce merchant builder fast qualification: [37972080672](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37972080672) — **SUCCESS**; exact-SHA build, lint, Wallet security/unit regressions and Playwright browser + accessible responsive dashboard.
- Commerce service fast qualification: [37972080647](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37972080647) — **SUCCESS**; affected service, SDK/Indexer, new COM-6 owner/IDOR/refund/accounting checks, adversarial and patch verification.
- Commerce upstream contracts: [37972080665](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37972080665) — **SUCCESS**; affected retained Market/Pay contract checks (not full repository Foundry).

**Level 1 for the implemented COM-6 repository-side changes: PASS.** This does **not** establish that all original COM-6 acceptance criteria are fulfilled. Remaining missing requirements are exactly those in the exit-criterion matrix above; overall canonical COM-6 remains **PARTIAL / BLOCKED**. Level 2 app milestone **not run**, and Level 3 phase closeout deliberately **not run**.
