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
| L02.7 | Driver availability and offers — online/offline controls, freshness, offer countdowns, acceptance/rejection, capacity, safe disconnect recovery | **COMPLETE — Level 1 PASS**; [exact-SHA certificate](L02.7-LEVEL1-EVIDENCE.md) for `38e2c668cdfe4a2608be574f519dc0910bcb9fd5`, [successful PostgreSQL workflow #38664005629](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38664005629); offer rejection explicitly cancels the rider request (automatic rematch not claimed); testnet/live approval deferred |

| M-L02-A | Level 2 milestone — rider booking journeys and driver onboarding with backend; expired sessions, revoked eligibility, inaccessible locations and quote changes | **COMPLETE — Level 2 PASS**; [M-L02-A certificate](M-L02-A-LEVEL2-EVIDENCE.md), exact implementation `596bcfc329555916e26f42a50702481b0f348193`; [successful run #38654899486](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38654899486); external acceptance retained |

**Operational acceptance:** Production Identity, live transport eligibility, private document-vault/reviewer controls, participant-scoped messaging, and independent accessibility remain **NOT ACCEPTED**. All deployed/independent acceptance work is explicitly tracked in [LIFTd Testnet Roadmap](LIFTD-TESTNET-ROADMAP.md), linked to [Production Acceptance Register](L02-PRODUCTION-ACCEPTANCE-REGISTER.md). Only environment-independent L02 implementation/remediation stays in this phase; no testnet or regulator PASS is implied by repository CI.

### Remaining canonical Phase L02 steps — restored from owner-provided roadmap

The following sequence was previously specified to the repository owner but was omitted from the repository roadmap. It is restored verbatim in scope and numbering. Its absence was a documentation omission, **not** authorization to invent a different numbering sequence. The prior L02.1–L02.7 and M-L02-A qualified records above remain authoritative evidence; this table defines outstanding work, not a claim of implementation or qualification.

| Step | Canonical deliverable | Status |
| --- | --- | --- |
| L02.8 | **Driver trip controls** — Navigation handoff, arrival/start/completion controls, pickup confirmation and safety workflows. Offline actions must reconcile without fabricating authoritative trip state. | **COMPLETE — Level 1 PASS (repository scope)**; [L02.8 certificate](L02.8-LEVEL1-EVIDENCE.md), implementation `706a58c11d5d8b32d5575554b6e8f71d46d1938c`; independently deployed navigation and official transport acceptance deferred |
| L02.9 | **Communication and notifications** — Trip-scoped rider/driver communication and updates. Enforce membership expiry, delivery preferences and redaction of sensitive information. | **COMPLETE — Level 1 PASS (repository scope)**; [L02.9 certificate](L02.9-LEVEL1-EVIDENCE.md), implementation `9ebb692b3ae96751ca824048d70bb65ee7f9f404`; live Messenger/Notifications delivery and independent encrypted transport remain NOT ACCEPTED |
| L02.10 | **Operator console** — Dispatch monitoring, eligibility status, incident triage and recovery tools with least-privilege access and audited actions. | **COMPLETE — Level 1 PASS (repository scope)**; [L02.10 certificate](L02.10-LEVEL1-EVIDENCE.md), implementation `a905ab51e7270333ecd856a0540f31ad5fca0177`; external operator deployment/credential and independent regulatory acceptance deferred |
| L02.11 | **APIs, SDK and Travel handoff** — Publish versioned interfaces and consuming-app tests. Travel handoffs carry bounded context and require LIFTd authorization and fresh consent. Preserve disabled Genesis transaction boundaries. | **COMPLETE — Level 1 PASS (repository scope)**; [L02.11 certificate](L02.11-LEVEL1-EVIDENCE.md), implementation `fdd6b0ae3570b401f9b56e99920ffe797bfa7c93`; external Travel deployment and independently verified live consent remain NOT ACCEPTED |
| L02.12 | **Accessibility and device qualification** — Test keyboard navigation, screen readers, responsive layouts, mobile permissions, reconnects and recoverable errors. Retain independent device/manual acceptance requirements where unavailable. | **COMPLETE — Level 1 PASS (repository-automated scope)**; [L02.12 certificate](L02.12-LEVEL1-EVIDENCE.md), qualified implementation `b94e3d1316303838ca09ed0ba713edd066c2c5e0`; independent physical-device/screen-reader WCAG acceptance remains NOT ACCEPTED under LIFTd-TN-A11Y |
| M-L02-B | **Level 2 milestone** — Qualify complete rider/driver/operator journeys, communication, consuming-app integration and client security. | **COMPLETE — Level 2 PASS (repository-integrated scope)**; [M-L02-B certificate](M-L02-B-LEVEL2-EVIDENCE.md), qualified implementation `d1f0b1e057815e187eb1d70c30acabee20e5b62b`; external integrations and independent accessibility/operational acceptance remain NOT ACCEPTED |
| L02.13 | **Phase closeout** — Single L02 Level 3 qualification, exact-SHA evidence, current-main reconciliation, security disposition and retained external deferrals. | **COMPLETE — Level 3 PASS (repository scope)**; [L02.13 exact-SHA certificate](L02.13-LEVEL3-CERTIFICATE.md); five mandatory owners PASS with recorded original run SHAs, independent live/testnet gates NOT ACCEPTED; merge remains separately authorized |

**Execution order:** after current L02.1–L02.7/M-L02-A reconciliation qualifies, the next canonical implementation step is **L02.8**, followed by L02.9, L02.10, L02.11, L02.12, M-L02-B, and L02.13. Do not renumber, combine, or replace these steps. Testnet/independent acceptance continues to be governed separately by the retained testnet roadmap and production acceptance register.



## Phase L03 — service operations and release (original owner-supplied roadmap — RESTORED)

**Canonical authority:** The following original L03 roadmap was explicitly supplied by the repository owner on 2026-10-16. Its numbering, order, milestones and named deliverables override the unauthorized alternate sequence introduced by PR #680. **PLANNED — no L03 step has started.** Do not silently modify or renumber; proposed changes require a separate explicit owner-approved roadmap amendment.

| Step | Original canonical deliverable | Status |
| --- | --- | --- |
| **L03.1 — Support and dispute cases** | Structured cases for cancellations, no-shows, fare complaints, lost property and incidents. Apply evidence access, retention, escalation and appeal rules. | **COMPLETE — Level 1 PASS (repository scope)**; [L03.1 exact-SHA certificate](L03.1-LEVEL1-EVIDENCE.md), implementation `29bdb1f2a3acc4f91ac9bd16e67d45f2db7f04e8`; external/private evidence-vault and real transport acceptance remain NOT ACCEPTED |
| **L03.2 — Reviews and reputation** | Permit reviews from qualified trip interactions; enforce domain scope, anti-replay and moderation. Ratings must not substitute for transport eligibility. | **COMPLETE — Level 1 PASS (repository scope)**; [L03.2 certificate](L03.2-LEVEL1-EVIDENCE.md), implementation `3dc19bba352e3f39c333002e91067804e235890b`; independent operational acceptance NOT ACCEPTED |
| **L03.3 — Abuse and fraud controls** | Address account misuse, fabricated trips, location manipulation, coordinated reviews and economic replay. Provide auditable decisions and bounded remediation. | **PLANNED — Level 1** |
| **L03.4 — Economic reconciliation** | Reconcile trip, quote, payment, refund and payout histories. Apply approved platform/driver/compensation splits and prove conservation and duplicate protection. | **PLANNED — Level 1** |
| **L03.5 — Privacy and retention operations** | Implement retention schedules, access/export/deletion workflows, incident evidence restrictions and redacted telemetry. | **PLANNED — Level 1** |
| **M-L03-A — Level 2 milestone** | Qualify support, disputes, reputation, fraud controls, economic reconciliation and privacy together. | **PLANNED — Level 2** |
| **L03.6 — Deployment and managed security** | Production packaging, TLS, managed keys, least-privilege database access, migrations, health/readiness checks and rollback procedures. | **PLANNED — Level 1** |
| **L03.7 — Reliability and capacity** | Multi-instance dispatch, load tests, worker failure, stale availability, provider outages, queue recovery and database backup/restore. | **PLANNED — Level 1** |
| **L03.8 — Operational safety acceptance** | Independently verify incident procedures, support responsibilities, escalation, operator access and emergency/recovery drills. | **PLANNED — Level 1; independent acceptance gate retained** |
| **L03.9 — Launch-jurisdiction acceptance** | Obtain independently authorized passenger-transport, driver, vehicle, insurance and service-area acceptance for the chosen market. | **PLANNED — Level 1 tracking; external approval required** |
| **L03.10 — Official-testnet integration** | Demonstrate real Identity/Wallet/Pay/Registry integration, consent, finality, reorg recovery, refunds, payouts, revocation and consuming-service behavior. | **PLANNED — Level 1 tracking; deployed testnet evidence required** |
| **M-L03-B — Level 2 milestone** | Qualify deployment, reliability, official-testnet integration and accepted operational controls together. | **PLANNED — Level 2; cannot PASS without external acceptance** |
| **L03.11 — Controlled pilot** | Run an explicitly authorized, limited pilot with accepted drivers/vehicles, service boundaries, monitoring, support and stop/recovery criteria. | **PLANNED — Level 1 tracking; real-world authorization required** |
| **L03.12 — Release closeout** | Single L03 Level 3 qualification and release decision. Record accepted environments, limitations, unresolved findings and operating ownership. | **PLANNED — Level 3** |

**Locked sequence:** L03.1 → L03.2 → L03.3 → L03.4 → L03.5 → M-L03-A → L03.6 → L03.7 → L03.8 → L03.9 → L03.10 → M-L03-B → L03.11 → L03.12.

**Qualification and external authority:** Repository-only Level 1 tests cannot certify the independently authorized operational acceptance expressly required by L03.8–L03.11. These steps retain their original place and acceptance meaning. Actual testnet/real-world proof remains tracked by [LIFTd Testnet Roadmap](LIFTD-TESTNET-ROADMAP.md) and [Production Acceptance Register](L02-PRODUCTION-ACCEPTANCE-REGISTER.md), with **NOT ACCEPTED** statuses until independent evidence arrives; no mocks or documentation count as live evidence. Level 3 runs once at L03.12 after exact-SHA reconciliation and full preflight, preserving passing global evidence under the repository-wide policy.

**Incident:** PR #680 replaced this owner-supplied sequence with an unapproved alternate. Restoration of the original is a roadmap correction, not a newly approved scope change.

## Initial trip invariants

`REQUESTED -> ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED`. Rider or assigned driver can cancel before start. Terminal trips cannot reopen. Starting an active trip requires fresh admission bound to trip, driver, vehicle and route. Suspension blocks assignment/arrival/start while preserving pre-trip cancellation and recording an in-progress completion. Active-trip interruption must enter a future safety-resolution workflow, never masquerade as an ordinary cancellation/refund.

The L01.1 kernel is an in-memory pure domain function. Caller principals and admission decisions are **trusted internal inputs**, not verified credentials. Optimistic revision checking rejects stale snapshots but does not serialize multiple processes. L01.2 supplies protected HTTP/service adapters and independent Identity/session verification; L01.4 supplies durable PostgreSQL trip/event/command storage; no deployed HTTP listener, real booking, location lookup, payment, regulatory approval or driver dispatch is enabled. Those are explicit later steps.
