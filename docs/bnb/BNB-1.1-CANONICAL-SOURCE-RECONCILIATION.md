# 420BnB — BNB-1.1 Canonical Source Reconciliation

**Status:** RECONCILED (source inventory only; not application or release qualification)  
**Baseline main:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c` (2026-10-09)  
**Working branch:** `audit/420bnb-bnb-1-1-source-reconciliation-20261009`  
**Roadmap step:** BNB-1.1 — Canonical source reconciliation. Inventory existing repository requirements, Genesis exclusions, architecture, PRs and compatibility interfaces. Identify contradictions and missing specifications.  
**Qualification:** Level 1: source review, complete repository tree discovery, reconciled traceability and document integrity. No executable BnB source was modified. Level 2 M1 and Level 3 phase closeout are not claimed.

## Authority and scope

Repository evidence prevails over conversations and proposals. Frozen `config/genesis-applications.json` is authoritative for Genesis application promotion, while `config/genesis-consumer-services.json` is a replaceable consumer-service composition registry, not an amendment to the frozen catalog. This step **does not** enable reservations, modify Genesis decisions, or claim an independently deployed 420BnB service.

The intended product (subject to BNB-1.2 formal approval) is a complete accommodation marketplace with guest and host experiences, property listings, discovery, calendars, quotes, reservations, payments, cancellation/refund/payout policies, verifications, reputation, cannabis-aware attributes and 420Travel integration. This is **product intent**, not verified functionality.

## Reconciled authoritative source inventory

| Source | Observed constraint or evidence | Authority / disposition |
| --- | --- | --- |
| `config/genesis-applications.json` | Frozen Genesis application decision v9; no BnB promotion evidenced in the main tree review | Frozen Genesis catalog; do not change implicitly |
| `config/genesis-consumer-services.json` | Defines shared consumer service conventions, `Booking` object, `travel.bnb_booking` default false; no standalone BnB service record | Genesis consumer composition baseline; future registry decision required |
| `docs/genesis-services/GEN-SVC-0-ROADMAP.md` | Shared IDs, provenance/visibility/moderation, typed SDK, versioned APIs, idempotency, on/off-chain split; full BnB booking deferred | Shared architecture constraints |
| `docs/genesis-services/GEN-SVC-3-TRAVEL.md` | GEN-SVC-3.9 reserves BnB schemas only; no booking, escrow, pricing or settlement authority; GEN-SVC-3.10 requires fail-closed booking | Canonical Travel scope; not full BnB spec |
| `config/420travel-genesis.json` | Deferred: `420BNB_BOOKING`, `DYNAMIC_PRICING`, `HOST_ESCROW`, `CANCELLATION_SETTLEMENT`, `INSURANCE_OR_DAMAGE_DEPOSITS`; BnB compatibility disabled | Active Travel Genesis guard |
| `genesis/svc3/travelapp/compatibility.go` | Version `travel-compat/v1`; Property, Host, Guest, Availability, NightlyPrice, Reservation; structural validation; `GenesisTravelTransactions` methods unconditionally return `ErrTravelTransactionDisabled` | Concrete reserved schema, **not** a booking runtime |
| `genesis/svc3/travelapp/COMPATIBILITY.md` | No authoritative host, availability, pricing, payments, identity, ledger or provider; explicit external authorization requirements | Implementation boundary and limitations |
| `genesis/svc3/travelapp/compatibility_test.go` | BnB/DOOBR compatibility regression tests present | Targeted existing regression inventory; not run in this step |
| `genesis/svc3/travelapp/handler.go`, `handler_test.go`, `README.md` | Unsupported booking endpoints intentionally absent; Travel advertises BnB transactions unavailable | Fail-closed user surface |
| `scripts/validate-gen-svc-3.py` | Asserts BnB default disabled and deferred scopes | Existing Genesis validator; not full BnB qualification |
| `.github/workflows/gen-svc-3.yml` | Scoped Travel Python verifier, Go test/vet/build; trigger paths exclude new `docs/bnb/**` | Existing CI ownership, no BnB-specific workflow |
| `docs/audit/420TRAVEL-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md` and Travel release gates | Live Travel integrations are independently gated | Dependency only, not BnB certification |
| `config/system-addresses.json`, `contracts/config/system-addresses.json`, `config/extended-system-addresses.json` | Existing address authority maps | Must review before proposing BnB contracts or reserved addresses |
| PR [#337](https://github.com/abvhiael/420-integrated-v0.1/pull/337) | GEN-SVC-0 architecture and explicit deferred BnB booking | Historical architecture evidence |
| PR [#340](https://github.com/abvhiael/420-integrated-v0.1/pull/340) | 420Travel MVP with BnB forward compatibility, no transaction flows | Historical scope evidence |
| PR [#356](https://github.com/abvhiael/420-integrated-v0.1/pull/356) | Travel implementation; fail-closed BnB boundary | Historical implementation evidence |

**Repository-tree caveat:** the recursive `main` tree returned `truncated=false`; no path dedicated to `bnb/`, `420bnb/` or equivalent application name appeared. BNB/BNB-mainnet paths under `contracts/src/bridge` and `contracts/config/bridge` refer to **BNB Chain**, not the 420BnB accommodation product. Do not misclassify these bridge files as accommodation contracts.

## Requirement-by-requirement reconciliation

Status describes existing 420BnB implementation **not** intended product priority.

| ID | Requirement / source | Verified state | Status | Follow-up |
| --- | --- | --- | --- | --- |
| BNB-S01 | Genesis catalog authority — frozen catalog / GEN-SVC-0 | No standalone Genesis application authorization | BLOCKED | Explicit governance decision if seeking Genesis catalog promotion |
| BNB-S02 | Shared Booking schema and API conventions — GEN-SVC-0 | Shared vocabulary and conventions exist; BnB service contract absent | PARTIAL | BNB-1.3, 1.6 |
| BNB-S03 | BnB compatibility records — GEN-SVC-3.9 | Six planning-only Go structs and structural validation | PARTIAL | Map to authoritative future BnB models |
| BNB-S04 | Booking disabled at Genesis — GEN-SVC-3.9 / config | Explicit fail-closed gateway / default false | COMPLETE | Preserve while adding separately reviewed booking implementation |
| BNB-S05 | Host and guest authorization | Identity references only; no verified session/ownership model for BnB | MISSING | BNB-1.2–1.4, 1.8 |
| BNB-S06 | Property listing and host administration | No standalone BnB app tree found | MISSING | BNB-1.2, 1.3, 1.7 |
| BNB-S07 | Discovery / availability / calendar | Travel public discovery exists; BnB availability non-authoritative | MISSING | BNB-1.3, 1.6, 1.7 |
| BNB-S08 | Price quote and booking lifecycle | Non-binding price placeholder; transactions disabled | MISSING | BNB-1.3, 1.5, 1.6 |
| BNB-S09 | Pay, escrow, refunds, settlement, host payouts | No BnB-specific payment executor; Travel forbids transactions | MISSING | BNB-1.4, 1.5 |
| BNB-S10 | Identity, Registry, Verify, Reputation, Travel | Shared service constraints defined; no live BnB adapters shown | PARTIAL | BNB-1.4, 1.8 |
| BNB-S11 | Cannabis-friendly host rules / jurisdiction handling | Travel descriptive attributes only, not booking permission | PARTIAL | BNB-1.2, 1.8 |
| BNB-S12 | BnB data protection, concurrency, replay, audit events | GEN-SVC conventions exist, no BnB executable guarantees | MISSING | BNB-1.3, 1.6, 1.8 |
| BNB-S13 | Independent BnB frontend, backend, SDK, deployments | No independently versioned BnB directory or build identified | MISSING | BNB-1.6, 1.7, 1.9 |
| BNB-S14 | Dedicated BnB tests and CI | Only Travel compatibility and disabled-path assertions identified | PARTIAL | Define at BNB-1.10; implement as code is delivered |
| BNB-S15 | BnB product / operations manual | No dedicated BnB manual identified | MISSING | BNB-1.2–1.10 |

## Contradictions and decisions to resolve

1. **Marketplace intent vs Genesis exclusion:** A full Airbnb-like marketplace is a proposed target; Genesis explicitly reserves only compatibility hooks. This is **not** permission to change a frozen decision or enable transaction methods. Resolve product release stages in BNB-1.2 and application promotion via separate authorized decision if required.
2. **Travel `Booking` / BnB `Reservation` overlap:** The shared vocabulary includes `Booking`, while Travel compatibility defines `Reservation`. Ownership, identifiers, state transitions, canonical-vs-derived status and schema migration need a decision in BNB-1.3; do not create duplicate booking authority.
3. **Payments and custody:** Travel prohibits escrow and cancellation settlement. A BnB booking service must integrate approved Pay / Arbitration authorities without inventing local funds custody. Detailed interfaces, deposit/damage rules, fiat-price representation, fees and refund policy remain unspecified (BNB-1.4–1.5).
4. **Property visibility:** Travel's public place records are not authority to publish exact private accommodation addresses; host consent, guest access policy, verification and location privacy are unspecified (BNB-1.3/1.8).
5. **Legal / platform policy:** Cannabis-friendly descriptors do not establish lawful consumption, zoning, age, short-term-rental licensing or insurance. BNB-1.8 must specify jurisdiction-aware policy and actual operator review.
6. **Availability correctness:** Planning `Availability` is not authoritative occupancy. Reservation locking, time zones, DST, overlap, expiry, rollback and multi-instance contention need an explicit BnB authority and invariants (BNB-1.3/1.6).
7. **CI wiring:** Existing `GEN-SVC-3 Travel` workflow has no trigger for independent `docs/bnb/**` work; app-specific Level 1 CI must be designed rather than borrowed from unrelated pipelines.
8. **Frozen / reserved addresses:** No BnB deployment-address assignment was established. Do not make one or reuse a reserved system address before relevant protocol and governance reconciliation.

## BNB-1 handoff (canonical step numbers preserved)

- **BNB-1.2** Product scope and user journeys: ratify guest/host/manager/moderator/admin permissions, feature/launch matrix, full vs Genesis subset.
- **BNB-1.3** Domain model and state machines: resolve Booking/Reservation, availability/quotes/holds/expiration/cancel/refund and lifecycle ownership.
- **BNB-1.4** Protocol authority and integration boundaries: integration contracts, approved owners and failure modes.
- **BNB-1.5** Payment and settlement architecture: native $420, Pay/Swap-qualified routes, refund and payout authority.
- **BNB-1.6** Backend, API and persistence architecture.
- **BNB-1.7** Frontend and user experience architecture.
- **BNB-1.8** Security, privacy and regulatory boundaries.
- **BNB-1.9** Deployment and release architecture.
- **BNB-1.10** Qualification, documentation and phase closeout.

## Qualification and limitations

- **Level 1 BNB-1.1 review:** verified main commit, exhaustive nontruncated tree, selected canonical files, Travel validation workflow and related PR descriptions. Documentation-only change; no executable code, contracts, manifests, flags or addresses changed.
- **Not executed:** `go test`, `go vet`, `go build`, Python verifiers, dedicated BnB CI (none identified), browser acceptance and financial/security dynamic checks. Passing claims are **not** made for any of them.
- **Evidence:** this retained inventory links each observation to authoritative source paths. A dedicated exact-SHA CI assertion and proof remain outstanding before declaring BNB-1.1 *fully Level-1 qualified*.
- **Level 2:** M1 after BNB-1.3. **Level 3:** single complete BNB-1 phase closeout after BNB-1.10.
