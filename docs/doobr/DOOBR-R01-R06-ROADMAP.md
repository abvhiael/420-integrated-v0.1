# DOOBR — Standalone infrastructure roadmap (R01–R06)
Status: PROPOSED / NON-OPERATIONAL; planning baseline 2026-10-09.
Regulatory design baseline: **British Columbia**, initial municipality **City of Vancouver**. This supersedes prior Saskatchewan examples; it does not grant licensing or deployment authority.
Predecessor: merged DOOBR compatibility audit PR #598. Existing `DOOBR-AUDIT-9` and `DOOBR-AUDIT-10` remain NOT COMPLETE, in `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md`. No permission to turn on the intentionally fail-closed Genesis Travel transaction gateway.

## Product and authority
Standalone DOOBR website, mobile consumer and courier clients, retailer portal and private operations console; shared versioned APIs, PostgreSQL/PostGIS, security and observability. `420Travel` receives **only** privacy-safe coarse regional availability/presence, with handoff to DOOBR; never an embedded checkout, courier location feed or authority transfer. Release of live regulated orders remains disabled until explicit governance, legal, partner and operational approval.

Licensed BC retailers remain the seller of record. The platform must verify retailer credentials and the exact license/municipality, carrier classification and legal service agreements. Canonical 420Identity/Verify/Registry own credentials and provenance; 420Location/Search own discovery; 420Pay owns authorized settlement; Wallet signs permitted consents; Arbitration owns dispute authority; Notifications owns canonical notice transport. No independent DOOBR custody, escrow, currency, or competing authority. Only minimal attestations/on-chain commitments; addresses, tracking, ID proofs and content encrypted off-chain.

## BC + Vancouver compliance profile (versioned, fail-closed)
Implement `jurisdiction_policy` records with regulator-approved legal citations, effective dates, policy version, municipality overrides and carrier types; deny by default if missing, expired, conflicted or revoked.
- Initial profile: `CA-BC-VANCOUVER-cannabis-delivery/v1`. Minimum age 19; retailer licence validity and municipal authorization; legally permitted courier eligibility and training; retailer prepares sealed orders; retailer receives payment before departure; BC-only authorized delivery addresses; per-sale 30g dried-cannabis-equivalent limit; no additional doorstep courier charges; required recipient eligibility, name and signature; audit-worthy handoff and return evidence; applicable 9 a.m.–11 p.m. delivery-person operating window or narrower applicable rule.
- Maintain distinct `LICENSEE_EMPLOYEE`, `DELIVERY_PERSON`, and `COMMON_CARRIER` policy branches. DO NOT assume the time window, handoff-place rules or failed-delivery return deadlines are identical for common carriers. Have counsel/regulator validate each branch and all record retention before approval.
- Evaluate origin and destination, local time (IANA time zone and DST), retail licence, order status, carrier authorization, delivery cutoff, package constraints and recipient eligibility **both at dispatch and handoff**. Retain deterministic denial reason and signed policy-version evidence.
- Privacy: 420Travel receives `AVAILABLE|LIMITED|UNAVAILABLE|UNKNOWN` only by coarse region, with minimum anonymity thresholds and stale-data expiry; no identifiable courier, exact coordinates, order details or promotional claims about cannabis sales. Online service availability is not legal eligibility.
- Pre-launch: confirm Vancouver business licence category and municipal restrictions applicable to the courier operating model separately from cannabis retailer licences, insurance, partner contracts, age verification methods, privacy law and legal interpretation. Promotion/marketing must meet federal cannabis restrictions.
Primary sources (verify at each release): https://www2.gov.bc.ca/gov/content/employment-business/business/liquor-regulation-licensing/cannabis-licences/cannabis-resources-information/delivering-cannabis ; https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/202_2018 ; https://vancouver.ca/doing-business/cannabis-retail-dealer-business-licence.aspx ; https://vancouver.ca/doing-business/get-a-business-licence.aspx.

## R01 — Authority, architecture and policy
R01.1 Repository inventory and gap audit against current main; catalogue exact reuse boundaries.
R01.2 Standalone product authorization decision (not a new frozen Genesis app without explicit catalogue decision).
R01.3 Consumer/courier/retailer/operator roles, journeys, abuse cases and operational limits.
R01.4 BC/Vancouver legal matrix, three carrier classifications, eligibility and policy versioning; written regulatory-review questions.
R01.5 Protocol authority contracts and protected 420Travel presence/read-only integration.
R01.6 Security/privacy threat model: GPS, address, age data, records, chain leakage, coercion, impersonation and regulated-goods custody.
R01.7 OpenAPI/events, UX, native mobile strategy, availability semantics and versioned jurisdiction policy contract.
R01.8 Architecture decision lock and Level 2 milestone qualification.

## R02 — Durable services
R02.1 Postgres/PostGIS schema, migrations, tenant isolation, encryption/retention.
R02.2 Identity/session/wallet consent and RBAC/ABAC, expired-role revocation.
R02.3 Retailer licensing/municipal evidence; seller-of-record order adapter and prepaid proof.
R02.4 Courier eligibility/training/vehicle credential verification and expiry.
R02.5 Coarse regional presence, geofences, available capacity and safe Travel projection.
R02.6 Durable order state machine, exactly-once business semantics through idempotent commands, authorization.
R02.7 Matching, scheduling, offers, assignment, capacity, reassignment and conflicts.
R02.8 Tracking/navigation, geospatial protection, location permission lifecycle.
R02.9 Packaging custody, pickup, recipient ID/name/signature and handoff evidence.
R02.10 No-delivery, timeouts, no-show, rejection, same-day or other carrier-specific return workflows.
R02.11 Notifications, outbox, retries, signed callbacks and dead-letter recovery.
R02.12 Backup/restore, multi-instance, monitoring, policy audit logs and migration rollback.
R02.13 Backend integration Level 2 milestone.

## R03 — Client experience
R03.1 Brand, accessibility, design system and site shell for doobr.420integrated.org (domain proposed, not deployed).
R03.2 Public coverage lookup, legal availability disclaimers, strict age-appropriate discovery and support.
R03.3 Consumer account, Wallet consent where allowed, order state and receipts.
R03.4 Courier enrollment, credential status and availability.
R03.5 Courier offers, navigation, custody and proof-of-delivery flow.
R03.6 Retailer intake, dispatch and exception management.
R03.7 Private operator/safety/compliance consoles and dual control.
R03.8 Secure iOS/Android builds with platform keystore, push, foreground and narrowly scoped background GPS.
R03.9 Offline queue/reconnect, token/device revocation and location permission failure.
R03.10 420Travel read-only coarse presence card and deep link, hard-failed checkout.
R03.11 Playwright, device, mobile, screen reader and keyboard journeys, all denial branches.
R03.12 Clients and travel Level 2 milestone.

## R04 — Canonical contracts and protocol adapters
R04.1 Reuse inventory: no new contract if canonical authority already exists.
R04.2 Only approved provider credential/registry reference contract/adapter.
R04.3 Minimal delivery attestation commitments without PII.
R04.4 420Pay-bound settlement/receipt and retailer prepaid-order verification; no unauthorized crypto sale/custody.
R04.5 Wallet consent/session revocation and replay prevention.
R04.6 Identity, Verify, Registry provenance with expiry/revocation handling.
R04.7 420Location/Search and Travel projection integration.
R04.8 Notifications and Arbitration routing.
R04.9 Payment conservation, compensation, cancellation, duplicate callback and refund tests.
R04.10 ABI, fuzz/invariant, access and adversarial tests; no global duplicate Foundry.
R04.11 Protocol integration Level 2 milestone.

## R05 — Repository-side release qualification
R05.1 Authorization and cross-tenant security.
R05.2 Privacy, address/GPS exfiltration, retention and deletion conflict testing.
R05.3 Concurrent assignments, replay, callbacks, failover and chaos cases.
R05.4 Fees, payment finality/rollback and external authority conservation checks.
R05.5 Expired licences, policy changes mid-order, emergency stop and revoke.
R05.6 Multi-instance deployment, data migrations, restore/rollback.
R05.7 Mobile/browser device security and accessibility.
R05.8 Independent security intake with threat/evidence matrix; operational runbooks.
R05.9 Exact release documentation, explicit testnet deferrals and deployment handoff.
R05.10 Once-only full Level 3 exact-SHA repository qualification after main reconciliation. Canonical Solidity owns full Foundry inventory; Genesis Address Authority does not duplicate it.

## R06 — Testnet then mainnet gating
R06.1 Testnet provisioning, secrets/manifest and observability.
R06.2 Real API, Postgres, worker, event services and public/private endpoints.
R06.3 Approved contract deployments with ABI/address authority.
R06.4 Actual Wallet, Identity, Verify, Pay, Notifications and Location live adapters.
R06.5 Partner/regulator carrier model signoff, eligibility and external vendor proofs.
R06.6 Real devices, push, GPS permissions and live session expiry.
R06.7 Load, soak, chaos, backup/restore, incident drills.
R06.8 Reconcile original DOOBR-AUDIT-9 without claiming pass absent external authority.
R06.9 Legal, regulatory, insurance, merchant and privacy signoffs for BC/Vancouver.
R06.10 Reconcile original DOOBR-AUDIT-10 operational acceptance.
R06.11 Frozen approved release SHA, immutable config and promotion/rollback package.
R06.12 Independent mainnet go/no-go, exact deployed SHA acceptance; live delivery remains OFF until separately approved.

## Jurisdiction expansion — first-class design and checklist
Use layered `country -> province/territory -> municipality -> service zone` policy composition with precedence and policy signing; contracts/services consume policy decisions, not hard-coded `Vancouver` or `BC` constants. Separate retail sales permissions, courier legality, age/recipient verification, hours, product limits/equivalency, transport/return deadlines, data retention, tax/payments, business licences, promotional visibility, carriers and insurance.
To add a jurisdiction: legal and regulator research with dated source matrix; explicit policy version and reviewer approval; provider/acquirer/payment-route eligibility; municipal geofences/time zones; credential source integration; source-to-test traceability; simulated dispatch/return and adversarial privacy tests; operating partner signoffs; region-scoped canary disabled-by-default deployment; kill switch and rollback; independent release signoff. Prohibit policy self-activation by an administrator alone.
Cost of adding jurisdictions is primarily **law, licences, contracts and external integration**, not dispatch-engine coding, if the policy engine and adapter seams are built and tested from R01 onward.

## Qualification model
Level 1 per ordinary step, affected scope only. Level 2 at R01.8/R02.13/R03.12/R04.11; preserve retained cross-component evidence. Level 3 once at R05.10; R06.12 separately qualifies deployment/mainnet release. Evidence-only commits inherit exact qualified executable SHA where applicable. No skipped/absent gate counts as PASS and no live/regulatory acceptance inferred from CI success.
