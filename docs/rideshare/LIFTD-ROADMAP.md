# LIFTd — canonical 420Rideshare development roadmap

Public working brand: **LIFTd**, following the owner's latest spelling. Earlier concept name: LIFTED. Technical application: 420Rideshare. This is a first-party passenger transportation application, separate from DOOBr delivery. First launch market: **Vancouver, British Columbia, Canada**, selected by the owner on 2026-10-13, matching DOOBr's initial market. This market decision does not grant passenger-transport authorization or automatically include all Metro Vancouver municipalities or YVR. Vancouver pilot fare, driver compensation, platform allocation and development allocation were adopted by the owner on 2026-10-13; see [economic policy v2](LIFTD-VANCOUVER-PILOT-ECONOMIC-POLICY.md). Trademark clearance, detailed cancellation/waiting policies and operating-cost validation remain pending.

## Repository baseline and ownership

Started from main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48` on 2026-10-13. Inventory found no existing rideshare implementation, contract, configuration or canonical roadmap. Existing foundations to consume:

| Owner | Existing source | LIFTd boundary |
| --- | --- | --- |
| Location | `location/providers/provider.go`, `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` | Provider-neutral routing; private pickup/destination coordinates remain off-chain and access-scoped. |
| Travel | `docs/genesis-services/GEN-SVC-3-TRAVEL.md`, `genesis/svc3/travelapp/` | Discovery/handoff only; do not activate Genesis transactions or invent a Travel booking authority. |
| Identity / Wallet | `packages/420-sdk/src/wallet.ts`, `services/420bnb/identity.py` | Reuse owner interfaces/patterns; require authenticated sessions, revocation, account binding and explicit consent. |
| Compliance | `docs/doobr/DOOBR-R01-4-BC-VANCOUVER-COMPLIANCE-CONTRACT.md` | Delivery acceptance cannot authorize passenger transport. Separate service/jurisdiction/driver/vehicle approvals required. |
| Pay / Treasury | `services/420bnb/README.md`, canonical Pay contracts | Quote-bound intents, canonical finality/refunds and conserved splits; trip completion does not capture payment. |
| DOOBr | `doobr/`, `docs/doobr/` | Evaluate reusable scheduling/dispatch patterns; delivery code is not qualified rideshare machinery. |
| Reputation / Arbitration / Notifications | existing owner modules | Scoped trip interaction evidence, disputes and redacted notifications; no duplicate protocol authority. |

## Qualification rules

Level 1 per implementation step; Level 2 only at the named milestones; one Level 3 closeout per phase. Evidence must identify the exact executable SHA. Evidence-only commits inherit that SHA. Do not dispatch global Solidity/Genesis/Integrated/Docs for ordinary steps. At phase closeout, qualify affected canonical owners according to repository policy; Solidity owns Foundry once, Genesis owns address authority. Repository qualification, independent operational acceptance and live/testnet acceptance are distinct.

## Phase L01 — core service and authority foundation

| Step | Deliverable | Current status |
| --- | --- | --- |
| L01.1 | Inventory, canonical scope, integration ownership, trip invariants, fail-closed domain kernel and scoped CI | Level 1 qualified; see evidence record |
| L01.2 | Independently authenticated rider/driver/operator sessions, recovery/revocation, authorization tests | COMPLETE — Level 1 PASS; see L01.2 evidence |
| L01.3 | Driver/vehicle registry projections and jurisdiction-scoped eligibility adapters | COMPLETE — Level 1 PASS; see L01.3 evidence |
| L01.4 | Durable PostgreSQL trip/event store, uniqueness, transactional compare-and-swap, idempotency/replay and restart tests | COMPLETE — Level 1 PASS; see L01.4 evidence |
| L01.5 | Location routing adapter, private pickup/drop-off storage, scoped access, precision and retention | COMPLETE — Level 1 PASS; see L01.5 evidence |
| M-L01-A | Level 2: identity + eligibility + durable trip + Location integration | COMPLETE — Level 2 PASS; see milestone evidence |
| L01.6 | Driver availability, vehicle capacity, deterministic matching, assignment expiry and concurrent dispatch | COMPLETE — Level 1 PASS; see L01.6 evidence |
| L01.7 | Immutable expiring fare quotes, currency/rounding, rider consent and explicit cancellation policy | COMPLETE — Level 1 PASS; see L01.7 evidence |
| L01.8 | Scoped Pay/Wallet intents, receipts/finality, cancellation/refund and payout projections | COMPLETE — Level 1 PASS; see L01.8 evidence; LC-01 policy conflict resolved at 10%; development execution awaits canonical settlement acceptance |
| L01.9 | Safety incident workflow, active-trip resolution, pause/recovery, bounded operator permissions and privacy | COMPLETE — Level 1 PASS; see L01.9 certificate |
| M-L01-B | Level 2: dispatch + economics + safety integration/adversarial checks | COMPLETE — Level 2 PASS; see M-L01-B certificate |
| L01.10 | Single Phase L01 Level 3 qualification, current-main reconciliation and retained deferrals | Pending |

## Phase L02 — rider, driver and operator applications

Define detailed steps at L01 closeout using the actual service interfaces. Scope: accessible responsive rider request/quote/trip screens; driver onboarding/availability/assignment/navigation; operator dispatch and incident console; authenticated APIs/SDK; scoped messaging/notifications; Travel handoff; keyboard, mobile, screen-reader and consuming-app qualification. No demo may imply real vehicle availability or accepted payment.

### L02 implementation steps

| Step | Deliverable | Current status |
| --- | --- | --- |
| L02.1 | Application shell and design system — responsive navigation, accessible components, loading/error states, authenticated routing and clear availability information | **COMPLETE — Level 1 PASS**; see [L02.1 certificate](L02.1-LEVEL1-EVIDENCE.md), qualified implementation `cedd39c6e1c6350587bf920290439b6ab271da89` |
| L02.2 | Rider account and preferences — account/session management, accessibility requirements, communication preferences and privacy controls | **COMPLETE — Level 1 PASS**; [exact-SHA certificate](L02.2-LEVEL1-EVIDENCE.md) for `67b8dfa6f1a25d78d5b0e9fb3e50ecf9ff009e73`; independent deployed Identity, notification and accessibility acceptance retained for integration/testnet |
| L02.3 | Pickup and destination entry — address/place search, explicit location permission, manual entry, pickup clarification, route preview and recoverable provider failures | **COMPLETE — Level 1 PASS**; [exact-SHA certificate](L02.3-LEVEL1-EVIDENCE.md) for `fe2819b2c5870048b8af74dc7d925a1c8b1e2b41`; live provider/search and independent accessibility acceptance retained for L02 integration |
| L02.4 | Quote and ride request — display complete fare, expiry, cancellation terms and payment state; require explicit consent and prevent duplicates | **COMPLETE — Level 1 PASS**; [exact-SHA certificate](L02.4-LEVEL1-EVIDENCE.md) on `7b2e8e29cd4e586c8e82fe0821f46fb92d0442e1`; actual Wallet/Pay finality and deployed approval remain gated |
| L02.5 | Rider trip experience — show assignment, driver/vehicle identification, arrival, trip progress and completion; scoped contact, cancellation and incident reporting; distinguish estimates and confirmed events | **COMPLETE — Level 1 PASS**; [reconciled certificate](L02.5-LEVEL1-EVIDENCE.md), implementation `cd5948c2227daa76f6969643eda4e35c037ba79d`; participant-scoped messaging remains NOT ACCEPTED for live use |
| L02.6 | Driver onboarding — driver/vehicle submission, eligibility status, document lifecycle and remediation; protect sensitive material from public discovery | **COMPLETE — Level 1 PASS**; [exact-SHA certificate](L02.6-LEVEL1-EVIDENCE.md) `c70f2681f375bafcf35d2e78891075acdc810aa7`; live vault/reviewer and external eligibility acceptance remain gated |

| M-L02-A | Level 2 milestone — rider booking journeys and driver onboarding with backend; expired sessions, revoked eligibility, inaccessible locations and quote changes | **COMPLETE — Level 2 PASS**; [M-L02-A certificate](M-L02-A-LEVEL2-EVIDENCE.md), exact implementation `596bcfc329555916e26f42a50702481b0f348193`; [successful run #38654899486](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38654899486); external acceptance retained |

**Operational acceptance:** Production Identity, live transport eligibility, private document-vault/reviewer controls, participant-scoped messaging, and independent accessibility remain **NOT ACCEPTED**; see [Production Acceptance Register](L02-PRODUCTION-ACCEPTANCE-REGISTER.md). Repository CI PASS does not substitute for deployed service or independent approvals.

Detailed subsequent steps remain to be reconciled with existing L01 service interfaces at the L01 phase-closeout boundary. This entry does not renumber, merge or silently replace future canonical steps.

## Phase L03 — service operations and release

Define detailed steps after L02 integration qualification. Scope: disputes/reviews, abuse controls, observability/redacted telemetry, managed keys, multi-instance concurrency/failover, backups/restore, operational drills, independently approved launch-jurisdiction controls, official-testnet integration, release acceptance. Commercial launch requires independent transport, insurance and operational approval; coding progress cannot grant it.

## Initial trip invariants

`REQUESTED -> ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED`. Rider or assigned driver can cancel before start. Terminal trips cannot reopen. Starting an active trip requires fresh admission bound to trip, driver, vehicle and route. Suspension blocks assignment/arrival/start while preserving pre-trip cancellation and recording an in-progress completion. Active-trip interruption must enter a future safety-resolution workflow, never masquerade as an ordinary cancellation/refund.

The L01.1 kernel is an in-memory pure domain function. Caller principals and admission decisions are **trusted internal inputs**, not verified credentials. Optimistic revision checking rejects stale snapshots but does not serialize multiple processes. L01.2 supplies protected HTTP/service adapters and independent Identity/session verification; L01.4 supplies durable PostgreSQL trip/event/command storage; no deployed HTTP listener, real booking, location lookup, payment, regulatory approval or driver dispatch is enabled. Those are explicit later steps.
