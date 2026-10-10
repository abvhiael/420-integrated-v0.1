# GROW-V2-01 — Expanded product decision, personas and approved scope

**Decision:** APPROVED PRODUCT EXPANSION for implementation planning on 2026-10-08. **Execution status:** scope and contract specified; engineering delivered under later V2 steps. **Authority:** user direction to evolve 420Grow from read-only farm/business directory into cannabis cultivation operations software. This is a new, explicitly recorded app product decision; it does not retroactively rewrite GROW-01–GROW-10 results or silently amend frozen Genesis Application Decision #1.

## Canonical ancestry and limitations

Original app baseline: `docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md` (read-only public FARM/BUSINESS place discovery). Existing implementation: `grow/web`, `grow/service`, `grow/location`, app-specific `.github/workflows/420grow-fast.yml`. Existing original GROW-10 release qualification, deferred canonical Solidity full Foundry run 37825348329 and remaining live gates are preserved in `docs/audit/420GROW-TESTNET-AND-DEFERRED-QUALIFICATION-ROADMAP.md`. Existing location directory remains supported as an optional **public directory** distinct from new **private cultivation workspace**. No original GROW ID is renamed, invalidated, reclassified or claimed phase-qualified.

**Non-goals / authority constraints:** no new Genesis service ID, Registry authority, wallet identity claim, canonical chain contract, token, payment, cannabis sales marketplace, transport, dispensary operations, regulated reporting certification, autonomous hazardous actuator control, or public disclosure of private facilities is authorized by this scope decision. Any later promotion needs its own explicit approval, security audit and qualification.

## Product purpose and release tiers

420Grow is an owner- and operator-directed cultivation management platform for lawful home, licensed small-business and commercial/greenhouse cultivation. Manage plants and lineages, environmental observations, equipment, cultivation inputs and events, harvest analytics, inventory provenance and AI-assisted decisions. Cultivation features are tenant-private and cannot inherit anonymous permissions of the old public directory. A public place record is not a facility identity or tenancy membership.

- **Tier A: personal grower (initial MVP)** — private single-facility record management, limited users, manual entries, photographs, alerts and export; never assume cannabis home cultivation is lawful in every jurisdiction.
- **Tier B: small licensed operator** — multiple rooms/zones, team roles, inventory chain-of-custody, batch history, sensors and operator-reviewed adjustments.
- **Tier C: commercial / greenhouse** — multiple sites, granular delegated privileges, higher-volume telemetry, audit/retention and external compliance exports, robust integrations and operator health/rollback.
- **Read-only visitor** — accesses only separately opt-in PUBLIC directory content, with no inference about private facilities, plants or locations.

## Core product capabilities (five binding pillars)

1. **Plant lifecycle and genetics:** opaque facility/zone/plant IDs, strain/cultivar catalog, seed/clone/parent/propagation relationships, lifecycle state with event history, photo attachments, genealogy provenance, invalid-parent/cycle prevention, ownership authorization and immutable-ish audit trail.
2. **Environment and control:** greenhouse/room/zone topology; observed temperature, humidity, irrigation, light, nutrient and reservoir readings with units, source, timestamps and validity; alarms, calibration and sensor outage handling; equipment schedules/controls only through separately authorized and bounded adapters with physical/manual override and safe failure behavior.
3. **Harvest and analytics:** planned harvest windows, lifecycle calendar, recorded harvest weights and units, yield history and forecasting explicitly labelled estimates with uncertainty, exportability and reproducible metric definitions; never substitute predictions for observations.
4. **Inventory and traceability:** seed/clone/input/material/equipment/harvest lot records, custody/movement and adjustment events, reason, actor/time, quantity/unit, reconciliation, deduplication and audit; jurisdiction-configurable export only, not automatic regulatory compliance or seed-to-sale certification.
5. **AI assistance:** permitted anonymized/minimized images, sensor trends and plant history as opt-in inputs; explainable suggestions and confidence/limitations; human authorization for action; do not auto-run potentially hazardous electrical, chemical, HVAC or irrigation controls, and do not promote unverified advice to authoritative agronomic or legal guidance.

## Personas / complete workflows / acceptance conditions

| Persona | Required user journey | Acceptance |
| --- | --- | --- |
| Lawful home grower | Create private grow space -> register seed/plant -> log observations/photos -> review lifecycle and estimates -> record harvest/export | No account outside owner sees private records; complete positive and negative lifecycle tests |
| Cultivation technician | Authorized role checks assigned room -> logs readings, nutrient/irrigation events and plant movements -> responds to alert | Least privilege enforced on API, not only UI; independent tenant access denied |
| Facility manager | Create rooms/zones -> approve or reject adjustments -> review forecast and harvest/stock reconciliation -> export audit trail | All consequential changes actor/time attributed; stock never silently goes negative |
| Compliance / quality reviewer | Read immutable chronological lineage and movement history -> review correction reason -> generate jurisdiction-configurable report | Export source/provenance and correction history retained; never claim government submission without actual integration |
| Operator / equipment maintainer | Register sensor/adapters -> observe stale/invalid data -> acknowledge alarm -> physically override and safely recover device | Authenticated adapter operations; loss of comms cannot trigger unsafe autonomous control |
| Public visitor | View explicitly public FARM/BUSINESS entries in existing directory | Cannot enumerate private tenant, facility, plants, telemetry or credentials |

## Component boundaries, prerequisites and data ownership

- **New application domain:** account/tenant/facility, membership/role, room/zone, plant/cultivar, genetics graph, observation/telemetry, schedule/equipment, inventory ledger, harvest, audit, media reference, AI jobs/consents. Strong tenant isolation, ownership validation, versioned API and stable migrations; storage and models belong to 420Grow application, not canonical Registry/Location.
- **Architecture direction only:** Go services; responsive JS/TypeScript frontend; persistence via PostgreSQL or qualified equivalent; event/audit ledger; file/object store; sensor adapter abstraction (e.g., MQTT/Modbus/manufacturer APIs where permitted); workers for event processing. Concrete technical selections must be pinned and qualified by V2-02/V2-03, not treated as an existing deployment.
- **Existing 420Location:** optional independent public directory/provenance, explicit separate opt-in only; never use it to expose private home grow addresses.
- **420Identity/Wallet:** optional later ecosystem integration; initial authentication must have documented session lifecycle, MFA strategy and revocation; anonymous directory access conveys zero private authority.
- **420Notifications:** opt-in alert delivery and least-disclosing payloads; independent service contract qualification.
- **420AI/420Compute:** only approved secure job interface, bounded payloads and explicit data-use consent; no mandatory on-chain record of private cultivation telemetry.
- **420Storage / other services:** use only approved APIs after boundary and privacy qualification. No speculative chain or bridge integration.
- **Legal and safety:** jurisdiction, facility licensing and retention policies are configurable and require authoritative compliance review; platform does not assert legality or generate certified statutory reports by default. Equipment-control safety requires design hazard analysis and independently enforced limits.

## Product invariants / threat model

- **V2-P1 Tenant isolation:** account A cannot enumerate, read, modify, export or infer tenant B's facilities, plants, audit, sensors or media through API, search, cache, logs or AI payloads.
- **V2-P2 Privacy:** private facility coordinates and grow data never flow into 420Location's public projection absent separate explicit opt-in and visibility review. No defaults to public.
- **V2-P3 Traceability:** IDs remain stable; chronological history records actor, timestamp, source, quantity/unit and revision where relevant; destructive edits do not erase custody or audit provenance.
- **V2-P4 Integrity:** lineage cannot cycle; plant and inventory changes must respect lifecycle state, nonnegative accounting and idempotent ingest; reject malformed units, future timestamps beyond allowed tolerance and unauthorized replay.
- **V2-P5 Device safety:** equipment actuation is least-privileged, authenticated, bounded, observable and manually overridable. AI recommendations do not execute control commands.
- **V2-P6 Trust labeling:** observed readings, self-entered records, derived forecasts, image inferences, external source attestations and statutory status are explicitly distinct.
- **V2-P7 Data control:** export/deletion/retention, data-use consent, encryption, backup/restore and incident workflows must be qualified before handling real customer data.
- **V2-P8 Separation:** no new chain contracts, custody, token rewards, hidden Wallet/Registry authority or Genesis catalog admission without separately recorded decision.

Threat cases to qualify during implementation: cross-tenant IDOR, privilege escalation, stolen sessions, file upload abuse, forged/replayed sensor readings, clock skew, duplicate inventory events, AI prompt/payload leakage, untrusted photo metadata, compromised device, actuator runaway and privacy leaks via public maps or notification previews.

## Phase handoff (do not renumber established steps)

| Step | Scope | Level |
| --- | --- | --- |
| GROW-V2-01 | This product decision, personas, boundaries, acceptance and initial threat model | Level 1 |
| GROW-V2-02 | Architecture, tenancy/roles and security model | Level 1 |
| GROW-V2-03 | Persistence, schemas, migrations, backup semantics | Level 1 |
| GROW-V2-04 | Facilities, rooms and zones | Level 1 |
| GROW-V2-05 | Plants, genetics, propagation and lifecycle | **Level 2** cumulative V2-02–05 |
| GROW-V2-06 | Telemetry adapters and history | Level 1 |
| GROW-V2-07 | Safe equipment adapter/control design | Level 1 |
| GROW-V2-08 | Nutrients, irrigation and environmental history | Level 1 |
| GROW-V2-09 | Harvest and analytics | Level 1 |
| GROW-V2-10 | Inventory, traceability and compliance exports | **Level 2** cumulative V2-06–10 |
| GROW-V2-11 | AI analysis and human-reviewed recommendations | Level 1 |
| GROW-V2-12 | Shared ecosystem interfaces and notifications | Level 1 |
| GROW-V2-13 | Dashboard and mobile UX | Level 1 |
| GROW-V2-14 | Security/privacy/adversarial/recovery readiness | Level 1 |
| GROW-V2-15 | Comprehensive exact-SHA phase reconciliation / canonical Level 3 | Level 3 (no redundant Genesis Foundry) |
| GROW-V2-16 | Production-equivalent testnet deployment, observed acceptance and operating handoff | Testnet-gated |

## GROW-V2-01 exit checklist

- [x] Previously bounded Grow product and retained directory boundaries identified.
- [x] Expanded five-pillar purpose adopted as product scope without alleging it previously existed.
- [x] Personas, required journeys and acceptance conditions defined.
- [x] Privacy, trust, authorization, device safety and compliance nonclaims defined.
- [x] Dependencies, deferred architecture selections and authority constraints defined.
- [x] Future steps and milestone qualification boundaries defined without replacing GROW-01–10.
- [x] Exact implementation-SHA Level-1 repository qualification evidence and required workflow conclusions.
- [x] Durable audited completion status (only after Level-1 PASS).


## GROW-V2-01 — Level 1 exact-SHA closeout (2026-10-08)

**Step status: COMPLETE — Level 1 product decision only.** The substantive product definition, roadmap, verifier and app-specific workflow were qualified together at implementation SHA `fc00b78f442c20eac35669d411dbe8d8ac8f99df`. Main/base at branch creation: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`. PR #582: `audit/420grow-v2-01-product-decision-20261008`. Source changes are exclusively documentation, scoped Python verifier and dedicated Level-1 workflow; no altered Grow runtime, shared service, contract, address map or Genesis inventory.

- **[420Grow V2 product decision run #37846815165](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37846815165)** — exact SHA verified; job `113549623734` **SUCCESS**; Python 3.11 syntax and product contract/non-promotion checks **PASS**.
- **[420Grow fast qualification run #37846815166](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37846815166)** — exact SHA; canonical-definition job `113549623595` **SUCCESS**; existing Go/Location/GEN-SVC-2, web UX/security, clean build/race, boundaries, static checks and retained GROW-01–10 preflight/regression **PASS**.
- **Separate unrelated repository workflow:** `governance-deployment-audit.yml` run `37846813718` reported failure with no jobs exposed via connector; not counted as a V2-01 PASS or an applicable product-decision test. Investigate separately if it becomes a required branch rule.
- **Level 2:** not required at product-definition boundary; milestones planned for V2-05 and V2-10.
- **Level 3:** deferred to V2-15; original Foundry full-inventory shutdown remains explicitly unresolved on the earlier testnet worklist. No new run of Solidity, Genesis, 420 Integrated or global Docs was required or requested for this ordinary scope-decision step.
- **Live/testnet:** V2-16 remains pending and original GROW-10 remains blocked; no deployment, paid workflow, private data custody or Genesis service admission authorized.

**Next canonical step:** **GROW-V2-02 — Architecture, tenancy, roles and security model**.

This paragraph is an **evidence-only closeout** referring to the earlier exactly tested implementation SHA; it changes no product requirements, test assertions, workflows or deployed behavior and does not recursively require another substantive rerun.
