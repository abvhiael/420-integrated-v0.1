# COM-3 — Service + API — Backend services, inventory, APIs and SDKs

**Canonical definition:** `COM-1-ARCHITECTURE-AND-ROADMAP.md`: merchant storefront
persistence, upload safety, catalogue projections, tenant ACL, concurrency
controls, search and SDK; Level 1 per step, Level 2 milestone, Level 3 closeout.
There are no canonical numbered COM-3 substeps; none are invented or renumbered.
Acceptance also inherits COM-1.4 schema/replay/privacy, COM-1.5 adapter boundaries,
COM-1.6 API handoff and COM-1.7 service threats COM-T03/05/08–14.

**Inspection base:** main `0ec695481fc84e6066aeae50baf6e0fd3c7f8731`; audit branch
`audit/420commerce-com-2-upstream-adaptations`, draft PR #594, prior HEAD
`50086a68b2a3a76b3f2d68068acdce945b97dbd1`, ahead two / behind zero / clean.
COM-2 reporter source and its prior exact-SHA evidence are preserved. COM-3
initially had no executable service, schema, tests or SDK. Shared Indexer supported
Listing ABI events but lacked Market order/inventory catalogue bindings and Market
object/lifecycle keys; these are fixed in the owning Indexer instead of adding a
Commerce chain indexer. Existing SDK is TypeScript; service uses Node 24 and
file-backed SQLite transactions. It introduces no Go dependency or Genesis ID.

## Gap analysis and individual exit criteria

| Original requirement / initial gap | Implementation and directly relevant acceptance |
| --- | --- |
| Durable storefront/branding/categories/products/variants absent | `commerce/sql/001-commerce.sql`, WAL/full-sync/FK migration, controller-bound stores, global versus tenant taxonomy, deterministic metadata, publication binding; service/restart/category/variant tests |
| Upload safety absent | Magic-byte whitelist before bounded sharp decode, patched library, PNG re-encode/metadata removal, tenant quota/access/public reference checks; media/XSS/SSRF/MIME/size/dimension/AEAD tests |
| Catalogue/events/reorg/checkpoint/outbox absent | Existing Indexer typed event stream + verified headers, unique full provenance/payload hash, atomic transaction, generation-aware retractions, canonical rows, restart/rebuild/halt; projection/worker/affected Indexer tests |
| Tenant ACL/authentication/delegation absent | Origin/chain/path/body/nonce signatures, EOA and EIP-1271, fresh finalized controller/Registry/code/version/wiring, narrow expiring delegate scopes; auth/IDOR/revocation/negative RPC tests |
| Concurrency controls absent | Unique slug/SKU/listing/idempotency domains, entity versions, serialized SQLite transactions, concurrent optimistic writes and identical prepare races |
| Inventory/cart/session/checkout persistence absent | Market-only stock reads and reservations, buyer-scoped expiring carts, per-line canonical intents, scoped literal idempotency, canonical order/Pay/invoice/reporter correlation, partial/full-refund distinction; negative/race/restart/failure tests |
| Customer privacy absent | Order+tenant-bound encrypted delivery, buyer/current controller only, audited access and 30-day purge, no PII in public media/search/event/log; plaintext isolation and AEAD tamper tests |
| Search and public API absent | Bounded deterministic published-only search/store/product/category routes, stale/halted provenance, fresh canonical inventory route, parameterized SQL, no fake availability/verified badges |
| SDK absent | Typed existing 420SDK extension, anonymous browse, explicit signed request messages, merchant/cart/checkout/delivery/media methods, canonical host target checks, real HTTP+SQLite end-to-end tests |
| Runtime/config/recovery absent | SHA-approved external manifest, code/version/Registry/EIP-1898 binding, private server-owned keys and volume, rate/concurrency/body/time limits, monitored worker, SIGTERM, documented replay/retention/runbook |
| Exact-SHA fast CI absent | `commerce-service.yml` explicit audit branch/path triggers, exact checkout/assertion, locked installs, security audit, lint/type/ABI/size/regression/integration gates; no missing/skipped checks accepted |

**COMPLETE:** every original exit requirement is verified individually in
`COM-3-QUALIFICATION-EVIDENCE.md`; final implementation
`49c5875d35cd205a8c58634d7ecf1a4ba2ae99b1` passed exact-SHA Level 1 and retained
Level 2. See `commerce/README.md` for API/configuration/recovery contracts and limits.

## Scope, milestones and retained coverage

This is app-focused with narrow shared Indexer/SDK changes. The end of canonical
COM-3 is a sensible Level 2 **Commerce service integration milestone**: the same
targeted job retains all Commerce and SDK tests and affected Indexer ABI/event/
lifecycle/query/API/reorg/delivery suites, exercises real file persistence + HTTP
SDK flows and compares every RPC binding with freshly compiled canonical ABIs.
This milestone name does not replace or renumber a roadmap step. Unchanged COM-2
contract source retains its committed evidence; its workflow is also directly
triggered by the explicit path-policy change. Contract push triggers now exclude
service-only script changes; full inventories are not repeated for API work.

The initial deterministic failure was a test harness expected HTTP 400 for an
unknown protected route, while mandatory Origin validation correctly returned
403. The test expectation was corrected without weakening the origin gate.
Dependency scanning identified vulnerable initial sharp/ethers pins; patched
sharp 0.35.5/ethers 6.17.0 replace them with locked reproducible dependencies.
The first successful CI run also flagged unsupported ESLint 9; it was upgraded
to supported ESLint 10.12.0, creating a new implementation SHA for targeted CI.
Final configuration review also enforces strict encryption-key/port validation
and an authority-snapshot deadline so delayed canonical reads cannot authorize writes.
Review found SQL LIKE wildcard idempotency collisions, duplicate concurrent
prepare attempts, missing descriptor/lifecycle bindings and already-attempted
orphan outbox compensation; these were fixed with adversarial regressions.

COM-4/5 own rendered storefront and public checkout UI, browser signing/Playwright
and payment route composition. COM-6 owns operational refund/fulfilment UX.
COM-7 owns accumulated Level 3, load/soak/independent review and deployment/backup
qualification. COM-8/9 remain real testnet/mainnet handoff gates. Unsupported Pay
Swap quotes remain unavailable; Exchange executable swap quotes and the reverting
Pay adapter quote are not silently substituted. No Commerce custody, payout
override, settlement signer, frozen address/namespace edit or live deployment.

**Intentionally deferred Level 3:** full Solidity inventory (Solidity Contracts
owner), Genesis/address-authority separately without Foundry duplication, 420
Integrated/global, Docs/global reconciliation, complete accumulated retained app
and shared-client/services/security/deployment qualification against one final
merge candidate. Current exact-SHA targeted tests are not full phase closeout.

**Next canonical step:** COM-4 — Merchant storefront builder: wallet-backed
onboarding, avatar/banner/theme, app-wide and merchant-controlled categories,
listings/variants, stock and preview/publish; UX/integration qualification.
