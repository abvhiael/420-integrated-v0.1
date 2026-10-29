# HC-ECON-00 — Architecture, authority and requirements baseline
Status: specification and traceability baseline only. No HC-ECON runtime APIs, migrations or economic transfers are activated by this document.
Date: 2026-10-28. Branch: `hc-econ-00-architecture-specification`.
Scope: HC-ECON-00; subsequent implementation packages HC-ECON-01..20 and testnet track HC-ECON-TN.

## Audit method and source-of-truth precedence
This is a bounded source/document audit, not a claim that all historical qualification remains green. Actual implementation/contract semantics prevail over stale documentation; deployed canonical contracts prevail over ordinary service projections. Read with:
- `docs/highcountry/ARCHITECTURE-AND-AUTHORITY.md`, `TYPES-AND-UNITS.md`, `MIGRATION-BOUNDARIES.md`
- `docs/highcountry/HC-PLACE-01-ARCHITECTURE-BASELINE.md`, `HC-PLACE-02-CONTRACT.md`; `services/highcountry-economy/src/placement-contract.js`
- `docs/highcountry/R04.8-MARKET.md`, `services/highcountry-economy/src/market.js`, `postgres-store.js`, `marketplace-view.js`
- `docs/highcountry/HC-NEXT-3.4-CONSERVATION-AUDIT.md`
- `docs/highcountry/HC-SEED-08-VERIFIABLE-OPENING.md`, `HC-SEED-09-MARKETPLACE-PAYMENTS.md`
- `docs/highcountry/HC-NEXT-5.2-MISSIONS.md`, `HC-NEXT-5.3-DISCOVERY-INTEGRATION.md`, `HC-NEXT-5.4-REWARDS-PERSISTENCE.md`
- `docs/highcountry/HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`.

## Existing authority and collision audit
| Existing domain | Observed boundary | HC-ECON integration / prohibited shortcut |
| --- | --- | --- |
| Authentication | Registered account and scoped active session; wallet optional for ordinary play | All economic writes recheck account and revocation inside transaction; no browser authoritative balance, item, or reward |
| Ordinary BUDS market | R04.8 registered/internal asset, fixed-price, full-fill, zero fee; serializable PostgreSQL economy authority | Extend with new reviewed order types and floors, **do not** silently change R04.8 or label BUDS as $420 |
| Inventory / resources | InventoryRegistry ResourceLedger conservation, tagged holds; ordinary economy serializable reservations | Versioned resource mappings and single atomic reservation/consumption/issuance; preserve original reservation origin |
| Placement | HC-PLACE owns server-authoritative parcel/scene geometry, instances, owner and revision/slots | Econ provides asset/type/compatibility records; never implements independent placement authorization |
| Seed pack RNG | HC-SEED-08 pinned pool, verifiable randomness and recovery; requires live provider to activate | Distinct item modifier domains; reuse proof-verification pattern, not the seed-pool draw or a browser RNG |
| Cultivation/genetics | Canonical genome, strain and harvest receipts; HC-SEED entitlement boundary | Harvest valuation consumes proven genetic rarity, strain-quality and harvest-quality values, not client claims |
| Missions | HC-NEXT-5.2 registered ordinary missions, signed evidence and non-economic rewards | Existing catalog expressly forbids BUDS/inventory/competitive bonuses: new quest rewards require additive versioned authority, not an unsafe reuse |
| O16 discovery | Durable 64-fragment, 16-founder rewards with nontransferable Founder Seals | One source event may not issue duplicate O16 entitlement or duplicate HC-ECON relic |
| Canonical migration | Ecosystem state separately authorized by chain contracts | Ordinary ownership is not automatically transferable/canonical; no fabricated chain claims |
| Rights and storefronts | Existing land and licenses remain independent of art/business name registration | Brand does not grant land, trademark, wallet, placement or asset license beyond explicit game terms |

## Authority allocation
**Design owner/approval:** HighCountry project owner; no reviewer, moderator, sponsor, creator or randomness provider receives governance authority.
**Functional code owners** in the matrix below refer to responsible subsystem, not named GitHub collaborators.
**Creator:** supplies artwork, truthful rights declarations, category suggestion, optional edition cap, store price and branding; cannot authorize type, pool, random output or certification.
**Reviewer:** inspects, describes and signs exact certification; cannot mint items, bypass validation, select modifier outcomes or self-release compensation.
**QA/appeals authority:** separate scoped identity; may suspend certification, resolve disputes and release eligible reviewer earnings; denial and reassignment recorded.
**Game economy service:** serializable owner of ordinary inventory/BUDS, reservations, shop orders, quotas, and operation IDs; cannot invent canonical chain ownership.
**Chain issuer/treasury/randomness:** verified deployed addresses/code hashes and scoped capabilities where needed; no live activation until audited testnet evidence.

## Required lifecycles and transactional invariants
1. **Artwork:** draft -> submitted -> automated-validated -> human-review -> signed-certified -> published; rejected/disputed/suspended/revoked have explicit non-destructive audit history. Versioned checksum and image rights are immutable for a certified edition.
2. **Edition:** creator sets immutable cap 1..420; per-design issued-ever increments exactly once per issued instance; independent proof-verifiable item roll; burned/removed/revoked items never reduce issued-ever and never refund issuance credits.
3. **Reviewer fees:** USD-equivalent fee quote -> authenticated $420 payment confirmation -> allocation 10/40/50 -> pending reviewer escrow -> valid certification and QA/appeal window -> reviewer release or governed adjudication. No duplicate settlement; quote freshness and price-source integrity enforced.
4. **Brand package:** one $4.20 USD-equivalent package includes brand identity, logo, branded storefront asset, five individually certified product designs; only complete valid packages publish. No trademark creation, land entitlement, or bypass of review.
5. **Manufacturing:** immutable recipe/input provenance -> reservation -> authorized processing -> atomic consume and output grant; cancellation follows loss/refund policy, retries idempotent; outputs carry category, quality, owner and source.
6. **Specialty shop:** category-limited supply -> bounded stock epoch -> per-principal quota -> purchase transfer; replenishment scheduled and replay-safe; broad market listing and sale comply with versioned floor including bundle/discount effective price.
7. **NPC demand:** signed/versioned buy order with finite funds, quantity, item predicate and expiry -> reserve eligible owned inventory -> atomic transfer/consume, BUDS payout and optional quest source event. No same-item replay or infinite buyback loop.
8. **Quest:** versioned prerequisites and authenticated location/cultivation/commerce evidence -> durable progress -> unique claim -> eligible ordinary reward or separately authorized economic/canonical issuance; quest-bound relics never transferable/sellable but can be burned once.
9. **Revocation:** editor/reviewer/issuer/session and trademark complaints fail closed for new mutations; historical receipts and valid ownership remain traceable, with explicit appeal and remedy policy.

## Versioned proposed data contracts
All records use `gameId`, `schemaVersion`, immutable object IDs, domain-scoped `principalId`, `operationId`, `createdAt`, and provenance; enforce consistent integer or smallest-unit amounts (no floating point settlement). Suggested tables: `econ_asset_submissions`, `econ_asset_versions`, `econ_validation_results`, `econ_certificates`, `econ_reviewers`, `econ_appeals`, `econ_fee_quotes`, `econ_fee_allocations`, `econ_reviewer_escrows`, `econ_brands`, `econ_brand_components`, `econ_designs`, `econ_edition_counters`, `econ_item_instances`, `econ_modifier_policies`, `econ_item_entropy_receipts`, `econ_building_functions`, `econ_equipment_compatibility`, `econ_recipes`, `econ_production_jobs`, `econ_npc_shop_stock`, `econ_npc_quotas`, `econ_npc_buy_orders`, `econ_commercial_deliveries`, `econ_quests`, `econ_quest_progress`, `econ_professions`. These are **proposed ownership/data models, not existing migrations**. Integrate with, rather than duplicate, existing BUDS, inventory, seed and placement persistence.
**API names below are proposed adapters**; no deployed route is claimed. Deny by default until implementations are independently authenticated, versioned, tested and activated.

## Requirement-to-owner/API/data/test traceability (all approved requirements)
Every ID is a mandatory later implementation/acceptance obligation. Tests are proposed test IDs, not passing test reports.

| ID | Approved requirement | Functional owner | Proposed API/integration | Proposed durable data | Mandatory acceptance test |
| --- | --- | --- | --- | --- | --- |
| E01 | Creator single fee $0.42 USD | Fees | POST /econ/quotes; /econ/submissions | fee_quote,submission | T-FEE-01 |
| E02 | 24-item bundle $4.20 USD | Fees | POST /econ/submission-batches | submission_batch,submission | T-FEE-02 |
| E03 | Brand package $4.20 with identity/logo/storefront/five items | Brands | POST /econ/brands/register | brand_registration,brand_component | T-BRAND-01 |
| E04 | Exact $420 conversion, freshness, expiry and failure close | Fees/Oracle | POST /econ/quotes; /econ/payments/confirm | usd_quote,oracle_attestation | T-FEE-03 |
| E05 | Fee split 10% dev/40% community/50% reviewer | Fees/Treasury | POST /econ/payments/settle | fee_allocation,settlement_receipt | T-FEE-04 |
| E06 | Reviewer paid only after valid certification and QA release | Certification/Treasury | POST /econ/reviews/certify; /econ/reviews/release | review_certificate,reviewer_escrow,qa_decision | T-REV-01 |
| E07 | Automation plus human signature, description and audit | Certification | POST /econ/assets/validate; /econ/reviews/certify | asset_submission,automated_check,review_certificate | T-REV-02 |
| E08 | Warnings, suspension, fraud, disputes, appeals and revocation | Certification/Authority | POST /econ/reviews/appeal; /econ/reviewers/suspend | reviewer_status,appeal,disciplinary_event | T-REV-03 |
| E09 | Original asset integrity, ownership, rights and trademark complaints | Creator/Brands | POST /econ/assets/submit; /econ/brands/dispute | asset_version,rights_claim,brand_dispute | T-IP-01 |
| E10 | Edition maximum 420 and immutable creator-selected cap | Items/Issuer | POST /econ/designs/publish | certified_design,edition_counter | T-ITEM-01 |
| E11 | Independent per-copy verifiable bounded functional modifiers | Items/Randomness | POST /econ/items/issue; GET /econ/items/:id/proof | modifier_policy,entropy_commitment,item_instance | T-ITEM-02 |
| E12 | Burn and removal never restore issuance or submission fees | Items/Issuer | POST /econ/items/burn | item_lifecycle,edition_counter,fee_receipt | T-ITEM-03 |
| E13 | Decorative and functional roles, compatibility and stacking caps | Items/Placement | GET /econ/item-types; placement adapter | object_taxonomy,modifier_pool,equipment_slot | T-ITEM-04 |
| E14 | Quest-bound item untradeable and burnable, no market value | Items/Quests | POST /econ/items/burn; market admission | item_binding,quest_reward | T-ITEM-05 |
| E15 | Building function and exact equipment compatibility registry | Placement/Buildings | GET /econ/buildings/:id/compatibility | building_function,equipment_compatibility | T-BLD-01 |
| E16 | Universal recipes and conserved manufacturing inputs/outputs | Manufacturing/Inventory | POST /econ/jobs/start; /complete; /cancel | recipe_version,production_job,inventory_reservation | T-MFG-01 |
| E17 | Six families processing/pre-roll/glass/wood/brewing/textiles | Manufacturing | GET /econ/recipes | recipe_family,recipe_version | T-MFG-02 |
| E18 | Flower value includes genetic rarity, strain quality, harvest quality | Cultivation/Pricing | POST /econ/harvests/value | cultivar_reference,harvest_provenance,price_policy | T-HAR-01 |
| E19 | Certified player brands and category-specific product catalogues | Brands/Market | GET /econ/brands/:id; /econ/catalog | brand_registration,certified_design,storefront | T-BRAND-02 |
| E20 | Specialty shop limited catalogue and replenishment quotas | NPC Supply | POST /econ/npc-shops/purchase; /replenish | shop_catalog,stock_epoch,account_quota | T-NPC-01 |
| E21 | Broader-market resale floor tied to posted specialty price | Market/NPC Supply | POST /econ/listings; /purchase | floor_policy,price_reference,listing | T-NPC-02 |
| E22 | NPC buy orders and authenticated crafted deliveries | NPC Demand | POST /econ/npc-orders/fulfill | npc_buy_order,delivery_receipt,item_provenance | T-NPC-03 |
| E23 | Modifier-qualified delivery e.g. glassware 3% requirement | NPC Demand/Items | POST /econ/npc-orders/fulfill | modifier_requirement,item_instance | T-NPC-04 |
| E24 | Regional commercial contracts and bounded BUDS payouts | Quests/NPC Demand | POST /econ/contracts/claim | contract_definition,contract_claim,buds_receipt | T-QUEST-01 |
| E25 | Professions and immutable repeat-safe progression | Progression | POST /econ/progression/events | profession_record,progress_event | T-QUEST-02 |
| E26 | Three Genesis region exploration lines and strains | Quests/World | GET /econ/quests/:region; /progress | quest_definition,location_evidence,cultivar_reference | T-QUEST-03 |
| E27 | O16 fragments and relic integration without duplicate entitlement | Discovery/Quests | POST /econ/quests/claim | archive_reference,quest_reward,source_event | T-QUEST-04 |
| E28 | Ownership, authentication, revocation and scoped signed evidence | Auth/All | Authenticated routes and signed source events | principal_session,capability_grant,idempotency_receipt | T-AUTH-01 |
| E29 | Atomic settlement, replay control, reservations and conservation | Economy/Inventory | Transactional adapters, operation receipts | transaction_receipt,inventory_ledger,outbox | T-TX-01 |
| E30 | Live contracts/oracles/VRF/finality gated by testnet roadmap | Deployment | Operator activation and manifest validator | deployment_pin,chain_receipt,activation_gate | T-TN-01 |

## Test specification and source qualification gate
For every `T-*` above the implementing package MUST provide: success, denial, replay, concurrent mutation and restart/recovery tests where applicable. Every test binds exact policy version and repository commit SHA. Review cross-system atomicity, ledger conservation, privilege separation, fail-closed stale exchange/entropy responses, price floor and reviewer abuse. Test minted/paid state and one-time issuance after process interruption; never qualify only mock verifiers for live cryptographic acceptance.
The HC-ECON-00 document-only gate is: (a) full ID traceability, (b) named authority boundary and existing source links, (c) no live production claim, (d) explicit dependencies and deferrals, (e) no unrelated CI rerun. Runtime Level 1/2 integration and exact-SHA CI qualification belong to the implementation packages and cannot be inferred from this document.

## Implementation dependencies / sequencing
HC-ECON-01 taxonomy -> 02 RNG and edition lifecycle -> 03 compatibility. 04 creator intake and 05 reviewer certification in parallel with 08 recipe engine after 00; 06 payments before compensated reviewer publication; 07 brands depends on 04-06. 09 cultivation pricing depends on proven HC-SEED genetics and 08 recipes. 10 specialty industries depends on 03/08. 11 supply depends on 08/10; 12 NPC demand depends on 02/08/11; 13 player resale depends on existing R04.8 and 11/12. 14 quests extends HC-NEXT-5.2, 15 professions and 16 O16 integration; 17 Emerald Ghost, 18 Prairie Thunder, 19 Redline depend on real world landmarks, regions, strain entitlements and quest engine. 20 is cross-system closeout, not a parking lot for unfinished features.
Regional Genesis storylines: Emerald Coast/Emerald Ghost, Golden Prairie/Prairie Thunder, Red Mesa/Redline; each includes settlement exploration, hidden location, strain provenance/cultivation, local commerce, historical discovery and unique reward, grounded to surveyed accessible maps. Specialty buildings (e.g. malt house) supply bounded virtual inputs; no large hops/vineyard farming required.

## Testnet-only track (HC-ECON-TN)
Create deployment pin/code-hash evidence, actual production-price oracle freshness/volatility circuit breakers, actual $420 settlement and distribution, reviewer authorization/revocation signer synchronization, genuine external/verifiable randomness fulfillment and recovery, finalized inventory/asset entitlement checks, reorg handling and live O16/issuer authorization. Production enablement requires explicit operator approval and exact environment manifests. Until qualified, reject live transactions; test fixtures are not deployed evidence.

## Open specification parameters, not license to improvise implementation
Reviewer QA and appeal deadlines, exceptional fee refunds, quote lifetime and rounding dust, royalty/commission policy for player sales, shop price-floor snapshot/expiration, per-account quotas/epoch lengths, exact item modifier power budgets and stacking caps, NPC order prices/budgets, and source-event trust roots need separately approved versioned values before production activation. No developer or reviewer can quietly set random outcomes.


## Concurrent open-PR reconciliation (2026-10-28; advisory, not merged authority)
GitHub open-PR discovery for `highcountry` reported parallel work affecting HC-ECON: #887 (HC-PLACE-03 serializable placement, custody, server-only adapter; still disabled for production); #803 (canonical wallet-linked market, distinct from ordinary R04.8); #893/#890 (workshop/building abilities, must populate the compatibility registry after approval); #852/#856 (framed art/memorabilia slot catalogues, wall/tabletop restrictions and mutually overlapping marketplace.js branches); #811 (ordinary signed missions, non-economic rewards); #786 (five equipment classes and equipment lifecycle); #899 (Cup projection and achievement persistence); #611 (manufacturing recipe and atomic inventory); #618 (ordinary zero-fee fixed-price BUDS market). Other open R04/R05 PRs include authority, land rights, skills, data durability, chain finality and migrations. Open PR descriptions are **unmerged candidate evidence**, not established active main implementation. Before a dependent HC-ECON milestone begins, diff its authoritative source against main plus all affected open branches and preserve each branch's ownership.

| Potential overlapping work | Do-not-regress rule | Next owner |
| --- | --- | --- |
| #887 HC-PLACE-03 | Do not bypass placement transaction/land custody, authorize child geometry, or enable disabled production routes | HC-PLACE with HC-ECON-03 |
| #890/#893 and #786 | Equipment effects must be expressed by reviewed building/equipment compatibility without retroactively changing qualified class powers | HC-ECON-01/03 |
| #852/#856 and other HC-ART PRs | Marketplace UI catalogue is not issuance or authoritative placement; never overwrite competing artwork catalogues | HC-ECON-04/13 |
| #611 and #618 | Reuse atomic reservation and fixed-price ordinary market; keep canonical market #803 separately authorized | HC-ECON-08/12/13 |
| #811 and #899 | Preserve non-economic ordinary missions and Cup achievement provenance; separately authorize economic quest awards | HC-ECON-14/16 |

## HC-ECON-00 traceability audit result
E01–E30 are 30 distinct nonblank requirement IDs, each with a named functional owner, proposed API/integration, proposed durable data contract and mandatory acceptance-test identifier. The audit verifies **design coverage**, not that E01–E30 endpoints or tests already exist. The implementation owner must replace each proposed reference with actual code paths and exact-SHA evidence in its assigned milestone. The read-back and coverage audit apply to this branch document; the unrelated PRs are observed to avoid premature cross-branch merge.

## HC-ECON-00 exit checklist
- [x] Enumerated the approved creator, fee, moderation, edition, modifiers, manufacturing, pricing, brand, NPC, quest and O16 requirements.
- [x] Mapped each to functional owner, proposed API, proposed data contract and mandatory acceptance test (E01-E30).
- [x] Recorded existing authority boundaries, risk of collisions, lifecycle/state invariants and implementation ordering.
- [x] Distinguished current sources from proposed APIs/data and future testnet requirements.
- [x] Audited indexed source boundaries and relevant concurrent open HighCountry PR descriptions; complete repository-wide independent file enumeration is not established.
- [x] Verified 30 distinct E01–E30 mapped requirements by exact-branch readback; observed passing 420Docs Actions on initial SHA 797bfc1, but this revised SHA requires new verification.
- [x] Recorded non-merged concurrent PR conflict boundaries and compared this branch to main; only this documentation path changes.
**Status discipline:** Requirements coverage is documented, but comprehensive repository tree enumeration and revised exact-SHA CI evidence still require confirmation before unconditional full certification.
