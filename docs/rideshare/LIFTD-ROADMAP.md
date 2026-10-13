# LIFTd — canonical 420Rideshare development roadmap

Public working brand: **LIFTd**, following the owner's latest spelling. Earlier concept name: LIFTED. Technical application: 420Rideshare. This is a first-party passenger transportation application, separate from DOOBr delivery. No launch region, fare, platform percentage, development-compensation allocation or trademark clearance is approved by this roadmap.

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
| L01.1 | Inventory, canonical scope, integration ownership, trip invariants, fail-closed domain kernel and scoped CI | Implemented candidate; see evidence record |
| L01.2 | Independently authenticated rider/driver/operator sessions, recovery/revocation, authorization tests | Pending — next |
| L01.3 | Driver/vehicle registry projections and jurisdiction-scoped eligibility adapters | Pending |
| L01.4 | Durable PostgreSQL trip/event store, uniqueness, transactional compare-and-swap, idempotency/replay and restart tests | Pending |
| L01.5 | Location routing adapter, private pickup/drop-off storage, scoped access, precision and retention | Pending |
| M-L01-A | Level 2: identity + eligibility + durable trip + Location integration | Pending |
| L01.6 | Driver availability, vehicle capacity, deterministic matching, assignment expiry and concurrent dispatch | Pending |
| L01.7 | Immutable expiring fare quotes, currency/rounding, rider consent and explicit cancellation policy | Pending; economics undecided |
| L01.8 | Scoped Pay/Wallet intents, receipts/finality, cancellation/refund and payout projections | Pending; live acceptance separately gated |
| L01.9 | Safety incident workflow, active-trip resolution, pause/recovery, bounded operator permissions and privacy | Pending |
| M-L01-B | Level 2: dispatch + economics + safety integration/adversarial checks | Pending |
| L01.10 | Single Phase L01 Level 3 qualification, current-main reconciliation and retained deferrals | Pending |

## Phase L02 — rider, driver and operator applications

Define detailed steps at L01 closeout using the actual service interfaces. Scope: accessible responsive rider request/quote/trip screens; driver onboarding/availability/assignment/navigation; operator dispatch and incident console; authenticated APIs/SDK; scoped messaging/notifications; Travel handoff; keyboard, mobile, screen-reader and consuming-app qualification. No demo may imply real vehicle availability or accepted payment.

## Phase L03 — service operations and release

Define detailed steps after L02 integration qualification. Scope: disputes/reviews, abuse controls, observability/redacted telemetry, managed keys, multi-instance concurrency/failover, backups/restore, operational drills, independently approved launch-jurisdiction controls, official-testnet integration, release acceptance. Commercial launch requires independent transport, insurance and operational approval; coding progress cannot grant it.

## Initial trip invariants

`REQUESTED -> ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED`. Rider or assigned driver can cancel before start. Terminal trips cannot reopen. Starting an active trip requires fresh admission bound to trip, driver, vehicle and route. Suspension blocks assignment/arrival/start while preserving pre-trip cancellation and recording an in-progress completion. Active-trip interruption must enter a future safety-resolution workflow, never masquerade as an ordinary cancellation/refund.

The L01.1 kernel is an in-memory pure domain function. Caller principals and admission decisions are **trusted internal inputs**, not verified credentials. Optimistic revision checking rejects stale snapshots but does not serialize multiple processes. No HTTP server, real booking, location lookup, database, payment, regulatory approval or driver dispatch exists yet. Those are explicit later steps.
