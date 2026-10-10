# 420Commerce — COM-1 architecture reconciliation and implementation roadmap

**Status:** COM-1 architecture closeout qualified and merged through PR #588. COM-2 through COM-6 are qualified at their applicable repository boundaries; accumulated COM-7 repository security acceptance and comprehensive Level 3 passed on `2648c0b6df52a375c2d6bdbd2839cdbc607ff113`. Live deployment/integration acceptance remains COM-8; external production signoff remains COM-9. See `COM-7-LEVEL3-QUALIFICATION-STATUS.json`. PR #594 remains draft/unmerged.
**Target surface:** `commerce.420integrated.org`
**Repository:** `abvhiael/420-integrated-v0.1`

## COM-1 discovery — canonical source findings

1. `docs/420-MARKET-V1-MODEL.md` is **FROZEN FOR V1 IMPLEMENTATION**. 420 Market owns listing/revision, finite-inventory reservation, order, fulfilment commitment, and dispute state. Orders pin immutable economic terms and exact listing revisions. Approved settlement reporting is the only path to a paid/refunded state. The V1 state vocabulary is `CREATED`, `PAID`, `FULFILLED`, `COMPLETED`, `CANCELLED`, `DISPUTED`, `REFUNDED`. This model MUST NOT be replaced by an independent Commerce order contract/state machine.
2. `docs/420PAY-IMPLEMENTATION-STATUS.md` documents existing `MerchantRegistry420`, `InvoiceRegistry420`, `PaymentRegistry420`, `PaymentRouter420`, `SettlementRouter420`, `RefundManager420`, `GasSponsor420`, accounting commitments and canonical swap/settlement adapters. 420Commerce MUST use those authorities rather than duplicate merchant financial identities, invoice issuance, funds or refunds.
3. `docs/420WALLET-W14.5-APP-CATALOG.md` states 420 Commerce has **no distinct canonical service ID** and overlaps canonical Market and Pay. Wallet launches are gated on canonical identity and verified service manifests. Do not invent an ID or enable a guessed storefront URL in Wallet.
4. `config/genesis-applications.json` is frozen Genesis Application Decision #1. Do not silently add 420Commerce or modify frozen Genesis membership. Distinguish a branded noncanonical client/application surface from a new canonical service proposal.
5. `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` defines reusable public business place/location and search capabilities; Commerce should consume location projection for opt-in business discovery without escalating private coordinates.

## Ownership and integration decisions for COM-1

| Concern | Authority / owner | 420Commerce responsibility |
| --- | --- | --- |
| Listings, listing revisions, order state, finite stock reservations, fulfilment and disputes | Canonical 420 Market V1 | Merchant UX, API orchestration and projections; adapters only |
| Merchant financial registration, invoices, payment, settlement, refunds, fee sponsorship | Canonical 420Pay | Compose checkout, show receipts and reconcile canonical evidence |
| Swap-backed payment quotes and execution | 420Swap plus canonical Pay settlement adapters | Present executable quote, expiry/slippage and user authorization |
| Wallet signing and launch provenance | 420Wallet and verified manifests | Client binding; no private keys or auto-signing |
| Canonical service and version identity | 420Registry / ServiceIds420 | Resolve existing Market/Pay services; separate Commerce service identity requires governance/design decision |
| Merchant credentials and names | 420Identity / 420Names / 420Verify | Optional validated display and authorization adapters |
| Discovery, analytics, alerts and location | 420Search, 420Analytics, 420Notifications, shared 420Location services | Rebuildable tenant-scoped projections; privacy |
| Store templates, hero images, category menus, product media, carts, SEO and merchant dashboards | 420Commerce off-chain application | Primary new implementation |

**Risk / conflict resolution:** The initial 420Commerce brief called for new merchant registry, catalogue, order, payment and settlement contracts. Those are not unconditional deliverables. First inspect Market and Pay implementation ABI/capabilities, document any genuine gaps, and propose upstream changes through owning protocols with versioned qualification. No forked V1 authority.

## MVP customer and merchant journey

- Merchant connects Wallet, resolves the appropriate canonical merchant authorization, chooses store slug, avatar, banner, theme, storefront description and optional verified profile.
- Merchant adds products and stock via a tenant-scoped editor; public categories use shared taxonomy while merchant menus and collections are customizable.
- Public customer browses homepage, category, merchant store and product page without a wallet.
- Single-merchant cart verifies stock and revision-pinned price; checkout obtains authoritative Market reservation and Pay settlement routing, with native $420 first and optional supported swap route.
- Buyer signs explicitly, sees pending/final payment states, receives a reconciled receipt; merchant sees order, settlement, fulfilment and authorized refund states.
- Large content, private delivery and customer addresses stay off-chain. No fake product inventory or asserted verified/settled state.

## Detailed qualification road map

**COM-1 Repository and architecture**
- COM-1.1 inventory existing Market, Pay, Swap, Wallet, Registry and commerce-related paths and live readiness; record actual interfaces, not just documentation.
- COM-1.2 freeze dependency and authority matrix; resolve Commerce brand/client versus canonical service ID. **IMPLEMENTED** in `docs/commerce/COM-1.2-DEPENDENCY-AND-AUTHORITY-MAP.md`; branded noncanonical application, no new Genesis service ID.
- COM-1.3 inspect Market/Pay contract ABIs, map missing capability proposals and immutable V1 transitions. **SOURCE ARCHITECTURE DOCUMENTED** in `docs/commerce/COM-1.3-SMART-CONTRACT-ARCHITECTURE.md`; qualified at the COM-1 architecture closeout; see COM-1.8 evidence.
- COM-1.4 define off-chain schemas, event ingestion, tenant isolation and chain reorg reconciliation. **ARCHITECTURE DOCUMENTED** in `docs/commerce/COM-1.4-DATA-STORAGE-AND-EVENT-INDEXING.md`; qualified at the COM-1 architecture closeout; see COM-1.8 evidence.
- COM-1.5 specify exact Wallet/Pay/Market/Swap/Identity/Registry adapters and fail-closed behaviour. **DESIGN DOCUMENTED** in `docs/commerce/COM-1.5-ECOSYSTEM-ADAPTER-DESIGN.md`; reporter source implemented/qualified in COM-2; live deployment remains COM-8.
- COM-1.6 design merchant onboarding, storefront templates, product management, cart and checkout UX. **DESIGN DOCUMENTED** in `docs/commerce/COM-1.6-MARKETPLACE-STOREFRONT-UX.md`; merchant builder qualified in COM-4; COM-5 repository marketplace/checkout qualification is retained; live chain remains COM-8.
- COM-1.7 write financial, inventory, upload, access-control, fraud and privacy threat model. **THREAT MODEL DOCUMENTED** in `docs/commerce/COM-1.7-SECURITY-THREAT-MODEL.md`; architecture threat register retained; current COM-T01–T16 regressions qualified in COM-7.
- COM-1.8 Level 3 architecture closeout only after all preceding criteria/evidence and exact-SHA canonical qualification. **LEVEL 3 QUALIFIED AND MERGED**; see `docs/commerce/COM-1.8-LEVEL3-CLOSEOUT.md` for required workflows, evidence and blockers.

**COM-2 Contracts / upstream adaptations:** inspect first; implement only demonstrated gaps within the canonical owning protocol; targeted Foundry Level 1 and milestone Level 2; security Level 3. No parallel Commerce order/payment contract.

**COM-3 Service + API:** merchant storefront persistence, upload safety, catalogue projections, tenant ACL, concurrency controls, search and SDK; Level 1 per step, Level 2 milestone, Level 3 closeout.

**COM-4 Merchant storefront builder:** wallet-backed onboarding, avatar/banner/theme, app-wide and merchant-controlled categories, listings/variants, stock and preview/publish; UX/integration qualification.

**COM-5 Public marketplace:** marketplace landing, merchant pages, product detail, browse/search, single-merchant cart, $420 checkout, supported swaps, receipts and accessible mobile design; Playwright and targeted integration gates.

**COM-6 Merchant operations:** orders, settlement display, authorized refund workflow, analytics, notifications, credentials/names, dispute handoff and developer examples.

**COM-7 Security/ops:** payment adversarial tests, reservation races, swap failures, auth/tenant isolation, upload security, load, recovery, monitoring, independent security review readiness and Level 3 repository closeout.

**COM-8 TESTNET HANDOFF (BLOCKED until real chain/integrations exist):** validate chain ID, RPC and registry addresses; deploy only approved upstream additions, bind services, register a merchant, publish store/product, pay native $420, test swap route if available, verify settlement/refund/order/stock and failure/reorg handling, retain live tx hashes, addresses, canonical workflow IDs, exact SHA and Level 3 evidence. Mock/in-memory tests never count as live evidence.

**COM-9 MAINNET HANDOFF (BLOCKED pending qualified testnet and explicit authorization):** audits and remediation, production chain/Registry binding, wallet/security/liquidity and regulatory checks, runbooks/monitoring, explicit authorization, controlled rollout and verified real settlement. Never auto-deploy.

## Cloudflare deployment planning

Target branded client `commerce.420integrated.org` with verified configuration, separate testnet/mainnet settings, server-owned secrets and privacy-safe persistence. **Implemented merchant web root: `commerce/web`; build: `npm run build` after SDK build; output: `commerce/web/dist`. Cloudflare project, DNS/TLS and live binding remain unverified.** Do not guess these values, configure an unverified service manifest, or claim a deployment.

## Qualification and status

Follow repository's existing three levels: Level 1 targeted step tests, Level 2 at milestone boundaries, Level 3 one exact-candidate phase closeout. Solidity ownership stays in canonical Foundry; Genesis address authority and global/docs qualification remain separate. Evidence-only updates do not mandate duplicate global reruns if current policy permits SHA inheritance.

| Item | Status |
| --- | --- |
| COM-1 initial normative source reconciliation | COMPLETE — PR #588 |
| COM-1.1 targeted source/interface inventory | DOCUMENTED — see `COM-1.1-SOURCE-INVENTORY.md` |
| COM-1.2 ownership / service identity | DOCUMENTED — Commerce V1 branded application; separate canonical ID deferred for governed decision |
| COM-1 acceptance evidence and exact-SHA qualification | COMPLETE — candidate `d32c1eeacc2ba4f13d3a6fcd1afb84a5abb0aa3c`, merge `0ec695481fc84e6066aeae50baf6e0fd3c7f8731` |
| COM-2 | COMPLETE — targeted Level 1 and retained Level 2; exact SHA `0b1a3f5d12fdf6d5c76e6ba860058887886daf9f`, run 37890773444 SUCCESS; PR #594 unmerged |
| COM-3 | COMPLETE — Level 1 and retained Level 2; exact SHA `49c5875d35cd205a8c58634d7ecf1a4ba2ae99b1`, service run 37895449006 SUCCESS; see `COM-3-QUALIFICATION-EVIDENCE.md` |
| COM-4 | COMPLETE — Level 1 and merchant-builder Level 2; exact SHA `594bd4e1e1554a1b8e34445eefd506765ffd9594`; builder run 37959428862, service 37959429065, upstream 37959429112 SUCCESS; see `COM-4-QUALIFICATION-EVIDENCE.md` |
| COM-5 | Repository public marketplace/native checkout/browser qualification retained; live payment and supported Swap acceptance remain COM-8 |
| COM-6 | Applicable retained Level 2: `95fc1102d5b7700609cadaa95ed443acbe6cf65c`, run 38006767611; final component regressions passed; canonical refund, local notification and page-local analytics limits remain documented |
| COM-7 | COMPLETE — repository security acceptance and comprehensive Level 3 on `2648c0b6df52a375c2d6bdbd2839cdbc607ff113`; no external signoff or testnet claim |
| COM-8 testnet | BLOCKED — LIVE TESTNET |
| COM-9 mainnet | BLOCKED — TESTNET AND AUTHORIZATION |

**Next action:** **COM-8 — TESTNET HANDOFF**. COM-7 exact-candidate evidence is in `COM-7-LEVEL3-QUALIFICATION-STATUS.json`; all actual workflow/job/step results and remaining live gates are retained. Real approved chain/Registry/Wallet/manifests, funded settlement/refund transactions, live integrations and operational acceptance are required. PAY-AUDIT-6 frozen release identities, canonical Market refund accounting versus payout proof, supported SQLite topology, local notification feed and page-local analytics limits are not waived. COM-9 requires independent external security signoff and explicit production authorization. PR #594 remains draft/unmerged.
