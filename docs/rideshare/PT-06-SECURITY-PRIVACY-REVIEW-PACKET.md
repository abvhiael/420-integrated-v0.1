# LIFTd — PT-06 security and privacy review package

**Review type:** preparatory internal code review, STRIDE threat model, privacy-impact assessment (PIA) and independent-acceptance evidence manifest.
**Disposition:** REVIEW PACKET PREPARED — **NOT AN INDEPENDENT SECURITY OR PRIVACY APPROVAL**. No deployment/testnet acceptance implied.
**Reviewed baseline:** `main` after PT-06 merge `27771b5800962b717e0f599ba92e6e04a41205f1`, subject to main reconciliation on PR merge. Repository code and documents below, not running production systems.

## 1. Code-review scope and traceable observations

| Area / implementation | Verified design control | Outstanding review risk / disposition |
|---|---|---|
| `rideshare/src/auth.mjs` | Role/action/resource grants and fresh session status with Identity/session authority separation | Actual provider keys, operator grants, rotation, outages and revocation latency require deployed negative proofs |
| `rideshare/src/privacy-retention.mjs` | PT-06 action/resource/session/device/recovery/expiry binding; request idempotency, database transaction, redacted export, protected holds and tombstoning | External deletion scope, audit/log minimization and backup/provider erasure unverified |
| `rideshare/src/location.mjs` | Bounded private location expiry, encrypted private store and holder-scoped access | Deploy-managed encryption keys, retention scheduling, backups and external routing provider logs unverified |
| `rideshare/src/support-cases.mjs` | Scoped cases and immutable evidence digests, retention/appeal guards | Evidence vault custody, legal-hold jurisdiction and real reviewer access decisions require independent review |
| `rideshare/src/driver-onboarding.mjs` | Checks private-document receipt through an injected verifier and reauthorizes after await | Source/provenance of receipt verifier and deployed document-store malware/retention controls unverified |
| `rideshare/src/identity-consent-guard.mjs` | Fresh session and opt-in confirmation before private consent-controlled use | Controller/processor alignment, withdrawal propagation across instances and real Identity availability remain unverified |
| `rideshare/src/trip-communications.mjs` | Restrained notification payload, Messenger-issued grants, participant revalidation and rider consent | Provider logs, delivered-receipt retention, independent moderation and delivery-time revocation remain unverified |

This is a targeted source review, not a line-by-line independent audit or verification of every service. Existing test coverage is evidence of tested behavior, not deployed assurance.

### Review findings / risk register
- **PRIV-01 (high, open / deployment-bound):** Deletion and retention sweeps operate on primary `liftd.private_locations` rows; verifiable propagation to replicas, snapshots, archives, vaults and downstream providers is not demonstrated. **Owner:** privacy + infrastructure. **Exit:** exact deployment run/receipt map per data store; deletion/recovery tests without violating evidence/financial holds.
- **PRIV-02 (high, open / external):** Evidence-vault receipts are checked through an injected verification interface; actual independent vault authority, malware checks, key custody, cross-account access and legal hold enforcement have not been accepted. **Owner:** vault + security/privacy reviewers. **Exit:** deployed signed receipt, denied/allowed transcript and immutable reviewer attestation.
- **PRIV-03 (high, open / operational):** No production scheduler invocation, failure alert, overdue request escalation or completed SLA evidence supplied for `runPrivacyRetentionSweep`. **Owner:** privacy operations. **Exit:** least-privilege scheduler and repeated-run outage/recovery evidence.
- **PRIV-04 (medium-high, open / independent):** The immutable incident/financial hold rules need approved jurisdiction-specific retention schedules, appeal/legal-hold release workflow and human decisions; code constants are not a legal conclusion. **Owner:** counsel + privacy. **Exit:** signed schedule and exception/hold matrix.
- **PRIV-05 (medium-high, open / deployed):** Log/telemetry redaction helper is allowlisted, but complete deployed log, APM, tracing, analytics, provider and backup output has not been inspected. **Owner:** security + observability. **Exit:** sampled redacted log inventory and automated canary/no-PII leakage tests.
- **PRIV-06 (medium, open / privacy governance):** Controller/processor responsibility, sensitive-personal-data classification, cross-border recipients, subject-notice versioning and incident notification protocol require approved operational registers. **Owner:** privacy/legal. **Exit:** signed PIA sections and contracts/registers.

**Repository action:** Do not mark any open risk closed solely with this document. No critical executable defect is claimed resolved by documentation.

## 2. Threat model (STRIDE)

**Assets:** authenticated sessions; precise rider routes/locations; driver identity, vehicle and private documentation; incident and support evidence; trip linkage; privacy request history; immutable financial receipts and encrypted keys.

**Trust boundaries:** untrusted HTTP caller → authenticated trip/privacy services → PostgreSQL private tables; Identity/session authority → local authorization; LIFTd → independent vault/Registry/Messenger; trusted scheduler → retention service → primary store/replicas/backups; operations/reviewer → evidence access and audit sink.

| Threat | Entry and failure mode | Existing mitigation | Mandatory residual test |
|---|---|---|---|
| **Spoofing** | Forged rider/operator token; cross-trip credential reuse | Signed session and exact action/resource check | Revoked/recovered/device-ended cross-node proof |
| **Tampering** | Change privacy request status/erase evidence; alter hold record | Transactional CAS/revision, immutable event digest, protected-hold queries | DB least-privileged role, concurrent hold/erasure race and audit tamper check |
| **Repudiation** | Operator disputes denial/erasure; provider omits receipt | Durable request/command/event digests | Independent WORM audit receipt, clock provenance and custody chain |
| **Information disclosure** | Export reveals other participant/location; logs, provider, replicas leak | Subject-scoped redacted export, encrypted location store, allowlist telemetry | End-to-end export sampling, public API logs/Indexer/APM/provider audit |
| **Denial of service** | Scheduler/provider outage blocks timely request handling | Fail-closed local service and retention sweep | SLA alerts, retry/recovery, queue backlog and scheduled-job takeover |
| **Elevation of privilege** | Privacy operator accesses another subject; compromised vault reviewer | Signed scopes and separated authorization paths | External operator IAM, dual approval, cross-tenant document tests |

**Abuse cases:** stale session after opt-out, coerced account recovery, same-request replay under different subject, hold insertion racing a tombstone, expired or forged vault receipt, backups reintroducing tombstoned data, endpoint logs collecting precise coordinates, excessive retention due to unavailable scheduler, malicious operator pretending legal authority. These must be exercised on a frozen deployed candidate where relevant.

## 3. Privacy impact assessment (preliminary, not signed)

**Purpose and necessity:** assigned passenger transport, route fulfillment, fare/economic reconciliation, safety cases and legally required operational evidence. Location is purpose-limited; optional notifications require separate consent. Do not treat marketing or broader tracking as implied.

**Data classes:** identifiers/account and session linkage; precise origin/destination and route metadata; vehicle/driver eligibility; private credential/document receipts; safety and dispute records; payment records; privacy requests; aggregated diagnostics. These have different retention and access conditions.

**Lifecycle inventory:** capture → verify/authorize → encrypt and segregate → access/update → limited export → hold or expiry → primary tombstone → replica, archive, vault, partner/provider and backup disposition. Ledger/incident preservation is separate from location erasure, with a documented exemption/hold basis and disclosure to subjects where required.

**Lawful basis/notice:** jurisdictional privacy counsel must determine applicable Canadian/BC private-sector privacy requirements, collection/use/disclosure authority, breach notices, consent/withdrawal and access rights. This document does **not** make a legal determination.

**Data minimization:** no exact location, message contents, passenger names or private documents in public notification telemetry. Limit exported response to the requesting subject. Avoid collecting driver/private vault evidence in general-purpose trip analytics.

**Access controls:** least-privilege roles and per-trip subjects; independent production Identity, vault and security reviewer; no operator self-approval; time-limited delegated access and immutable redacted audits.

**Storage and transfers:** record each managed database/backup region, processing service, courier/notification/Messaging provider, vault host, encryption key boundary, retention and transfer contract. **No deployed inventory was supplied**, so locality and cross-border transfers remain unresolved.

**Retention/disposal:** existing policy uses 30-day location lifetime, 30-day privacy request due window and 90-day minimum support retention as engineering defaults. Independently approve actual dates, hold exemptions, alternate retention obligations and deletion verification in production/backup systems.

**Affected rights and harms:** physical safety from location exposure, identity fraud/document compromise, unjustified driver loss of income, failure to preserve incident evidence, failed erasure, undelivered subject request. High-impact classes mandate independent signoff before launch.

**Risk outcome:** *residual risk high until real deployment, independent retention/legal review and provider erasure/evidence-vault validation*. Public passenger operations must remain disabled.

## 4. Independent review packet / acceptance evidence manifest

Every external reviewer receives the frozen candidate git SHA, container/image and configuration digests, environment/network ID, test actors and role grants, signed reviewer scope, known open findings and precise links to redacted immutable artifacts.

| Gate / owners | Evidence to collect | Pass criterion (not yet met) |
|---|---|---|
| **TN-PRIVACY-RETENTION** / privacy + security + infrastructure | Scheduler run IDs, timed expiry records, incident/legal holds, denied and authorized access/export/deletion, SLA/alert dashboard, location tombstones, backup/replica/provider disposal receipts, rehydration checks | All applicable cases passed on deployed SHA, no unlawful deletion, no untracked copies, signed independent privacy/security acceptance |
| **TN-VAULT** / vault + security + authorized reviewer | Deployed issuer key fingerprints, encrypted upload digest, signed document receipts, malware/type limits, reviewer roles, access/revoke, legal holds, restore/rotation/fail-closed transcript | Independently owned vault and reviewer controls PASS, artifact/custody integrity, no public document exposure |
| **TN-ID** / Identity + security | Recovery/revoked session, old-device denial, cross-account/role denial, rotation and issuer outage transcripts | Immediate fail-closed authorization across all protected instances |
| **TN-5/TN-6 independent closeout** / legal, privacy, security, release owners | Signed PIA, approved retention schedule, vendor contracts, breach/SAR runbooks, threat-model residual risk acceptance, deployed findings disposition | Separately signed approvals; production gated until all mandatory owners approve |

Evidence index template fields: `gate_id`, `environment`, `repo_sha`, `image_digest`, `config_digest`, `owner`, `reviewer`, `observed_at`, `scenario`, `expected`, `actual`, `artifact_uri`, `artifact_sha256`, `signature`, `disposition`, `open_findings`. Empty/missing signatures or artifact digests mean **NOT ACCEPTED**.

## 5. Record of existing qualification (not a new run)

PT-06 implementation SHA `24a49a403e2d939f07e94f84c1547a7368ced56f`, evidence commit `89fbed4524633da261e655ebc8d8e2d649d6f98e`, [CI #39081427411](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39081427411), job `117538971706`: **129 app + 1 PostgreSQL privacy test PASS**. This packet is documentation-only and cannot amend or extend the exact-SHA executable qualification. Preserve canonical L03.5 and M-L03-A evidence.

## 6. Handoff and approval boundary

**Prepared now:** repository code-review observations, threat register, PIA draft, review evidence index and gate-specific positive/negative acceptance scenarios.

**Deferred to existing TN-0–TN-6 (no new roadmap step):** deployed operator and independent reviewer assignment; signed PIA/legal acceptance; real vault, Identity, scheduler, backup/replica/provider and logging tests; actual issue dispositions; approvals and release gate.

**Approval:** **NOT GRANTED**. This packet does not certify compliance, approve production data handling or substitute for independent review.
