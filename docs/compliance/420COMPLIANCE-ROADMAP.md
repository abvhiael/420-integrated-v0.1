# 420Compliance — Comprehensive development and release roadmap

Planning date: October 9, 2026 (America/Regina). Status: ADOPTED DEVELOPMENT BASELINE; implementation status is tracked separately. Initial jurisdiction: Canada / British Columbia / City of Vancouver. First consumers: DOOBr, 420Travel and Maps (through 420Location public projections).

## 1. Product decision and repository baseline

420Compliance will be a shared regulatory-information and policy-evaluation service for 420Integrated. It will monitor approved official sources, preserve evidence, prepare proposed rule changes, support independent review, publish versioned policy packs, and return reproducible decisions to consuming applications. A public website will explain reviewed rules and their sources; a private console will support review, activation, monitoring and incident response.

Repository evidence inspected for this plan:

- Repository: `abvhiael/420-integrated-v0.1`; observed main baseline `c5a4f220d1fbda01f707d359aa9bb32921a138b1`. Implementation must re-read current main.
- No default-branch indexed result for `420Compliance`; this is not a full tree/content audit or proof that no related implementation exists.
- DOOBr PR #598 qualified compatibility-only boundaries. It did not qualify a running courier product.
- Draft PR #601, head `ace73f76cacdb5338ebd7d08448c8ba1893f5f9f`, contains `docs/doobr/DOOBR-R01-R06-ROADMAP.md`. Its jurisdiction engine is proposed, not merged operational infrastructure.
- `genesis/svc3/travelapp/ATTRIBUTES.md` and `COMPATIBILITY.md` prohibit inferring legality from tags, categories or structural validation. The frozen Travel transaction gateway remains disabled.
- `docs/apps/oracle/index.md` establishes the existing 420Oracle reporting, freshness and canonical-read authority, including the distinction between runtime and frozen Genesis interfaces.

The first development step must establish complete reuse and gaps before creating another service, contract or authority. This roadmap neither adds a frozen Genesis application/address nor authorizes a live cannabis service.

## 2. Scope and authority

### Initial release

Support non-medical cannabis delivery eligibility for DOOBr and reviewed travel guidance for 420Travel in BC/Vancouver. Build reusable jurisdiction, evidence and domain schemas so additional applications and regions can be onboarded later. Cultivation, accommodation, events, marketplace sales and medical cannabis are separate future policy domains; initial coverage must never imply they are qualified.

### Responsibility map

| Component | Authority and responsibility |
| --- | --- |
| 420Compliance | Reviewed policy content, applicability, evaluation, versioning, decision evidence and regulatory-change impact |
| DOOBr | Order, assignment, custody, dispatch, handover, refusal and return workflow enforcement |
| 420Travel | Sourced informational guidance and coarse regional DOOBr presence; handoff to DOOBr |
| 420Location / Maps | Geographic resolution and approved public geographic projections |
| 420Identity / Verify / Registry | Canonical identity, credentials, verification and provenance within their established scope |
| 420Oracle | Authorized external observations and canonical reads where its actual interfaces fit; an observation cannot approve a legal interpretation |
| 420Governance | Protocol configuration and any approved on-chain policy publication authority; legal reviewers remain responsible for interpretation |
| 420Pay / Swap / Wallet | Existing payment, asset conversion and signing authority; policy approval cannot authorize a prohibited payment route |
| 420Notifications | Canonical notification transport; recipients and channels must be explicitly configured |
| 420Arbitration | Existing dispute resolution authority; disputes cannot override mandatory operational restrictions |

No independent custody, token, settlement engine, universal compliance certificate, or automatic legal permission. On-chain commitments, if needed, reference reviewed policies and evidence without exposing personal information.

### Mandatory design properties

1. Automatically detect changes; activate operational policy only through approved review and publication controls.
2. Resolve applicability from country, province/territory, municipality, applicable Indigenous authority, licence conditions and service zones. Geographic nesting alone does not settle legal authority.
3. Distinguish legislation, regulations, licence conditions, bylaws, regulator directives, guidance, partner restrictions and venue permissions. Use reviewed precedence, applicability and conflict rules; do not assume every local rule overrides provincial law or simply select the strictest text.
4. Model publication, commencement, effective intervals, review dates, expiry, repeal, amendment and supersession independently.
5. Reproduce historical decisions using the original policy, evaluator, geography, credential and relevant input versions.
6. Missing, stale, conflicted, revoked or unavailable mandatory evidence must block the regulated action. Informational pages may show dated guidance with a visible status.
7. A positive evaluation means the assessed requirements were satisfied using supplied evidence. It does not prove all applicable law was covered.
8. Preserve private records off-chain; never publish addresses, ID documents, birth dates, signatures, tracking, order details or reversible hashes of low-entropy personal data.

## 3. Architecture and core records

Proposed modules: official-source collectors; immutable evidence store; normalized legal provisions; jurisdiction resolver; reviewed policy repository/compiler; deterministic evaluator; credential adapters; publication/revocation service; event/outbox workers; public read API; authenticated app API; public website; private review and operations console. Choose the implementation stack during architecture qualification, based on repository reuse.

Use durable relational storage for structured policies, reviews and decisions, approved geographic storage for boundaries, and protected object storage for source snapshots. Separate production, staging and test credentials and approval authority. Keep source collection and model-assisted analysis isolated from policy activation.

| Record | Required contents |
| --- | --- |
| Source | Official publisher, URL, authority type, retrieval method, domain allowlist, refresh SLA, terms, owner and fallback procedure |
| Source snapshot | Retrieval time, content hash, document/version identifiers, original bytes where permitted, parsed text, section/page references and parser version |
| Legal provision | Stable ID, scope, cited section, commencement/effective interval, legal status, supersession and unresolved interpretation |
| Jurisdiction | Versioned boundaries, authority relationships, IANA time zone, approved boundary evidence and uncertainty status |
| Policy pack | Domain, applicable jurisdiction/actor classes, structured rules, obligations, source mapping, validity, schema/evaluator compatibility and signed manifest |
| Review | Author, independent reviewer, credentials/role, findings, decisions, approval time, rejected alternatives and unresolved questions |
| Publication | Approved policy digest, activation time, environment, rollout scope, dependencies, revocation and supersession |
| Decision | Action/context commitment, minimal required inputs, policy/evaluator/geography versions, evaluated time, outcome, obligations, reason codes, expiry and evidence references |
| Incident | Affected regions/domains/versions, reason, scoped halt, response owner, recovery proof and incident timeline |

Proposed outcomes: `ALLOW`, `DENY`, `REVIEW_REQUIRED`, `UNKNOWN`. Transaction consumers proceed only on a fresh `ALLOW` after fulfilling its obligations; all other outcomes block the action. Separate informational coverage status from transaction eligibility. No unrestricted administrator override.

A decision must bind to the caller, tenant, action, order or operation, origin/destination, relevant facts, policy version and expiration. A policy decision is not a bearer payment authorization or reusable credential. Re-evaluate at material workflow transitions; historical evidence remains immutable.

## 4. Phase C01 — Discovery, scope and architecture

| Step | Work and exit evidence |
| --- | --- |
| C01.1 | Audit current main, active branches, roadmaps, service catalogue, contracts, configuration, CI and existing jurisdiction/credential components; produce inventory, reuse matrix and gaps. |
| C01.2 | Lock product scope, actors and journeys: traveller, consumer app, courier app, retailer, policy author, independent reviewer, publisher, operator and auditor. Record excluded domains. |
| C01.3 | Establish source/authority taxonomy, legal review ownership and BC/Vancouver questions requiring qualified interpretation. Separate legal approval from governance and software qualification. |
| C01.4 | Agree shared authority with DOOBr and Travel; replace duplicated proposed policy ownership through an explicit roadmap amendment with preserved requirement IDs. |
| C01.5 | Threat/privacy model: fraudulent sources, manipulated documents, AI prompt injection, approval bypass, tenant leakage, stale decisions, coercion, chain leakage and denial of service. |
| C01.6 | Define APIs, schemas, events, outcome meanings, trust boundaries, freshness and time semantics; choose stack and deployment topology. |
| C01.7 | Approve service discovery strategy, signed publication and optional chain commitments; no new Genesis ID/address without canonical approval. |
| C01.8 | Architecture Level 2 milestone: source-to-requirement-to-test matrix, authority review, implementation sequence and baseline lock. |

Exit: approved bounded product and architecture, mapped upstream dependencies and unresolved external blockers. No operational eligibility claims.

## 5. Phase C02 — Regulatory evidence and change monitoring

| Step | Work and exit evidence |
| --- | --- |
| C02.1 | Official source registry for federal cannabis rules, BC law/licence materials and Vancouver bylaws/licensing; assign an owner and freshness policy to each source. |
| C02.2 | HTML/PDF ingestion with safe redirects, size limits, network allowlists, conditional requests, throttling and permitted archival; reject SSRF and malicious content. |
| C02.3 | Durable snapshots, hashes, parser versions, citation anchors and document history; quarantine corrupt or unparseable documents. |
| C02.4 | Normalize provisions and amendments while preserving original text and legal status; distinguish bills/proposals from operative requirements. |
| C02.5 | Semantic and structural change detection; suppress navigation-only noise without hiding meaningful changes; identify removal, relocation and silent amendments. |
| C02.6 | Optional 420AI-assisted extraction and comparison with cited spans; label every output as a proposal, validate it and prevent tool access or policy activation from document instructions. |
| C02.7 | Change intake queue with severity, affected apps/regions/rules, effective dates and named review ownership. |
| C02.8 | Monitor failed collection, source disappearance, expired reviews and unreadable updates; define escalation and expiry behaviour. Successful fetch alone never renews legal review. |
| C02.9 | Evidence export and source retention controls; support permitted archival limits, publisher terms and reviewer-only access where needed. |
| C02.10 | Evidence pipeline Level 2 milestone: replay fixture changes, amendments, poisoned documents, outages and duplicate intake; demonstrate no automatic approval. |

Exit: trustworthy evidence collection and review intake with traceable source changes.

## 6. Phase C03 — Jurisdiction and deterministic policy engine

| Step | Work and exit evidence |
| --- | --- |
| C03.1 | Versioned authority graph and boundaries; distinguish operating zone from legal jurisdiction and resolve uncertain/border addresses conservatively. |
| C03.2 | Policy schema for actors, products, action stages, credentials, hours, quantity equivalency, payment prerequisites, recipient checks, return duties and records. |
| C03.3 | Effective-time and local-time engine, time zones, daylight saving, overnight intervals, scheduled commencement and repeal; retain historical knowledge-time records. |
| C03.4 | Reviewed composition and conflict resolution; omissions and unresolved authority conflicts cannot silently produce `ALLOW`. |
| C03.5 | Safe policy compiler and deterministic evaluator with bounded execution, fixed-precision quantities, explicit units, reason codes and obligations. |
| C03.6 | Canonical credential references with validity, verification freshness, revocation and explicit unavailable states; no fabricated live licensing adapter. |
| C03.7 | Bound decision receipts and replay prevention; define expiry, decision input commitments and action-stage re-evaluation. |
| C03.8 | Cache invalidation, revocation epochs, dependency hashes and monotonic publication sequencing across multiple instances. |
| C03.9 | Simulation and policy-diff impact reports; classify newly blocked/allowed flows and in-flight operations. |
| C03.10 | Property/adversarial tests: unknown boundaries, contradictory rules, numeric overflow, expiry, clock skew, stale credentials, policy downgrade and incompatible schema. |
| C03.11 | Engine Level 2 milestone: independently reproducible historical and current decisions; cross-layer and carrier-class integration evidence. |

Exit: a reusable engine that can express the approved domain without embedding BC/Vancouver constants in app workflows.

## 7. Phase C04 — Review, publication and BC/Vancouver policy pack

| Step | Work and exit evidence |
| --- | --- |
| C04.1 | Draft/review/approve/schedule/activate/supersede/revoke lifecycle; enforce distinct author and independent reviewer identities. |
| C04.2 | Reviewer qualifications and delegation; MFA, least privilege, short-lived sessions and approval invalidation when reviewed content changes. |
| C04.3 | Federally applicable product, packaging, quantity-equivalency and promotion requirements; explicitly separate non-medical scope and payment-route legal review. |
| C04.4 | BC delivery matrix with separate licensee/employee, delivery-person and common-carrier branches; map every implemented rule to current authoritative provisions and tests. |
| C04.5 | Vancouver retailer/business permissions and applicable municipal operating restrictions; confirm DOOBr's own business category rather than treating retailer licensing as courier authorization. |
| C04.6 | Encode retailer-origin, prepayment, transport, eligible recipient, refusal, failed-delivery return and record duties; resolve classification-dependent differences through review. |
| C04.7 | Travel policy pack for possession/transport/consumption and venue guidance within validated coverage; border crossings and unreviewed places remain explicit gaps. |
| C04.8 | Secure signing and scheduled activation, key rotation, compromised-key response, environment isolation and region/domain kill switches. Emergency operators may halt; they may not invent permission. |
| C04.9 | Activation impact procedure for pending orders and cached guidance; stop/reassess/return handling belongs to DOOBr, with immutable previous decision evidence. |
| C04.10 | Approved policy corrections and supersession; rollback may restore only a currently lawful, valid approved version. Preserve the historical error record. |
| C04.11 | BC/Vancouver Level 2 milestone: legal-rule traceability, reviewer separation, policy pack simulations and explicit unresolved legal/partner acceptance list. |

Initial source-informed subjects include courier eligibility/training, origin-store preparation, pre-departure payment, regional limits, recipient checks and carrier-dependent return timing. The BC delivery summary points users to licence handbooks for the most complete current rules. Every encoded rule needs provision-level review; a summary page is insufficient to approve a production policy pack.

Exit: reviewed release-candidate policy packs. Development credentials and simulation packs remain unmistakably non-operational.

## 8. Phase C05 — APIs, app adapters and canonical integrations

| Step | Work and exit evidence |
| --- | --- |
| C05.1 | Versioned authenticated evaluation API, public guidance API, policy-status API and SDK; bounded pagination, schema validation and compatibility rules. |
| C05.2 | Identity/Verify/Registry adapters with real configured provider boundaries, revocation, private evidence references and fail-closed errors. |
| C05.3 | Location/Maps applicability adapter; private exact addresses only where required, coarse public region output and no GPS-only proof of legal eligibility. |
| C05.4 | DOOBr order acceptance, pickup/dispatch and handover checks; prevent bypass through retries, alternate endpoints, mobile offline queues or operator actions. |
| C05.5 | DOOBr refusal/return and in-flight policy-change recovery; return/safety actions use separately reviewed workflows rather than being stranded by a sale halt. |
| C05.6 | Travel sourced guidance, coverage status, last review date, policy version and deep link; no embedded DOOBr checkout or private courier data. |
| C05.7 | Distinguish policy coverage, legal eligibility and actual courier supply. Travel presence must combine qualified provider availability with applicable policy visibility, privacy thresholds and expiry. |
| C05.8 | Oracle integration suitability review and narrowly scoped adapter where required; preserve canonical runtime ABI and reporting-only authority. Off-chain source monitoring need not become an oracle feed. |
| C05.9 | Notifications outbox, subscribed app impact events, signatures, ordering, deduplication, retry and dead-letter recovery. Events invalidate permission; consumers re-read canonical policy. |
| C05.10 | Pay/Wallet integration boundary: decision references bind to permitted workflows; Compliance does not sign payments, grant custody or independently refund. |
| C05.11 | Optional on-chain publication/attestation adapter only after demonstrated need; reuse Registry/Verify/governance capabilities before considering new contracts. |
| C05.12 | Integration Level 2 milestone: authenticated app flows, protocol outages, policy revocation mid-order, stale Travel presence and cross-tenant adversarial tests. |

Exit: enforced app integration with authoritative dependencies. Fixtures qualify behaviour only; actual external acceptance remains separately gated.

## 9. Phase C06 — Public website and private reviewer application

| Step | Work and exit evidence |
| --- | --- |
| C06.1 | Accessible design system and responsive website; proposed domain `compliance.420integrated.org`, subject to existing hosting/domain decisions. |
| C06.2 | Public jurisdiction/topic browser, source-linked rule pages, coverage boundaries, effective dates and reviewed change history. |
| C06.3 | Plain-language guidance and interactive informational scenarios; do not claim eligibility without authenticated evidence or obscure unresolved requirements. |
| C06.4 | Private author workspace with cited text, structured rule editing and version comparisons. |
| C06.5 | Independent review console, findings, impact analysis, approval signatures and conflict queue. |
| C06.6 | Publisher/operator controls for scheduled release, halt, key status, source health and affected-app status. |
| C06.7 | Auditor export and evidence inspection with redaction, access logging and authorization. |
| C06.8 | App SDK/mobile consumption tests, browser accessibility, keyboard/screen reader, responsive layouts and session/device revocation. A separate native Compliance app is not required initially. |
| C06.9 | Website/client Level 2 milestone: complete public and private browser journeys, accessible failure states and denial-path coverage. |

Exit: useful public guidance and protected operational tools, with no public exposure of private review or decision records.

## 10. Phase C07 — Operational and security hardening

| Step | Work and exit evidence |
| --- | --- |
| C07.1 | Production database schema, migrations, encryption, tenant isolation, indexing and storage limits. |
| C07.2 | Multi-instance concurrency, durable jobs, leader/lease fencing, transactional outbox and idempotent activation. |
| C07.3 | Secret/signing-key management, TLS, service identity, rotation, supply-chain controls and dependency review. |
| C07.4 | Capacity and abuse controls; load, soak, backpressure, rate limits and overload fail-closed behaviour. |
| C07.5 | Privacy retention/deletion schedules, legal holds and role-limited evidence access; required delivery records remain under the accountable retailer/app boundary. |
| C07.6 | Backup/restore and disaster recovery with policy/publication consistency; stale backup must not reactivate a revoked policy. |
| C07.7 | Monitoring: source freshness, review backlog, decision latency, evaluator errors, coverage gaps, activation lag, revocation propagation and consumer acknowledgments. |
| C07.8 | Incident drills for false approval, malicious sources, compromised reviewer/key, bad geography, expired credentials and regulator restriction. |
| C07.9 | Independent security review intake, threat/evidence matrix and remediation; distinguish intake readiness from a completed independent review. |
| C07.10 | Operational Level 2 milestone: distributed-system recovery, incident exercises and retained cross-app security evidence. |

Set numerical freshness, review turnaround, decision latency, revocation propagation, availability, RPO/RTO and retention targets during C01/C07 based on risk and deployment capacity. Targets must be approved and measured before release; no unmeasured reliability claims.

## 11. Phase C08 — Repository qualification and testnet handoff

| Step | Work and exit evidence |
| --- | --- |
| C08.1 | Reconcile requirements, policy coverage, open findings and all retained Level 1/2 evidence against current main. |
| C08.2 | Complete API/SDK schemas, consumer guides, reviewer handbook, operator runbooks, legal-source matrix and deployment manifest templates. |
| C08.3 | Create explicit testnet dependency register for live credentials, chain deployments, source collectors, signing, geography, app endpoints and partner approvals. |
| C08.4 | Prepare exact release candidate and main reconciliation; freeze code, policy pack, evaluator and configuration digests. |
| C08.5 | Single full Level 3 phase qualification at the exact final candidate: canonical Solidity inventory if applicable, Genesis authority/config checks, global integration, Docs and deployment/config validation without duplicate Foundry ownership. |
| C08.6 | Record exact-SHA evidence, formal repository phase closeout, merge through established repository policy and publish testnet handoff. |

Exit: repository-qualified infrastructure ready for deployment. Testnet and legal acceptance remain open until their real evidence exists.

## 12. Phase C09 — Deployed testnet qualification

| Step | Work and exit evidence |
| --- | --- |
| C09.1 | Provision approved services, storage, databases, workers, secrets, network policy and observability. Choose hosting from current infrastructure records; do not invent a workspace. |
| C09.2 | Deploy approved publication adapters/contracts if applicable; retain addresses, code hashes, ABI, registry resolution and configuration transactions. |
| C09.3 | Run real official-source collection with permitted network access, snapshots, detected changes and reviewer queue. |
| C09.4 | Exercise actual signing, scheduled publication, revocation and key rotation; verify every instance and consumer uses the correct environment. |
| C09.5 | Connect live qualified Identity/Verify/Registry/Location/Notifications and optional Oracle boundaries; record unavailable providers as blockers. |
| C09.6 | Deploy DOOBr/Travel adapters and test end-to-end simulated orders and real deployed browsers/mobile clients; no unauthorized regulated deliveries. |
| C09.7 | Prove multi-instance revocation, stale-policy denial, clock/boundary conditions, partner evidence expiry and recovery during outages. |
| C09.8 | Measure load/soak, backup/restore, incident response, privacy and accessibility acceptance. |
| C09.9 | Obtain independent security-review outcome and jurisdiction/carrier policy review outcome; remediate unresolved release findings. |
| C09.10 | Testnet closeout: exact deployed artifact/config/policy evidence and separate list of remaining mainnet/operational gates. |

Exit: demonstrably deployed policy service and consumers. Live commerce permission is not implied by a testnet pass.

## 13. Phase C10 — Mainnet and operational launch

| Step | Work and exit evidence |
| --- | --- |
| C10.1 | Revalidate official sources, policy pack, reviewer authority, licence evidence and applicability immediately before launch. |
| C10.2 | Confirm DOOBr operating model, retailer/courier agreements, relevant licences, insurance, lawful payment routes, privacy obligations and record ownership. |
| C10.3 | Approve exact release artifacts, environment configuration, chain references, signing keys, incident owners and support procedures. |
| C10.4 | Launch reviewed public guidance separately where qualified; transactional regions remain disabled until their own gates pass. |
| C10.5 | Region-scoped shadow evaluation followed by explicitly approved canary; monitor decisions without using shadow results to authorize real actions. |
| C10.6 | Verify deployed DOOBr stage enforcement, Travel information/presence limits, policy freshness and revocation under production configuration. |
| C10.7 | Formal go/no-go and operational acceptance; only enable the approved domain, actor classes and region. Preserve DOOBr's own outstanding audit gates. |
| C10.8 | Post-launch review, incident drills, change-review SLAs, coverage audits and controlled expansion backlog. |

Exit: bounded, reviewed, monitored live service. Mainnet infrastructure, public guidance and live DOOBr operations may have different launch dates and require separate acceptance records.

## 14. Phase C11 — Jurisdiction and application expansion

Each new region or policy domain uses the following repeatable onboarding track; unsupported regions remain disabled.

| Step | Work and exit evidence |
| --- | --- |
| C11.1 | Research competent authorities and current law; assign qualified reviewers and mark known gaps. |
| C11.2 | Add boundary/time-zone evidence, authority relationships and region-specific source monitoring. |
| C11.3 | Define actor/licence/carrier classifications and required operational partnerships. |
| C11.4 | Implement reviewed policy pack, credentials and any truly new evaluator capability. New semantics require engine qualification, not just configuration. |
| C11.5 | Validate payment, privacy, retention, promotion, recipient, return and operational requirements. |
| C11.6 | Run policy simulations, source traceability, boundary/carrier adversarial tests and impacted-consumer Level 2 integration. |
| C11.7 | Deploy disabled region, complete external acceptance and incident/rollback exercises. |
| C11.8 | Approve bounded canary, enable qualified scope and retain evidence; material engine/protocol changes use the applicable full phase qualification boundary. |

Later candidates: additional BC municipalities, other Canadian provinces, 420Grow cultivation guidance, 420BnB venue/accommodation policies, 420Events and marketplace domains. These are candidates, not commitments or coverage claims. International law or medical cannabis can require new concepts and adapters; expansion is not guaranteed to be configuration-only.

## 15. Qualification rules and evidence format

Use the user's established three-level model:

- **Level 1:** each ordinary step gets affected builds, unit/integration, adversarial/boundary/recovery, API/ABI, static/security and directly relevant workflow checks only. Do not run global Docs/Solidity/Genesis after every step.
- **Level 2:** milestone integration at C01.8, C02.10, C03.11, C04.11, C05.12, C06.9 and C07.10. Retain earlier evidence when unchanged; a set of isolated Level 1 passes is not a milestone pass.
- **Level 3:** one repository closeout at C08.5 after main reconciliation. Canonical Solidity owns full Foundry inventory; Genesis authority checks do not duplicate it. Deployment qualification at C09/C10 is separate and records actual deployed artifacts.
- Evidence-only commits inherit the qualified executable SHA when appropriate. No skipped, missing, simulated or queued check is a PASS. Changed executable/configuration/policy inputs require applicable requalification.

Proposed repository paths, to be reconciled at C01.1: `docs/compliance/`, `docs/compliance/qualification/`, app implementation under the repository's established service layout, versioned policy packs in a reviewed policy directory, and app-scoped CI workflows.

Every qualification record includes step/milestone ID, exact code SHA, policy/source snapshot/config digests, evaluator and schema versions, geography version, test commands/workflow links and results, retained evidence references, reviewer findings, excluded deployment dependencies and explicit acceptance status. Legal review and runtime tests remain distinct evidence types.

## 16. Minimum adversarial acceptance matrix

| Risk | Required proof |
| --- | --- |
| Source poisoning / AI injection | Untrusted source content cannot execute tools, approve rules or change authority. |
| Future law / silent amendment | Proposed and not-yet-effective provisions cannot grant current permission; meaningful changes enter review. |
| Approval bypass | Self-approval, changed-after-review content and compromised/revoked roles cannot publish. |
| Policy downgrade / replay | Old signed packs, receipts and backups cannot reinstate revoked authorization. |
| Distributed stale cache | Revocation reaches consumers within the measured limit; stale/offline clients cannot complete gated actions. |
| Boundary / actor confusion | Border ambiguity, wrong carrier class and wrong licence scope block or require review. |
| Numeric / temporal errors | Equivalency units, effective intervals, time-zone transitions and clock skew cannot produce unsafe `ALLOW`. |
| Credential outage | Unknown, revoked, expired and unavailable evidence remain distinguishable and block mandatory checks. |
| Mid-order change | Dispatch/handover re-evaluation and lawful return/recovery preserve custody and history. |
| Cross-app authority drift | Compliance cannot execute payment, override custody authority or open Travel checkout. |
| Privacy leakage | Public guidance, logs, exports, commitments and Travel presence reveal no protected personal records. |
| Coverage misrepresentation | Missing domains/municipal rules are visible gaps and never inferred from a nearby reviewed region. |

## 17. Parallel delivery with DOOBr and 420Travel

Complete C01 before DOOBr locks its policy implementation. Develop C02–C04 alongside DOOBr durable backend work. DOOBr may build workflows against explicit non-operational fixtures while the reviewed pack is prepared, but cannot treat them as live approval. C05 connects both apps; C06 and C07 can proceed once their interfaces stabilize. C08 closes the repository phase; C09/C10 align with each consumer's own release gates.

Explicit DOOBr roadmap reconciliation:

- R01.4/R01.7 consume Compliance's legal matrix and policy contracts.
- R02 credential, presence, order, custody and return steps retain DOOBr ownership and consume stage-specific decisions.
- R03.7 uses app-specific compliance status while shared policy review stays in Compliance's console.
- R03.10 preserves coarse Travel presence and handoff.
- R04 protocol integrations preserve existing canonical authorities.
- R05 policy-expiry/emergency scenarios include cross-app revocation evidence.
- R06 legal, partner and operational acceptance remains mandatory; neither roadmap can close it using the other's CI alone.

This plan can be implemented incrementally before testnet launch. Live providers, deployed integration, independent reviews and operational approval are real external gates; they must remain visible rather than being represented as repository-complete work.

## 18. Sources and review notes

Repository records:

- DOOBr proposed roadmap: https://github.com/abvhiael/420-integrated-v0.1/pull/601
- DOOBr compatibility closeout: `docs/audit/DOOBR-PHASE-CLOSEOUT.md` on inspected main.
- Travel boundaries: `genesis/svc3/travelapp/ATTRIBUTES.md` and `COMPATIBILITY.md`.
- Oracle authority: `docs/apps/oracle/index.md`.

Official regulatory starting sources inspected October 9, 2026; revalidate during implementation and each applicable release:

- BC delivery requirements and links to licence handbooks: https://www2.gov.bc.ca/gov/content/employment-business/business/liquor-regulation-licensing/cannabis-licences/cannabis-resources-information/delivering-cannabis
- BC Cannabis Licensing Regulation: https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/202_2018
- Vancouver cannabis retail licensing: https://vancouver.ca/doing-business/cannabis-retail-dealer-business-licence.aspx
- Vancouver general business licensing: https://vancouver.ca/doing-business/get-a-business-licence.aspx
- Federal cannabis laws/regulations entry point: https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis.html

This is a software-development and acceptance roadmap. The source list is a research starting set, not an exhaustive approved legal register. Federal primary provisions, current BC handbook versions, municipal bylaws and any applicable Indigenous-authority requirements must be resolved and recorded at C02/C04 before approving policy content.

## C01.1 adoption and execution register

This file is the repository-adopted copy of the user-approved roadmap. Original phase and step IDs are preserved. C01.1 is the inventory step only; C01.2 remains product-scope lock. See `C01.1-INVENTORY-REUSE-GAPS.md`, `C01.1-INVENTORY.json` and `qualification/C01.1-level1.json` for exact implementation/evidence status. Source review is not operational authorization. Maps is an explicit shared consumer through the existing 420Location boundary.

### C01.2 adopted product contract

The locked scope is recorded in [C01.2-PRODUCT-SCOPE-AND-JOURNEYS.md](C01.2-PRODUCT-SCOPE-AND-JOURNEYS.md) and its machine-readable JSON companion. Nine actors, 24 journeys and 14 exclusions define the first infrastructure release. C01.1 qualification remains retained; C01.2 acceptance is recorded separately.

### C01.3 adopted discovery contract

[C01.3-SOURCE-AUTHORITY-AND-REVIEW.md](C01.3-SOURCE-AUTHORITY-AND-REVIEW.md) and its JSON companion establish 12 source types, 17 discovery entries, 10 review roles and 25 unresolved interpretation questions. C01.1/C01.2 remain qualified and unchanged. No legal approval, external reviewer appointment or operational eligibility is implied.
