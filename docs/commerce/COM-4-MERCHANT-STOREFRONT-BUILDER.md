# COM-4 — Merchant storefront builder

Canonical source: `COM-1-ARCHITECTURE-AND-ROADMAP.md`, COM-4 (unchanged purpose and
number); architecture handoff `COM-1.6-MARKETPLACE-STOREFRONT-UX.md`, adapters
`COM-1.5-ECOSYSTEM-ADAPTER-DESIGN.md`, security `COM-1.7-SECURITY-THREAT-MODEL.md`,
frozen Market V1/Pay sources and committed COM-2/3 qualification. Status:
COMPLETE at Level 1 and the merchant-builder Level 2 milestone; exact-SHA evidence
in `COM-4-QUALIFICATION-EVIDENCE.md`.

## Repository discovery and gap analysis

Started from qualified COM-3 evidence HEAD
`c5fddf086e2f36bb84c98bed64b0e5ebbe975e2d`, implementation
`49c5875d35cd205a8c58634d7ecf1a4ba2ae99b1`, draft PR #594/audit branch
`audit/420commerce-com-2-upstream-adaptations`. Current main discovered at
`41d173dbcfbeb8299f54f22e7c049f1fec20336d`, 335 commits beyond the prior base
`0ec695481fc84e6066aeae50baf6e0fd3c7f8731`. Those commits added Grow V2 paths and
Go dependencies; they did not change Commerce's contracts/service/SDK interfaces.
Reconciliation merged cleanly, preserving all valid qualified work. This is an
app-scoped UI/API/SDK/migration addition; no Solidity source, Genesis membership,
frozen address map, custody or service identity changes.

| Original requirement | Existing state | Remaining work / resolution |
| --- | --- | --- |
| Wallet-backed onboarding | COM-3 signed API, canonical controller checks; no web onboarding/registration review | EIP-1193 explicit connect/switch, fresh code/version/Registry verification, Pay register review, durable controller tenant resume |
| Avatar/banner/theme | Safe upload/branding API present; no UI; published stores exposed current branding | Private image chooser, three accessible palette/font templates, description/SEO preview, atomic draft/released-design separation |
| App-wide and merchant categories | Taxonomy/menu ACL and bounded ancestry present | Read-only global taxonomy plus linked/reordered/hidden merchant collections, version-pinned publication |
| Listings/variants | Draft metadata and distinct listing bindings present; no seller transaction UX | Product/gallery/variant editor, canonical create/revise plans and named-term Wallet review; failed/rejected/stale mutations leave draft unpublished |
| Stock | Public product stock read present; private merchant read absent | Seller-bound finalized listing/available/reserved/sold read; no invented restock or shared stock alias |
| Preview/publish | API versions present; no preview or released-design history | Responsive/mobile/tablet preview, explicit product binding then store release, historical branding restore to a new draft, conflict checks |
| UX/integration qualification | Retained COM-3 service/Indexer/SDK and COM-2 tests | Fast builder exact-SHA CI, actual browser→SDK→signed HTTP→SQLite, Wallet negative tests and axe/keyboard/320px acceptance; retained milestone gates |

Browser GET's forbidden Origin behavior was a real client/API integration gap;
fix uses exact Host + same-origin Fetch metadata only for signed GET without an
Origin. Server authentication still independently verifies origin-bound message,
wallet, nonce, method/path/body, expiry and tenant/current controller. No cookies,
credential broadening or admin financial rights. Legacy immediate category visibility
assertions were updated to check private draft first, then explicit release.
Shared avatar/banner selection is valid safe media reuse; product-manifest duplicate
checks remain intact. The local CDN browser download failed as an environment issue;
locally installed Chromium was used, while CI must install its pinned Playwright
Chromium. Accessibility context setup was corrected without suppressing rules.
Mobile long IDs were wrapped rather than hiding overflow. A low-severity esbuild
advisory was fixed by pinning patched 0.28.2; no audit suppression.

Exact-SHA candidate `17e80d93511adc1f9910664f07f3c0496d4dd9bb` passed all
implementation tests but service PR run 37958894307/job 113916366949 and builder
PR run 37958894581/job 113916367378 failed only whitespace verification. Logs
identify pre-existing main Grow evidence Markdown line 3 (two trailing spaces).
This is a CI merge-comparison defect, not failing Commerce behavior. The checker
now uses the exact PR base for accumulated app changes, imported main parent for
reconciliation pushes, and immediate parent for ordinary commits. Regression
fixtures preserve old main whitespace while rejecting new app whitespace and
malformed base SHA. No assertion or source check was suppressed. Final SHA must
be requalified; superseded failures are never substituted as passing evidence.

## Implementation and individual exit criteria

- Wallet/onboarding: approved SHA-pinned build manifest; same-origin HTTPS production;
  finalized code/Registry/version checks before API signing and zero-value canonical
  transactions; optional profile references retain canonical zero semantics; no
  automatic signing. Existing Pay controller governs tenant creation/resume.
- Branding: server validated private PNG/JPEG/WebP uploads; avatar/banner/reference
  tenant isolation; three fixed accessible palettes/font templates; plain text
  descriptions and SEO preview; no unsafe HTML, remote media, customer delivery or
  trust badge assertions. Migration 2 backfills existing public designs.
- Categories: shared taxonomy is approved read-only data; bounded merchant menu
  ancestry, taxonomy links, visibility/order and editable versions. Public released
  descriptions/menu cannot reveal pending edits.
- Catalogue/listings/variants: persisted SKU/media/description/category/options;
  independent canonical variant IDs; committed product hash/version; seller-only
  create/revise prepare; policy/adapter/expiry checks; exact ABI re-encoding, named
  economic review, fresh state/revision, simulation, account/network/expiry checks
  immediately before send. No protocol semantics changed. Broadcast is pending.
- Stock: canonical seller-bound finalized read, exact integer price/asset/quantity;
  available/reserved/sold provenance; quantity immutable on revise, reservation
  remains Market's authority. No product UI can create off-chain guaranteed stock.
- Preview/publication: private draft/mobile/tablet preview, atomic reviewed branding
  and collection version pins, explicit finalized product metadata/revision gate,
  publication/withdrawal, retained previous designs and branding rollback into draft.
  Product draft withdrawal is explicit in UI; historical branding never rolls back
  Market economics, inventory or payment state.
- Authorization/failure UX: presentation scope-derived read/render/control grants,
  fresh server authorization on every action; Wallet reset clears private values,
  options/blob URLs/preview/plans; no persistent browser private cache. Serialized
  actions, focused errors/live status, offline guard and unsaved-change warning.
- Accessibility/deployment: labelled 44px controls, contrast, skip link/keyboard,
  320px wrap and reduced motion; static self-only CSP. Actual root/build/output
  documented. Cloudflare project/live host/chain deployment remains unverified.

Every original COM-4 criterion is individually SATISFIED on implementation SHA
`594bd4e1e1554a1b8e34445eefd506765ffd9594`; all required CI jobs/steps and logs
confirm PASS. See `COM-4-QUALIFICATION-EVIDENCE.md`. No standalone Commerce service ID, frozen-address edit, new financial
contract, private key, hidden transaction or deployment was introduced.

## Phase qualification relationship

Level 1: affected SDK compilation/negative tests, service syntax/lint/security,
SQLite migration and ACL/version/publication/stock/API tests, consumed canonical ABI
compile/production sizes, builder dependency audit/build/lint, Wallet adversarial,
real browser integration and accessibility. Level 2: merchant-builder integration
milestone (COM-2 reporter + COM-3 durable service + COM-4 Wallet/client converge);
retain app-specific Market/Pay, SDK, affected Indexer and service gates on the same
implementation SHA. No canonical roadmap step is replaced or renumbered.

Full Solidity Foundry inventory, Genesis address authority, 420 Integrated/global,
Docs/global and full security/fault/soak/client closeout stay deferred to accumulated
app-phase Level 3/COM-7. Solidity owns the full Foundry inventory; Genesis owns
address authority and must not duplicate it. No full inventory was requested at
this ordinary step. Live/testnet remains COM-8; mainnet COM-9 explicit authorization.

Next canonical step: **COM-5 Public marketplace:** marketplace landing, merchant
pages, product detail, browse/search, single-merchant cart, $420 checkout, supported
swaps, receipts and accessible mobile design; Playwright and targeted integration gates.
