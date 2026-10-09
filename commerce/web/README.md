# COM-4 merchant storefront builder

Canonical scope: COM-4 — Merchant storefront builder: wallet-backed onboarding,
avatar/banner/theme, app-wide and merchant-controlled categories, listings/variants,
stock and preview/publish; UX/integration qualification.

Static ES modules bundled with esbuild; no framework or remote scripts. Uses the
retained typed 420 SDK and an EIP-1193 provider supplied by 420Wallet or a compatible
Wallet browser. It creates no Wallet service ID or financial authority.

## Build and run qualification

From repository root, install locked dependencies in `commerce`, `commerce/web`
and `packages/420-sdk` with `npm ci --ignore-scripts`. Build the SDK, then run
`npm run qualify --prefix commerce/web`. Install Chromium with
`cd commerce/web && npx playwright install --with-deps chromium` beforehand.
`COMMERCE_CHROMIUM_PATH` optionally selects an existing Chromium executable for
restricted local environments; CI uses Playwright's pinned browser. Missing browser,
failed accessibility, absent checks or skipped required tests fail qualification.
The service suite additionally runs through `scripts/commerce/qualify-service.py`
for canonical consumed ABI compatibility and retained Indexer/SDK/service coverage.

Builder CI checks the exact implementation SHA, locked dependency audit, build,
lint, Wallet adversarial tests and real signed browser → SDK → HTTP → file-backed
SQLite integration. RPC/Wallet fixtures are explicitly mocks; no live evidence.
The app-focused Level 2 merchant milestone combines builder and service gates,
plus the retained COM-2 Market/Pay reporter gate on the same implementation SHA.
No full repository Foundry or Genesis inventory is run here.

## Approved deployment configuration

Default build is intentionally unconfigured, with signing disabled. There is no
shipped testnet/mainnet address or deployment claim. An operator supplies
`COMMERCE_WEB_MANIFEST` and its independently approved exact
`COMMERCE_WEB_MANIFEST_SHA256`; wrong/missing digest fails a configured build.
The manifest is schema `420-commerce-web-v1`, with `origin`, same-origin root
`apiUrl`, decimal `chainId`, approved `registry: {address, codeHash}`, and the eight
existing contract bindings consumed by the service. Each contract has
`address`, `codeHash`, `version` (display string), `versionResult` (raw canonical
ABI result), `verified: true`; Pay components additionally have canonical
`componentId` and exact three-number `registryVersion`. Local HTTP is accepted
only for explicit `environment: local` at `127.0.0.1`. Production uses HTTPS.
Do not include server secrets, delivery encryption keys or private API keys.

This defines the real project root `commerce/web`, build command
`npm run build` (after SDK build), and output `commerce/web/dist`. These are
repository build facts, not a Cloudflare project/domain deployment. The Cloudflare
project, live chain/RPC/addresses, DNS/TLS and service binding remain unverified.
Use a same-origin reverse proxy for `/v1/` to the private service. Preserve the
configured Host and enforce TLS. The service uses no cookie authentication;
protected browser GET uses exact Host + same-origin Fetch metadata when the
browser omits Origin, while retaining the signed origin/method/path/body/nonce.
CSP allows only bundled self scripts/styles, self API, self/blob images; no remote
media URLs, inline scripts, HTML rendering or external font resources.

## Merchant journey

1. Explicitly connect; each signing action rechecks selected account/network,
   finalized freshness, Registry/code/version. Wrong chain offers an explicit
   switch, without adding an invented network or requesting a signature.
2. Resolve Pay merchant ID; existing controller can resume the durable tenant.
   Unregistered merchant can review canonical `register` and its payout address.
   Cancellation/rejection leaves no new merchant or automatic tenant. Broadcast
   remains pending; resolve again after finality before creating the store.
3. Save sanitized avatar/banner and descriptions in private drafts. Choose one of
   three accessible palette/font templates. App-wide taxonomy is read-only;
   merchants create/edit/reorder/hide their own bounded collection menu.
4. Save SKU, description, gallery, category and variant options. Each variant
   can bind a distinct owned canonical listing. No variant aliases product stock.
5. Review canonical `createListing`/`reviseListing` with named controller, chain,
   target, asset, exact base-unit price, quantity, expiry, policy/adapter and committed
   product metadata. Only explicit confirm asks Wallet for the zero-value
   transaction. Calldata is independently encoded and checked. Fresh state and
   simulation precede send; expired/revoked/changed/replayed authority is rejected.
   V1 quantity remains immutable on revise; there is no restock override.
6. After canonical finality, explicitly bind exact listing revision/metadata and
   publish product. Mere broadcast or rejection never publishes it. Stock reads
   display canonical available/reserved/sold counts and finalized block provenance.
7. Preview responsive/mobile/tablet designs. Store publication pins saved branding
   and every collection version; a concurrent edit causes a conflict. Draft changes
   stay private while the last released design is public. Historical released
   branding can be restored into a new draft, then explicitly republished. Product
   publication remains independent; saving an existing product as draft withdraws
   that product, as the editor explicitly explains.
8. Controller may grant/revoke short-lived presentation scopes. Scoped editor reads
   and buttons match server-granted scopes; it cannot publish or gain Pay authority.

Wallet change/disconnect clears all private form values, options, image URLs,
previews and pending plans. There is no browser persistent customer/tenant cache.
Forms show focused errors, live status, offline state and unsaved-change warning;
critical actions serialize. Keyboard skip link, labelled controls, 44px targets,
320px wrapping, contrast and reduced-motion styling are qualified. Automated axe
checks complement keyboard/mobile flows; they do not replace COM-7 independent
review or COM-8 live Wallet/network/deployment acceptance.

Public marketplace/cart/checkout belongs to COM-5; orders, payout/refund,
fulfillment and operations belong to COM-6. Full Solidity, separate Genesis address
authority, Integrated/global, Docs/global and comprehensive security closeout stay
at COM-7/phase Level 3. COM-8 live/testnet and COM-9 mainnet authorization stay blocked.
