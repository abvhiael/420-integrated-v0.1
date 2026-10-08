# GROW-01 — 420Grow canonical product definition (bounded implementation baseline)

**Roadmap identity:** GROW-01 — Canonical product decision. Retain GROW-02 through GROW-10 as numbered in `docs/audit/420GROW-INITIAL-AUDIT-AND-REMEDIATION-ROADMAP.md`.

**Decision classification:** repository-authorized **app-scoped implementation baseline**, not an amendment of `GENESIS_APPLICATION_DECISION_1`, not a new protocol role, and not permission to deploy to Genesis. This document defines the minimum supportable implementation target grounded in existing 420Location architecture. It does **not** falsely claim this was an earlier fully specified product vision. Expansion needs a separate recorded product decision.

## 1. Source priority and source-to-requirement trace

| Evidence | Normative consequence |
|---|---|
| `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` | 420Grow consumes business/farm Place data; shared location precision, provider independence, provenance, privacy and discovery semantics are binding. |
| `config/420location-events-genesis.json` | FARM and BUSINESS categories, stable place ID, optional region/coordinates and source visibility; query capabilities are provided by shared 420Location, not reimplemented as new protocol authority. |
| `docs/genesis-services/GEN-SVC-0-ROADMAP.md` | Shared object, authorization, API, SDK, error, idempotency and threat conventions; derived service cannot alter canonical state. |
| `config/genesis-applications.json` | Frozen Genesis application list does NOT include 420Grow. No implicit Genesis acceptance. |
| `config/genesis-consumer-services.json` | Consumer service composition is not canonical promotion; 420Grow not listed as a separate service. |
| `contracts/src/libraries/ServiceIds420.sol` | No GROW service ID; assigning one requires GROW-02's explicit authority decision. |
| `docs/420WALLET-W14.5-APP-CATALOG.md` | Named Grow product lacks canonical ID, so Wallet manifest launch must fail closed. |
| Initial audit ledger | GROW-01 through GROW-10 identities and dependency ordering are preserved. |

## 2. Purpose, users and minimum bounded workflows

**Purpose:** a non-authoritative 420Integrated consumer application for discovering and viewing **publicly shareable farm and business places** provided by 420Location. This is the narrowest product behavior affirmatively anchored by existing repository sources.

**Users:** anonymous public visitors seeking publicly listed farm/business places; opt-in business/farm place owners or authorized publishers where an upstream Place editing interface is already trusted. The baseline does not require wallet linkage merely to browse.

**Required user workflows (candidate MVP acceptance contract):**
1. Visit the Grow landing/discovery page without wallet connection; clearly explain coverage, data provenance, and whether real data is available.
2. Filter/discover `FARM` and `BUSINESS` Places via an existing 420Location public query API; show empty, loading, unavailable and error states. A provider-empty response must not be replaced with invented sample listings.
3. Open a Place detail card with source/provider provenance and stable opaque place ID; show only location precision permitted by source visibility. Present Registry and Verify references as provenance, **not** endorsement, legitimacy or quality claims.
4. Permit map/list presentation and route handoff only where the shared provider's permitted coordinate precision supports it; no inference of private address or home location.
5. For editing/claiming, explicitly display **unsupported** unless and until a separately authorized upstream write/claim workflow is specified and qualified. Browsing does not grant place ownership or publication rights.
6. When upstream location service is offline, unavailable, invalid or returns a disallowed visibility record, fail closed for the affected data without exposing fallback private coordinates or claiming authoritative state.

**Out of the GROW-01 baseline:** cultivation telemetry, IoT controls, crops/yields/genetics, seed or cannabis sales, agronomic/medical recommendations, regulated inventory, farm financing, market settlement, token issuance, rewards, AI inference, identity/credential issuing, place ownership attestation, booking, mapping-provider authority, and any new smart contract. These are not asserted absent from future Grow vision; they are **unapproved scope** until an explicit roadmap/spec decision describes requirements and regulatory obligations.

## 3. System boundaries and architectural responsibilities

- **Frontend:** future standalone application surface, public place browse and detail UI; mobile-responsive, keyboard-accessible, adequate loading/error/empty states, no hard-coded unverified wallet launch URLs. GROW-04 owns implementation.
- **API / SDK:** read-only typed adapter to 420Location with `/v1`, cursor pagination, bounded page sizes, stable opaque IDs, RFC3339 UTC timestamps, provenance, stable error codes, version/capability discovery. GROW-03/05/07 own implementation and contract tests.
- **Data model:** reuse shared Place fields (`place_id,name,category,visibility,source,created_at,updated_at`; optional public region/coordinates/registry references); no independent shadow ownership registry. Only `FARM` and `BUSINESS` are in the initial Grow display filter; do not claim app-owned Place authority.
- **Indexer/search:** derived discovery only through approved shared 420Location and optional 420Search; no private-source indexing and no independent consensus state.
- **Contracts:** none established as necessary for this bounded read-only baseline; deployment of any new authority-bearing contract is gated on GROW-06 scope decision. Existing 420Registry/420Verify data may be displayed only as upstream provenance.
- **Storage/backend:** no app-exclusive write store required by read-only MVP. Any caching must preserve visibility/precision constraints, source freshness and deletion/tombstones; no credential custody.
- **Wallet:** anonymous public browsing; optional Wallet linkage must not create rights, access to private places, transactions or an invented canonical service entry.
- **Dependencies:** direct 420Location Place API; optional 420Registry/420Verify provenance provided by upstream, optional 420Search discovery. Identity, Names, Pay, Token, Stake, Governance, Treasury, Bridge, AI, Compute, Notifications, Rights, Arbitration, Storage, Oracle and other ecosystem apps are **not mandatory** for this bounded read-only MVP. Adding them requires a documented use case and compatibility/auth decision; no speculative integrations.
- **Deployment:** no approved production subdomain, DNS configuration, frontend hosting platform, service credentials or deployed chain address exists for Grow. Do not guess them. If eventual production build uses hosted APIs, publish a non-secret env reference, health/availability, TLS, rollback and monitoring plan.

## 4. Security, privacy, trust model and invariants

Trust boundaries: canonical Registry/Identity/rights/payment authority stays with owning protocol; 420Location supplies non-authoritative location/Place projection; map providers are untrusted external data. A Grow frontend is untrusted presentation. Business names, verification badges and provider records must not be treated as proof of safety, identity or endorsement.

**Invariant G1:** `PUBLIC` and specifically authorized shareable records only appear in public Grow responses; absent/unknown visibility fails closed.

**Invariant G2:** a Grow consumer cannot increase coordinate precision beyond upstream source visibility; `PRIVATE`, residential, approximate-only and disallowed records cannot leak precise coordinates through cards, logs, map markers, route links, error messages or analytics.

**Invariant G3:** provider migration cannot alter canonical `place_id`, Registry record or identity/ownership state.

**Invariant G4:** empty/stale/unavailable/invalid upstream discovery cannot synthesize legitimate public places or verification.

**Invariant G5:** no read-only Grow operation can mutate canonical Registry, Identity, Wallet, token, governance, payment or ownership state.

**Invariant G6:** no new launch link or canonical service identity is enabled without GROW-02 authority and valid signed/verified discovery.

**Threat cases:** private farm/home geolocation exposure, geocoding precision escalation, false business provenance, malicious provider records/links, stale/tampered Place entries, external URL injection, unbounded queries, scraping/rate-abuse, index privacy leaks, and wrong-chain/provenance confusion. Treat claims and editing as unsupported until explicit scoped authorization and anti-replay flows exist.

## 5. Release classification and unresolved decisions

**Current classification:** **pre-implementation, non-Genesis-approved product candidate**. Target the bounded browse-only MVP for **repository Level 1/2 qualification, then production-equivalent testnet integration when shared services are available**, without claiming Genesis or production launch rights. This is a staged engineering objective, not a new Genesis decision.

**Governance / protocol gates (explicitly outstanding):** GROW-02 must decide whether Grow is (a) a consumer-only branded UI discoverable through an existing verified service manifest, or (b) a separately registered application/service requiring new canonical ID and explicit catalog changes. No change is implied here. A separate product decision is required before adding any cultivation, marketplace or regulated transaction features.

**Milestones:** GROW-01/02 product-and-authority milestone (definition and protocol identity); GROW-03 through GROW-07 implementation/integration milestone (Level 2 once converged); GROW-08/09/10 app audit/qualification and release closeout (Level 3 once at final app phase). No step IDs renumbered.

## 6. GROW-01 acceptance criteria / Level 1

1. Normative purpose and source trace are documented without pretending missing historical requirements existed.
2. Narrow user-facing workflows, excluded/unapproved capabilities and measurable behavior are recorded.
3. Trust/data/permission/identity boundary, invariants, threat cases and direct/optional dependencies are explicit.
4. Release class and frozen Genesis/catalog restriction are unambiguous.
5. Application components, downstream roadmap ownership and Level 1/2/3 milestones are mapped.
6. A targeted verifier confirms this spec, ledger identity and unchanged critical canonical exclusions on a known commit.
7. Only documentation and app-local verifier/workflow changes are introduced; no Solidity/Genesis catalog or service-ID modification.
8. Durable qualification evidence identifies the exact implementation SHA and all skipped/deferred checks accurately.

**Qualification note:** this step defines the conservative implementation baseline; it does not approve eventual commercial product expansion or Genesis admission. All app build/test/security/integration gates remain open for subsequent GROW steps.
