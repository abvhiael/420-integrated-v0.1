# COM-1.6 — Marketplace and storefront UX architecture

**Canonical step:** COM-1.6 — design merchant onboarding, storefront templates, product management, cart and checkout UX. **Phase:** COM-1, PR #588. **Status:** design complete, Level 1 CI pending. **Target:** `marketplace.420integrated.org`. This is a product/interface specification, **not** evidence that Commerce web routes, Cloudflare deployments or checkout are live.

## Product architecture and personas

V1 is a responsive, accessible branded Commerce client for (1) anonymous shoppers, (2) connected buyers, (3) canonical merchant controllers and properly authorized delegates, and (4) support/operations staff with read-limited access. Shoppers can browse without accounts; purchasing requires explicit Wallet authorization. Merchants customize storefront presentation and manage canonical Market offers, while Pay retains all invoice, payout, settlement and refund authority. An app administrator never becomes a financial custodian or merchant signer.

**Navigation:** public Marketplace / Categories / Merchants / Search / Store / Product / Cart / Checkout / Receipt; merchant Dashboard / Setup / Branding / Catalog / Listings / Orders / Fulfillment / Settings. Distinguish public store slugs from merchant IDs and economic seller addresses. Unknown or unpublished store URL returns a truthful not-found state.

## Public commerce journeys

| Screen | Content and actions | States and source |
| --- | --- | --- |
| Marketplace home | category rail, featured merchants/products, search, verified provenance only where present | loading, empty, error, stale data; published Commerce metadata + Market listing projections |
| Category/search results | facets, sorting, pagination, accessible result count | rebuildable Search/indexer; never claim real-time stock from search |
| Merchant store | branded banner/avatar/theme, about section, opt-in public location, merchant collections, canonical seller/payment provenance | owner-controlled presentation; no ungrounded certification badge |
| Product detail | gallery, description/options, price/quote asset, seller, availability timestamp, policy restrictions and disclosures | price/revision/stock from Market; unavailable or mismatch disables checkout |
| Cart | single-merchant line items, quantity, current estimated subtotal, remove/edit | non-authoritative session; no reservation; cart expiry and explicit refresh |
| Checkout | revalidate merchant, network, listing revision/price, canonical Market reservation, invoice, payment route and explicit wallet signature | staged; never sign Pay before valid order, never display paid on mere broadcast |
| Order tracking | chain-backed order ID/status, payment/settlement references, seller fulfillment commitment, private delivery handoff | distinct pending/reconciling UI labels vs canonical state |
| Receipt | Market order and Pay payment IDs, approved explorer links, price/asset, status provenance, refund/dispute route | final confirmation only after qualifying canonical finality and reporter evidence |

**V1 cart scope:** single merchant, fixed-price listed offers; cross-merchant checkout, auctions/subscriptions, complex taxes, shipping quotes and installment plans require separately qualified upstream capabilities. Variant availability maps to specific canonical listing IDs; no off-chain quantity promise supersedes a Market reservation.

## Merchant journeys and permission matrix

1. **Connect:** Wallet connects to verified chain and canonical Market/Pay service identities; wrong chain prompts safe switch without silently signing.
2. **Onboard:** resolve or register Pay merchant identity by actual controller; create branded Commerce tenant/store with scoped authorization and unique slug. App branding cannot change `MerchantRegistry420.currentPayout`.
3. **Design:** preview selectable accessible templates, avatar/banner, color palette, typography, navigation categories, SEO metadata and responsive breakpoint variations. Allow draft and published changes, versioned rollback and media content moderation/validation.
4. **Catalog:** merchant creates SKU, photos, descriptions and options in private draft; on publishing, seller explicitly signs canonical Market `createListing` or `reviseListing`, with valid policy, settlement adapter, expiry, item class and asset ref. A rejected chain mutation leaves the draft unpublished.
5. **Inventory:** display Market available/reserved/sold status with block/finality freshness; edit economic terms through Market only. Listing quantity cannot be silently revised in V1; avoid presenting an unsupported restock control.
6. **Operations:** permissioned order queue, filter by Market canonical statuses, customer support inbox, private shipping instructions, seller-signed `recordFulfillment`, buyer-signed completion, bounded dispute/refund request UI. No generic merchant button can change Pay refunds without canonical authorization.
7. **Settlement:** display Pay financial lifecycle/payout activation separately from merchant-store appearance; avoid claiming withdrawable balance based on a projection.

| Role | Public content | Draft/store settings | Publish Market listing | Authorize payment/payout | Fulfill/resolve |
| --- | --- | --- | --- | --- | --- |
| Anonymous shopper | Read | No | No | No | No |
| Buyer | Read | Own cart only | No | Explicit buyer-signed checkout only | Confirm own completion/dispute |
| Merchant controller | Read | Authorized | Seller signature or qualified delegated capability | Pay controller rights only | Seller-signed fulfillment, bounded dispute |
| Scoped store editor | Read | Only specifically delegated sections | No absent verified seller capability | Never by UI role alone | No absent explicit protocol right |
| Commerce admin/support | Read | Operational moderation under audit | Never by admin status alone | No custody or merchant signing | Read/status support, not contract override |

## Checkout state machine and confirmation copy

```text
CART (estimate)
  → VERIFYING LISTING / MERCHANT / NETWORK (re-read authoritative data)
  → ORDER SIGNATURE REQUESTED
  → ORDER SUBMITTED (not paid)
  → MARKET CREATED + RESERVED (only after chain-verified order)
  → MERCHANT INVOICE PENDING (canonical merchant action)
  → PAYMENT ROUTE / QUOTE SELECTION (42-second approved Swap quotes)
  → PAYMENT SIGNATURE REQUESTED
  → PAYMENT SUBMITTED / INCLUDED / CERTIFIED (not paid)
  → PAY FINALIZED / SETTLED (verify Pay evidence)
  → MARKET PAID (only authorized reporter)
  → FULFILLED / COMPLETED or DISPUTED / REFUNDED (Market authority)
```

Native $420-first checkout may use direct authorized Pay settlement; swap input is optional and must deliver the listing's pinned quote asset and exact economic amount. If Pay-to-Market settlement reporter bridge is absent, payment entry points stay disabled with an explicit “Checkout temporarily unavailable” explanation; browsing and drafts remain usable. Unknown status must render “Unable to verify payment” rather than success. Idempotency prevents duplicate button clicks from creating multiple orders or payments. Resume flow rechecks canonical state after browser reload/disconnect.

## Component, data and accessibility contracts

- **Global shell:** skip link, keyboard operable navigation, responsive menu, persistent search, breadcrumbs, clear wallet network display, source status indicator, offline/error retry.
- **Cards/images:** constrained aspect ratios, accessible alt text, media fallback, meaningful seller and price text; product media never treated as proof of availability.
- **Forms:** explicit labels, error summary/focus, required-field messaging, progressive validation, no color-only errors, proper autosave/unsaved-changes warning and draft preview.
- **Critical actions:** transaction simulation where available, explicit seller/buyer, chain/asset/amount, no blind signatures; show non-dismissible chain mismatch, slippage/quote expiry, and payment confirmation progress.
- **Responsive:** mobile-first 320px minimum design target, tablet and desktop layouts, 44px preferred hit targets, safe-area awareness; keyboard+screen-reader checks and reduced-motion support; WCAG 2.2 AA design target.
- **Content:** escape/sanitize rich text and media metadata; no unsafe HTML or public attachment links to PII. Private delivery addresses remain server-side, encrypted and merchant-scoped.
- **Trust:** “verified” badges require specific 420Verify provenance; names and display photos never override controller/payout addresses.
- **Locale:** support CAD/USD explanatory display only when exchange rate and quote source are explicit; settlement amounts always show precise chain denomination, not invented fiat guarantee.

## API contracts for implementation phases

Logical public reads: `GET /v1/storefronts`, `GET /v1/storefronts/{slug}`, `GET /v1/products/{id}`, `GET /v1/search`, `GET /v1/orders/{id}/status` (owner/subject authorized). Merchant writes: `POST/PATCH /v1/merchant/storefronts`, `POST/PATCH /v1/merchant/products`, `POST /v1/media/upload` with canonical wallet/controller and tenant binding; `POST /v1/checkout/prepare` performs only a verified plan/quote preview, **not** a hidden transaction or a chain-state mutation. These are **proposed API shapes**, not currently deployed endpoints; exact namespace/version ownership must be resolved with existing service conventions in COM-3. Return typed `loading/empty/degraded/error` envelopes, chain/projection provenance and freshness; authenticated APIs enforce authorization independently of UI.

## Deployment and test plan

- Framework/build selection must be grounded in the implemented `commerce/web` layout; do not assume Grow's `grow/web/dist` or Wallet scripts apply to Commerce.
- Cloudflare project/root/build/output/domain/TLS/CORS/secrets are **unverified** at COM-1.6; implement only after actual web project exists.
- Accessibility acceptance: anonymous browsing without wallet, keyboard/screen-reader flows, form error focus, mobile checkout legibility, contrast, reduced motion and status announcements.
- Adversarial UX acceptance: malicious media/text, stale listing revision, oversell, wrong chain, merchant spoof, revoked delegation, quote expiry/replay, split destination alteration, double-click, Pay included but not finalized, reporter unavailable, reorg, partial refund, outage, PII access across tenants.
- Progressive release: public browse/draft may be deployed independently of checkout. Unsafe financial controls disabled until COM-2/3 integration, COM-5 E2E, COM-7 security and COM-8 live testnet are qualified.
- Targeted Level 1 is documentation and consistency validation against Market/Pay/Wallet and prior COM-1 architecture. Level 2 at working interface/merchant milestone. Level 3 at COM-1.8 single exact-SHA phase closeout.

## COM-1.6 exit criteria

- [x] Map anonymous, buyer, merchant and support journeys and route inventory.
- [x] Define onboarding, templates, branding, catalog, publication, inventory, order and fulfillment UX.
- [x] Define cart, native $420 first, optional swap checkout, canonical status and failure states.
- [x] Specify authorization, privacy, accessibility, responsive and deployment constraints.
- [x] Specify implementable API, component and adversarial acceptance handoff to COM-3–7.
- [ ] Exact-SHA automated CI conclusion: verify separately; no premature PASS claim.

**Next canonical step: COM-1.7 — Security model and threat assessment.**
