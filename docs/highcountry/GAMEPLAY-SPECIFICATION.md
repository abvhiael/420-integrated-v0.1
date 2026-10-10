# High Country — R01.6 adopted gameplay specification

Status: COMPLETE for the R01.6 baseline specification. The owner adopted the five concrete gameplay/economy rules on 2026-10-09 with “adopt that baseline”. These are newly approved design requirements, not historically implemented mechanics. No gameplay implementation or application readiness is claimed.

Sources: [release scope](RELEASE-SCOPE.md), [architecture](ARCHITECTURE-AND-AUTHORITY.md), [types](TYPES-AND-UNITS.md), [migration](MIGRATION-BOUNDARIES.md), [trust](DEPLOYMENT-AND-TRUST.md), [roadmap](RECONCILIATION-AND-BUILDOUT-ROADMAP.md), `contracts/src/highcountry/cultivation/README.md`, PlantRegistry/CultivationEngine, genetics/breeding source and root README. Preserve HC-1..HC-6, HC-PA, HC-GP and HC-7. Later work retains R04.1..R04.14 until phase numbering is canonically reconciled.

## Inherited rules and explicit gaps

HC-6 stages: germination 1 day, seedling 2 days, vegetative 7 days, flowering 7 days, then READY; bounded catch-up, no arbitrary skip. Environment has six controls; uint16 centiC temperature 1000..4000, other controls 0..10000. Scores stressBps+qualityBps=10000. Existing phenotype expression seals canonical genome/ruleset/snapshot/scores. No READY stage harvest or product creation exists. Existing genome loci are opaque bytes32: they have no defined yield/potency/terpene decoder. Never derive biological traits by arbitrary casting/hashing a locus.

Approved scope includes wallet-free cultivation and the full social economy. Wallet linkage/entitlement cannot improve protected yield, genetics, capacity, equipment stats, BUDS generation, progression or competitive score. Local preview cannot mint service/canonical assets. R01.2 internal market and ecosystem asset market remain separate. R01.3 encodings and R01.4 trusted promotion policy remain unchanged.

Undefined historical mechanics: per-genome yield, harvest grade thresholds, product partition/process loss, BUDS precision/conversion, equipment recipes/durability and skills/research parameters, market fees, competition scoring/content and funded prizes. The following adopted baseline supplies the selected rules; it is newly approved design, not recovered repository evidence. Detailed later-module catalogues remain mandatory implementation prerequisites under their retained assignments.

## Adopted HC-7 profile: HC7-HARVEST-V1

### Preconditions and authority

A harvest is one resolution per deployment-qualified plant ID. Require existing READY nonterminated plant, actual grower/valid consent-bound operator, occupied parcel/capacity consistency, consumed eligible seed/clone and valid sealed canonical genome/expression/ruleset. R02 must first close those resource/provenance/lifecycle gaps. Service-authoritative registered harvest applies equivalent rules through an authenticated transaction; guest harvest is local only. Canonical harvest executes against real canonical records and capabilities; service authority cannot promote a local plant by changing its ID.

Seal the environment at READY as the adopted V1 harvest checkpoint. Earlier speculative expression is not valid HC-7 input; preserve historical records and reject incompatible ones rather than reopening a sealed phenotype. This is an explicit restriction/new design compared with HC-6's permissive timing, requiring versioned ruleset and R02 consumer enforcement. V1 uses the sealed checkpoint quality, not a nonexistent time-integrated growing-history score. Production documentation must say so. Future full-lifecycle scoring needs a new version and recorded inputs, not a silent algorithm change.

### Deterministic calculation and grade

Adopted base output: 100000 mg per eligible plant (100 game grams), identical for all founding genomes in V1 because no approved locus decoder exists. Genetics keeps lineage/breeding identity; V1 does not fabricate statistical traits. Research/trait expression and differentiated founder yield require approved versioned data before introduction. This equality is a deliberate adopted baseline limitation, not a claim that differentiated genetics are already designed.

Compute `outputMassMg = floor(baseMassMg * qualityBps / 10000)` using widened checked integer intermediates. qualityBps is 0..10000, baseMassMg 1..1000000000 (manifest bounds), output fits uint64. Default base 100000. Product type is FLOWER; no inferred potency/terpene concentration. No random draw or wallet/equipment/fee multiplier at harvest. V1 environment changes through earned equipment may affect the same six controls before sealing under equal rules, never through wallet state.

| qualityBps | Grade | Rule |
|---|---|---|
| 0..2499 | D | Integer threshold, inclusive lower boundary |
| 2500..4999 | C | Same |
| 5000..7499 | B | Same |
| 7500..8999 | A | Same |
| 9000..10000 | S | Same |

Quality zero resolves a zero-output harvest: no empty tradable lot; still records outcome and releases plant capacity once. Output above zero creates one immutable FLOWER lot with mass, grade, quality, grower, plant/genome/parcel/region, expression, source/ruleset/version and timestamp. No seeds/clones/BUDS appear automatically from flower harvest. Product processing belongs to recipes under R04.3; inputs=outputs+explicit process loss, never unexplained mass creation.

### Lifecycle, atomicity and recovery

Specified `harvest(plantId, harvestId)` accepts exact immutable input references from authoritative registries rather than caller-supplied quality or genome. HarvestId nonzero and unused; one plant→one harvest, one lot→one provenance. In one atomic authority-domain transaction: validate → reserve unique plant/harvest → calculate → record immutable harvest and optional product lot → finalize plant/release occupancy → emit correlated events. Failed external/product/registry call rolls everything back. For service writes, use durable DB transaction/idempotency; chain/DB mirroring uses outbox reconciliation, never assumed cross-domain atomicity.

PlantStage does not gain an inserted enum value. PlantRegistry reaches TERMINATED through an explicitly restricted harvest-finalization path; separate immutable harvest receipt establishes HARVESTED meaning. Existing READY→TERMINATED permission cannot be treated as harvest proof and must not bypass required resolution. Manual discard is a separately recorded outcome with no products/rewards; it cannot later harvest. Cancellation before resolution leaves plant/resource records intact. Once resolved there is no reroll/refund/harvest reversal; display reconciles the existing receipt. Emergency cultivation restriction blocks new harvest only if unsafe; reviewed harvest/discard exits must conserve accounting and be explicitly allowed, not inferred from a blanket pause.

Required event semantics: HarvestResolved keyed by harvest/plant/grower and input commitment, product lot reference and mass/grade/quality; ProductLotCreated keyed by lot/harvest; authoritative capacity release/plant transition. Exact ABI/action IDs/hash field encodings are HC-7 implementation deliverables reviewed before coding; no new existing selector is advertised here. Indexers bind chain/contract/block/log identity and wait for finality for economic use.

### Implementable acceptance vectors and negatives

Default base100000: q0→mass0/gradeD/no lot; q1→10/D; q2499→24990/D; q2500→25000/C; q4999→49990/C; q5000→50000/B; q7499→74990/B; q7500→75000/A; q8999→89990/A; q9000→90000/S; q10000→100000/S. base1/q9999→0/S/no lot; base1000000000/q10000→1000000000/S. Zero/oversized base, q10001, missing/wrong seal/ruleset/genome/parcel/source, nonREADY/discarded/terminated plant, unauthorized caller, reused plant/harvest/lot reject. Downstream registration failure retains capacity and permits safe same-operation retry; completed retry returns/reads same outcome without creating more products. Wallet-state permutations produce identical result.

HC-7 release cannot ship until this adopted base/grade policy and exact field/authority/action/event schemas have meaningful real-stack tests. The formula is fixed for implementation; exact ABI/schema definitions remain HC-7 implementation deliverables.

## Adopted BUDS / ordinary economy boundary

BUDS are internal service/local game currency with integer base units and zero decimal places in the adopted V1. Not ERC20, not native $420, no redemption/conversion/bridge, no transferable canonical balances implied. Guest BUDS stay local; registered BUDS are service ledger authority and cannot import arbitrary local balances. Earned sources require validated gameplay; debits/credits and reserved/available amounts conserve value with explicit source/sink entries. No automatic BUDS grant at harvest; selling/mission reward needs approved price/reward catalogue. R04.5 must provide bounded catalogue, inflation/abuse tests and player onboarding before launch; source values are not guessed in this spec.

Proposed ordinary market is full-fill fixed-price listings in internal assets/BUDS for initial V1, with no listing/trade fee (0 bps), no partial fills or swap conversion. Reserve asset on listing; buy atomically transfers price and asset; cancel/expire returns reservation to its original owner. No negative balance, selling reserved/consumed lots or duplicate fulfillment; self-trade contributes no progression/rewards. Concurrent buy admits one winner. Canonical ecosystem market remains separate player-signed asset-specific settlement, with fees/refunds/custody design qualified against actual Pay/rights dependencies before activation.

## Later system boundaries and retained assignments

| Assignment | Required rules and authority | Acceptance / failure boundary |
|---|---|---|
| R04.1 InventoryRegistry / ResourceLedger | Typed lot/item identity, units, ownership, available/reserved/consumed; distinguish mass/quantity/capacity | Unique operation, resource conservation; retries never double-consume; zero-output harvest no tradable lot |
| R04.2 EquipmentRegistry | Earned equipment types, placement/capacity and six-control effects; catalogue version pinned | Same equipment/inputs behaves identically regardless of wallet; no hidden premium stat multiplier |
| R04.3 ManufacturingEngine | Versioned recipes, inputs/outputs/loss, duration/queue bound and job authority | Reserve before start; deterministic completion once; cancellation refund/loss stated per recipe before job accepted |
| R04.4 EquipmentLifecycleEngine | Durability/use cost, degraded/broken/retired/recycled transitions; item-specific repair/recycle recipes | No negative durability/double recycle; broken items stop effects; repair costs conserved |
| R04.5 BudsLedger / EconomicSettlement | Internal ledger rules above; separate optional $420 assets/settlement | Source/sink/reservation ledger, no implicit conversion or unpaid cash reward |
| R04.6 Skill/Research/Discovery | Tracks, prerequisites, progress bounds, unlock catalogue and unique discovery evidence | No imported unverifiable achievements; exactly-once completion; costs and effects versioned |
| R04.7 MissionEngine | Explicit eligibility→active→complete→claimed or failed/expired; frozen objective/reward | Duplicate claims denied; cancel/expiry economics known upfront; no self-trade reward farming |
| R04.8 Market | Internal adopted full-fill market plus separately canonical market | Ownership/reservations and settlement atomic within domain; explicit finality/custody/refund boundaries |
| R04.9 Lease/License/Rights | Identified parcel/assets, term, scope, fees, expiry/revocation and active-plant consequences | Cannot evict stranded active plants silently; expiry/cancel/dispute effects defined before acceptance |
| R04.10 Organizations / Authority | Authenticated membership and bounded delegated roles; optional canonical rights separated | No admin role silently grants member wallet/treasury authority; leave/removal and pending obligations resolve |
| R04.11 Cooperatives / Governance | Cooperative membership/proposals/quorum/timelock/scope explicitly versioned | Voting never executes arbitrary wallet calls; snapshot/replay/exit/treasury protections |
| R04.12 Seasons / Competitions | Versioned rules, entry/close/finalize, eligibility/scoring/evidence/ties/revocation | Wallet-free base events, optional entitlement events; no wallet stat or scoring bonus |
| R04.13 Global420Cup | Cup phases/brackets, eligible result evidence, scoped cross-game issuance | No fabricated local results; finalize once; no funded prize promise without funding/claim acceptance |
| R04.14 Upgrade / SecurityCouncil | R01.5 replacement/emergency authority, no proxy assumed | Qualified code/roles and migration/recovery, no arbitrary implementation swap |

Every catalogue must specify bounded values, version/hash, authority, input validation, state machine, cancellation/refund/failure policy, events/API, abuse tests and acceptance vectors before its module implementation qualifies. These boundaries retain all required full-release systems; no module is deferred or called complete by its name.

## Competition and perks baseline

Adopted base cultivation exhibition: one eligible verified FLOWER harvest per player/event, score=qualityBps, deterministic tie by earliest finalized eligible harvest then deployment-qualified harvest identity. Mass is displayed but not a score multiplier. Require service/canonical evidence accepted by event policy, not local claimed quality. Optional events can gate entry with per-player scoped entitlements but apply the same published scoring rules. No paid/wallet score boost. This is one adopted base format, not the complete Cup/bracket catalogue. Awards, anti-cheat challenges/result correction, exact seasons and Cup structure must be specified under R04.12/13 before release.

Wallet perks catalogue may include cosmetics, bonus regions, special facilities/areas, genetics content, optional events and cross-game prestige as already named by HC-PA. All protected simulation stats remain equal; exclusive genetics/equipment with better yield or competition advantage conflicts with that rule and is prohibited without an explicit scope redesign. Entitlement alone grants no reward currency, capacity, superior trait or extra scoring attempt. Production perk/content IDs and expiry/revocation policies need actual reviewed catalogues; no entitlement price or reward amount invented.

## Contradictions and implementation boundaries

READY vs HARVESTED: separate receipt, no enum renumbering. Centi/milli and controls: R01.3 exact conversion, no physical trait guesses. Snapshot quality vs whole-growth performance: adopted V1 checkpoint, explicit limitation; not hidden time-average scoring. Opaque genomes vs differentiated yield: adopted equal founding base until explicit approved trait mapping. Wallet-free market vs ecosystem MARKETPLACE: separate service/canonical domains. Finite mother/seed/capacity records vs disconnected consumers: R02 enforce before harvest. Emergency flag vs effective pause: R02 consumers required. Immutable genesis/modules vs content updates: versioned rulesets and replacement policy; no past outcome mutation.

## Adopted decision and qualification state

Owner decision on 2026-10-09: adopt (1) READY checkpoint quality and equal 100g base founding output, (2) five grade thresholds/formula/zero-output handling, (3) integer internal BUDS without $420 conversion, (4) full-fill zero-fee ordinary market, (5) quality-scored base exhibitions with stated ties. This approval applies to the concrete profile above. Later systems retain their requirements/authority/acceptance boundaries; detailed catalogues are mandatory module prerequisites, not release deferrals or implicitly approved numerical values.

R01.6 baseline specification is COMPLETE subject to its exact-head Level 1 evidence. Formula-vector checks validate specified arithmetic, not an implemented or deployed HC-7 contract. Repository foundation regressions retain their own scope. Next canonical step: R01.7 — R01 milestone qualification (Level 2), which remains unexecuted.
