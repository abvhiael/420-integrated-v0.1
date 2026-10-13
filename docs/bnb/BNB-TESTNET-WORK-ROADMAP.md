# 420BnB — testnet-dependent work roadmap

Status: DEFERRED TO OFFICIAL TESTNET / EXTERNAL GOVERNANCE. This is a handoff, **not** a declaration that BNB-2.1 passed, that issuers were approved, or that BnB may enable booking/payments.

Source: PR #600 BNB-2.1 authority gap reconciliation; canonical 420Identity ID-AUDIT-9 and official network manifests govern. Repository truth and current main override this handoff. All stages require approved operators, real deployment provenance and non-secret, independently reproducible exact-SHA evidence. Do not create fake issuer credentials, addresses, receipts, or governance approvals.

## T-BNB-IDENTITY-1 — Official network and Identity420 lifecycle (upstream dependency)

**Prerequisite:** official `developer-hub/manifests/testnet.json` published through network governance, deployed Identity420 with canonical frozen address `0x0000000000000000000000000000000000000436`, approved Genesis/chain ID, runtime code hash, GovernanceTimelock authority, wallet/indexer/search/explorer consistency.

**Run:** canonical `ID-AUDIT-9` production-equivalent acceptance, including profile/issuer/credential lifecycle, real approval/issuance/revocation/expiry transactions, chain reorg/dependency failure and independently checked immutable/config/storage hashes. Reference the upstream qualified SHA and original receipts; do not duplicate Foundry/global suite runs.

**Exit evidence:** valid official manifest, transaction hashes/receipts, code/storage witnesses, runtime hash and matching verifier PASS. BLOCKED while upstream ID-AUDIT-9 is incomplete.

## T-BNB-IDENTITY-2 — Trusted session verifier and production signing keys

**Prerequisite:** independently authenticated Wallet/420Identity session verifier with service-specific BnB audience/chain/network; governance/operator-approved issuer and security owners; a deployed KMS/HSM or equivalent key custody policy (no private keys in repository).

**Run:** pin trusted issuer provenance; exercise key ID rotation with overlap and retirement, revoked-session and inactive-subject denial on *every* protected mutation, compromised-signing-key shutdown/reissuance, provider outage/timeouts, wrong-chain/audience, expiration, clock skew, stale caches, independent recovery, fail-closed restarts and multi-instance consistency.

**Exit evidence:** non-secret issuer metadata, approval reference, verifier runtime/version identities, signed key lineage/public fingerprints, revocation/rotation/incident drill timestamps, request/response and audit-trace IDs, negative test results. No claimed live acceptance from synthetic JWTs.

## T-BNB-PROPERTY-1 — Independently approved host/property issuer

**Prerequisite:** governance approval explicitly naming the authorized legal/operational property verification service and responsible reviewing operators. 420Verify software-build verification is **not** property title/tenancy/licensing authority.

**Policy to approve:** jurisdiction-specific proof of lawful ownership or authorization to host; verified controller and property identifiers; right-to-let and licensing applicability; consent, minimization and retention; evidence freshness; independent reviewer separation of duties; anti-self-attestation; appeals/disputes; issuer suspension and compromised-key response; JTI/subject/property binding, expiry and revocation; audit and removal/escalation standards.

**Run:** verify actual external issuer provenance and revocation checks. Test forged/expired/cross-property claims, disputed or revoked license, changed controller, operator compromise and outage. Claims remain pending until independent verification; no approval by submitting a signed software attestation.

**Exit evidence:** governance decision reference, policy version, issuer identity/public signing-key lineage, reviewer/audit proof, redacted sample claim and valid/revoked history tied to specific properties. No BnB self-approval.

## T-BNB-INTEGRATION-1 — Production-equivalent cross-instance acceptance

**Prerequisite:** all three above gates qualified against the same testnet deployment and release SHA, production-equivalent PostgreSQL and HTTPS services.

**Run:** two or more BnB instances sharing PostgreSQL; actual provider-backed login/logout/revocation/recovery; concurrent session revocation vs property/hold operations, replay and IDOR, cross-tenant/manager capability expiry, property claim forgery/review/withdrawal, policy snapshots, expired credentials, key rotation, outage/restart/recovery, browser and HTTP API permission matrix. Record each request-to-auth-decision with sanitized trace evidence.

**Exit evidence:** reproducible test plan; service images/digests; exact SHA; chain/issuer identifiers; migration/checkpoint IDs; per-case PASS/FAIL and non-secret traces; operator and independent security signoff. Any failed condition keeps publication, settlements and protected actions fail-closed.

## Repository-side work that is NOT deferred

BNB-2.1 code and security acceptance must still implement: fail-closed signed proofs, local account/session/recovery authorization; caller-header spoof resistance; independently reviewed property capability enforcement; PostgreSQL adversarial replay/collision/cross-account tests; affected API route and browser permission matrix; bounded endpoint/issuer configuration, negative verifier tests, key rotation and revocation adapter contracts; CI on exact implementation SHA. These can be completed and recorded as *repository-side Level 1*, not as live external acceptance.

## Qualification and closure

- Preserve Level 1 targeted BnB CI and exact-SHA evidence for local work; no redundant global Foundry/Genesis/Docs qualification.
- Record the above as a separate **testnet handoff**; do not mark them complete merely because unit tests pass.
- BNB-2.1 overall remains **PARTIAL / LIVE-DEPENDENCIES-DEFERRED** until the external gates are witnessed. A later governance decision may define a narrower repository-only milestone, but cannot retroactively assert live acceptance.
- Do not merge or activate restricted functions based solely on this document. Reconcile with current main and apply the usual PR-specific merge approval and qualification rules.

## T-BNB-MEDIA-1 — Independent media moderation operational authorization (BNB-2.2 handoff)

**Deferred external prerequisite; not a completed certification.** App runtime currently verifies externally signed, purpose-scoped media reviewer decisions and replay fences, but cannot create organizational authorization or issue managed signing keys.

- Obtain written independent operator/governance authorization, reviewer identities and separation-of-duties, jurisdiction-specific moderation/rights/privacy policy, appeal and incident-response plan.
- Provision approved KMS/HSM custody, issuer and audience configuration, verifiable public key lineage, rotation/revocation and compromise response; never check credentials into Git.
- Perform end-to-end approved/rejected/revoked decisions using actual reviewers, with negative wrong-media, wrong-decision, forged/expired/replayed/compromised signing assertions and fail-closed provider outages.
- Record authorized independent signoff, exact release SHA, policy version, signed decision/audit identifiers, signer fingerprint and operator acceptance. Until verified, media remains pending and listings cannot self-publish.

Canonical acceptance checklist: `docs/bnb/BNB-2.2-EXTERNAL-ACCEPTANCE-PLAN.md`.

## T-BNB-ACCESSIBILITY-1 — Independent manual WCAG 2.2 AA acceptance (BNB-2.2 handoff)

**Deferred external human acceptance; not a completed accessibility signoff.** Automated Chromium/axe responsive checks already run in app-specific CI, but cannot substitute for actual screen-reader evaluation.

- Deploy the exact tested release to accessible staging/testnet and use qualified human testers for Windows Chrome/Edge with NVDA, macOS Safari with VoiceOver, iOS Safari with VoiceOver, and Android Chrome with TalkBack.
- Exercise signed-in and anonymous guest/host journeys, keyboard-only access, full reflow/zoom, reading order, focus retention/traps, headings/landmarks, form labels/error announcements, calendar conflicts, provider outages, accessible authentication and successful/rejected/pending submission states.
- Record dated human tester identity/affiliation, device/OS/browser/AT versions, checklist and results by criterion, defects/fix and retest SHA, independent signoff and evidence pointers.
- BNB-2.2 live operational release remains **BLOCKED** until human and reviewer evidence is independently verified. Do not mint CI signoff or mark automated axe checks as manual PASS.

The two external gates are *deferred, not waived*. Continue subsequent offline/repository-only roadmap work without activating restricted functions; run only targeted Level 1 checks until real integration/phase milestones.

## T-BNB-CALENDAR-1 — Independently authorized calendar feed acceptance (BNB-2.3)

**Repository-side adapter qualified** on `0b025f776d1c88ab38df959e2a5ef4a8f6a1a56b`, but no live provider authorization is implied. Approve actual calendar feed provider/issuer and property-unit ownership scope, secure independent managed signing credentials and revocation; exercise signed payload hash/issuer/audience/media-independent unit binding, source-ID and event-ID replay/duplicate handling, stale feed detection, outage/rotation/compromise, retention and appeals against deployment-equivalent BnB/PostgreSQL instances. Retain policy decision, operator approval, key lineage fingerprints, real non-secret source evidence, exact service image and per-case acceptance traces. Never configure fixtures or self-signed test keys as a production calendar authority. Until accepted, third-party feed state cannot grant booking/payment/property publication authority; stale signed observations fail closed.

## T-BNB-QUOTE-1 — Authoritative tax, merchant and payment quote acceptance (BNB-2.4)

**Deferred external acceptance, not waived.** BNB-2.4's repository-side price plans and integer itemized snapshots are explicitly nonbinding. Live financial execution requires independently adopted jurisdictional tax/fee rules and updates, current rate/revision issuer provenance, a verified host Pay merchant and activated payout controller, an approved settlement asset/chain, authoritative invoice and signed quote binding through 420Pay (and Pay-governed 420Swap where applicable), key rotation/revocation and consumer pricing disclosure.

**Run on production-equivalent testnet:** verify independent authority for applied tax jurisdiction and currency; canonical payer, merchant, asset, invoice, quote expiry, policy hash and beneficiary split; exact smallest-unit totals; consumer maximum/consent; stale/repriced quotes; wrong-chain/asset/recipient, replay, expired signatures, Pay outage, settlement delay, partial finality and refund paths. Real signing/approval is never replaced by a local SHA-256 snapshot digest. Booking and payment confirmation remain disabled until canonical 420Pay finality and upstream official-testnet gates pass.

**Evidence:** governance and tax-rule references, approved provider/merchant identities, issuer key fingerprint and rotation proof, deployment/release SHA, redacted signed quote and Pay invoice references, provider traces and independent security/operator acceptance.

## T-BNB-BOOKING-1 — Real booking acceptance, 420Pay finality and postpayment lifecycle (BNB-2.5)

**Separately gated operational acceptance, never locally self-approved.** The BNB-2.5 repository-side engine may admit quote-bound guest requests, host approval/decline, enabled instant-request eligibility, prepayment cancellation, timeout expiry and private pending-payment reservation records. This does **not** authorize guests/hosts/admins to confirm a paid reservation or issue refunds.

Before operational confirmation is possible, qualify official Identity and independently licensed property verification; real 420Pay merchant controller, canonical invoice and asset/chain authority; Wallet consent; proof-authenticated payment receipt finality and rollback/reorg handling; exact Pay quote/invoice/payer/host binding; reservation-to-hold commitment and immutable policy snapshots. After confirmation, separately qualify permitted modifications, cancellation policy, optional deposits, partial refund settlement, dispute/Arbitration outcomes, payout and post-stay evidence. Confirmed inventory must be preserved until authorized release and never resurrect expired holds on late payment. Where a real provider is unavailable, remain fail-closed with payment pending/expired and explicit recovery paths.

**Required release witnesses:** governance/operator approvals; authoritative issuer, contract, signing-key and merchant provenance; same chain/testnet/service release SHA; nonsecret signed Pay invoice, accepted amount/asset/recipient proof and canonical finalized receipts; wrong-chain, wrong-merchant, forgery, replay, key rotation, reorg, expired hold, lost connection and competing booking tests; independent security acceptance. Never substitute synthetic JWT, quote SHA hash, client receipt or screenshot for approved finality.

## T-BNB-PAY-2 — BNB-2.6 authorized 420Pay and 420Swap operational acceptance

BNB-2.6 implements a **fail-closed inbound canonical Pay adapter**, not a self-authorized payment processor. The API accepts an independently signed Pay-origin intent only for a live pending reservation and exact immutable quote, activated verified merchant and payout controller, supported chain/asset/amount, and an explicit Pay-governed native $420 or bound Swap conversion route. Quote, principal, merchant, payer, asset, chain, fee/total, nonce and expiry mismatches fail closed. A separately signed **FINALIZED/SETTLED** receipt assertion is tied to canonical invoice/payment ID, chain, asset, amount, merchant and receipt fingerprint, replay ledger and reservation inventory. Late/unmatched records route to recovery without resurrecting stock. Local signed test certificates are synthetic and prove only verifier behavior.

**Pending independent prerequisites:** externally authorized deployment and trust root for actual 420Pay PaymentRouter/InvoiceRegistry/PaymentRegistry/SettlementRouter and MerchantRegistry; approved chain and native $420 asset identifiers; approved 420Swap canonical quote engine and Pay-only settlement adapter; verified merchant activation and payout identity; verified chain finality policy, block/receipt attestation including reorg/reversal/recovery semantics; canonical asset conversion/FX source and time bounds; user Wallet consent and accepted transaction; signed proof issuer key custody, rotation and revocation; end-to-end settlement/fee/payout/refund conservation, independent security signoff, controlled production-equivalent testnet credentials.

**Release gate:** no mocked local signer, quote SHA digest, arbitrary webhook, receipt screenshot, or explorer observation establishes actual independently verified Pay finality. Financial execution and payment instructions must remain disabled until real upstream protocol acceptance and operational authorization. Retain testnet traces for wrong network, double-paid invoice, duplicate receipt, stale route, under-delivery, invalid payout controller, non-final transaction, post-finality reorg, late payment and refund/recovery.

## T-BNB-SETTLEMENT-3 — BNB-2.7 independent refund and host payout acceptance

**App-side Level 1 does not authorize movement of actual customer funds.** Independently deploy and approve canonical Pay SettlementRouter420, RefundManager420, merchant controller, developer compensation vault beneficiary, platform fee/recipient schedule and any Pay-bound 420Swap route. Verify governance-published economic split version and legal tax/refund terms before enabling a booking payout.

On a production-equivalent testnet, reconcile each signed **Pay-captured same-asset amount** against frozen host/platform/developer/retained allocations and refund liabilities. Demonstrate actual authorized partial refund requests and Pay-issued FINALIZED receipts, confirmed original-payer destination, pending payout reservation and finality, eligible checkout/dispute window, beneficiary rotation, failed payout/retry with a fresh canonical operation ID, provider outage, duplicate callback and crash-safe reconciliation, multi-instance concurrent refund-versus-payout race, approval revocation and reorg. Verify no aggregate overpayment/refund and no hidden BnB custody, while preserving future policy/legal liabilities.

Required evidence: exact deployment image/SHA and Registry/frozen address authority, canonical Pay invoice/payment/disbursement/refund IDs, chain/asset/payer/beneficiary approvals, signed key lineage/revocation, finality and recovery traces, immutable split-policy hash, independently approved developer compensation address and schedule, provider security assessment and applicable financial/regulatory authorization. Until separately accepted, the BnB integration is **read-only Pay economic mirroring**, not live disbursement/refund execution.

## T-BNB-TRAVEL-210 — Independent Location, jurisdiction and public map operational acceptance

**Status: DEFERRED TO REAL OPERATOR AUTHORIZATION / OFFICIAL TESTNET.** BNB-2.10 now contains repository-side issuer-verification adapters, location/place bindings, signed jurisdiction policy ingestion, revocation, conservative authorized public listing output, coarse map markers and a public 420Travel consumer. Those are software mechanisms, not approval of an actual property/place authority or legal policy source.

1. Approve an independent 420Location-backed property/place claims issuer with binding evidence, reviewer separation, valid place IDs, property-controller changes, precision policy, retention, revocation, key custody/rotation and issuer incident response. Configure the `BNB_LOCATION_AUTHORITY_ISSUER`, `BNB_LOCATION_AUTHORITY_AUDIENCE` and `BNB_LOCATION_AUTHORITY_PUBLIC_KEY_PEM` only after approval.
2. Approve a distinct jurisdiction-rule authority with lawful hosting eligibility by geographic scope, rule version, effective/expiry dates, appeal procedures, revocation, signed issuance, issuer key lineage and local legal review. Configure the `BNB_JURISDICTION_AUTHORITY_*` parameters separately. A country string, public-region label or cannabis-friendly tag is **not** approved policy evidence.
3. Authorize publicly displayed **coarse one-degree grid** BnB marker positions separately from precise 420Location places. Do not geocode private addresses or publish exact home coordinates. Review privacy leakage, low-density areas, association takeover, stale map marker, property withdrawal and cross-property controller transfers.
4. Deploy separately authenticated HTTPS `BNB_TRAVEL_PUBLIC_URL`, `TRAVEL_BNB_PUBLIC_URL` and `TRAVEL_BNB_WEB_URL` origins and test issuer rotation, expiry, revocation, invalid jurisdiction, time boundaries, 420Travel provider timeouts, stale listing/unpublish/suspend transitions, concurrent version changes, cross-instance PostgreSQL, browser handoff and manual screen-reader map/list experiences.
5. Independently witness signed real claim IDs, policy revisions, real public place projections, actual legal review and provider/operator signoffs. Retain nonsecret exact-SHA release evidence, deployment manifests, key fingerprints, redacted claim proof receipts, retraction traces, migration version and cross-service CI logs.

**Fail-closed release rule:** without authorized source configuration and valid current proofs, the Travel accommodation consumer must show no authorized listings or return unavailable. This gate does not activate Travel Genesis booking, 420Pay settlement, delivery transactions or downstream payment finality.

## T-BNB-TRAVEL-210A — BNB-2.10 residual *live-testnet-only* acceptance (explicit deferral)

**Deferred—not waived.** The following cannot be truthfully completed with an isolated developer database or synthetic tokens:

- Obtain governance/operator authorization for the external independent 420Location property/place issuer, review actual property-to-public-place/controller evidence, validate issuer separation, key custody, key rotation and revocation, publish authorized public-key fingerprints and redacted signatures. Bind only legally approved and current claims to actual property identifiers.
- Obtain jurisdiction-qualified independent legal/policy approval for each supported place/property jurisdiction; witness the rule's effective dates, revision, geographic coverage, restrictions, appeals, source lineage and revocation. Do not turn absent or expired approval into an `allowed` policy.
- Authorize any coarse map cell as safe to publish for the specific property; verify precision restrictions, sparse-area privacy, withdrawal, reassignment, and transfer. Public-region labels cannot supply exact property locations.
- Deploy approved independently authenticated HTTPS 420Location, 420Travel, 420BnB, policy issuer and multi-instance PostgreSQL; provision non-secret network identities and scoped signing key fingerprints outside the repository. Record deployment SHA/image digest, schema migration #018 and source-of-truth revisions.
- Execute production-equivalent two-instance cross-service scenarios with authentic approvals: issue→discover→revoke→remove, signed-policy allow→expire/prohibit→remove, property transfer/version change, stale cached map/list withdrawal, issuer replacement, credential compromise, outage and recovery, browser screen-reader acceptance, live handoff/booking freshness, observability and reviewer approval. Retain timestamps, sanitized per-case traces, redacted receipts and independent security signoff.

**Testnet exit rule:** Never mark this gate PASS without independent source approvals and witnessed deployment evidence. The repository-side `bnb210_external_acceptance.py` probes only evidence completeness and public HTTPS contracts; it explicitly reports `operator_approval_verified=false` and is not a legal certificate. Continue with other repository-side roadmap implementation while preserving fail-closed production visibility and disabled Travel financial paths. Do not rerun repository-wide Foundry or Docs outside the canonical phase boundaries.

## T-BNB-REPUTATION-211 — Real 420Reputation issuer and moderator acceptance

**External/testnet gate only — not evidence that BNB-2.11 repository work is complete.** 420BnB provides a signed, service-scoped read projection of verified completed-stay review status/rating and a signed receipt acknowledgement mechanism. A live 420Reputation service/operator, independently approved service issuer, public signing keys, revocation/key rotation and actual downstream ingestion proof are not established by BnB source code.

Require official 420Reputation consumer contract qualification and its authenticated production-equivalent deployment, approved reviewer issuer for guest reviews, host response moderation and abuse adjudication, reviewer appeals/withdrawals, moderation incident escalation, multi-instance replay controls, stale/withdrawn-rating propagation, negative-IDOR/privacy tests and an independent manual screen-reader review. Validate external receipts and authoritative scores without granting BnB unilateral reputation authority. Record exact deployed SHA, service IDs, non-secret fingerprints, actual receipt IDs, provider logs, run IDs and issuer/operator/security approval. Preserve fail-closed service-to-service access until then.

## T-BNB-COMPLIANCE-212 — Independent legal eligibility and guest assurance acceptance

**Deferred external requirement, not a repository-side completion certificate.** Independently approve real 420Compliance regulatory source/decision issuer and responsible licensing authorities, lawful geographic scope and accommodation categories, municipality/province licensing/registration, verified property controller, applicable minimum guest ages and identity requirements, effective/sunset revision, appeals, consent and lawful data retention. Secure issuer public-key custody, rotations, suspension/revocation and authoritative amendment provenance. Bind each claim to the canonical 420Location property-to-place, jurisdiction and current property version.

Production-equivalent testnet validation must witness real 420Compliance service/oracle decisions, independently verified license reference, verified-age and identity provider assertions without recording date of birth or ID documents in BnB, jurisdiction change and changed controller, prohibition or revoked license while Travel lists content, concurrent bookings and policy withdrawal, invalid/stale proof, identity/session revocation, privacy/abuse moderation, audit/redaction and multi-instance cache invalidation. Require operator/legal/security signoff and exact deployment SHA/manifests. Where policy is unverified or expired, listings and protected booking requests must fail closed. Compliance authority approval is not minted from a BnB-controlled JWT.

## T-BNB-SECURITY-213 — Production-equivalent security and economic fault acceptance

**Deferred external acceptance; no locally minted approval may substitute.** Perform independent black-box intrusion/security review against the final deployed BnB API/website and independently operated Identity, Pay, Location, Compliance and Reputation services. Exercise hostile request origins, content injection, cross-tenant IDOR, malicious host/guest role transfers, session revocation, delegated capability expiry, account recovery races, scraping/private-location inference, rate exhaustion, audit retention and appeal workflows with real issuer/key revocation.

On the actual official testnet, witness independent 420Pay payment finality and subsequent reorg/finality-revocation, late receipt after hold expiry, duplicate receipts and JTI, same payment reused across property/reservation, reserve/finalize/fail interleavings, partial and cumulative refund conservation, original-payer refunds, concurrent payouts, payout-controller takeover and failover, receipt and provider reconciliation, refunds and recovery ledgers. Assert no invented confirmation, double-booking, overdistribution, or client-created settlement finality. Record the actual deployed SHA, independent issuer provenance, operator/security acceptance, chain and receipt IDs, reviewer signoff, exact qualified source SHA and cross-instance logs. This external certification is not satisfied by CI fixtures or a signed JSON supplied by BnB itself.

## T-BNB-OPS-214 — Production-equivalent deployment, resilience and recovery

**Status: DEFERRED to independently administered official testnet.** Provision actual staging/testnet infrastructure and approve the image registry digest, managed PostgreSQL 16, migration operator, least-privilege roles, TLS/mTLS and external secret storage. Demonstrate at least two independently deployed BnB API instances sharing durable DB state; exercise PostgreSQL failover and connection exhaustion during holds, idempotency replay, approved moderation and payment recovery. The local Compose development topology and CI service-container tests are not evidence of this acceptance.

Witness encrypted off-host logical/base backups, retention, restricted restore credentials and isolated full restore, with verified schema ledger, application invariants, restore manifest, operator approvals and measured RTO/RPO. Exercise expansion-compatible rollback and a recovery cutover without claiming destructive migrations can be reversed by redeploying an older image. Verify real HTTPS ingress security, redacted tracing/metrics/logs, alert routing, on-call ownership and incident drills, including canceled/stale migration detection, crashed pods, late Pay events, issuer revocation and external provider outages. Record actual deployment exact SHA/image digest, instance identifiers, DB versions, run IDs, encrypted backup fingerprint, witnessed restore logs, operator and security signoff.

## BNB-3.6 external Pay/Wallet acceptance — explicit Phase 3 deferral (2026-10-12)

**Owner decision: DEFER to this official testnet work roadmap.** Actual user Wallet consent and signing, official-testnet Pay fund movement including partial original-payer refunds and beneficiary payouts, finalized-reorg/finality-revocation recovery, and independent payment operator/legal/security acceptance remain **NOT WITNESSED / BLOCKED**. Preserve the four existing independent gates `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1`, `T-BNB-PAY-2` and `T-BNB-SETTLEMENT-3`; no scope or acceptance criteria are waived.

The detailed independent-witness procedure, trace/receipt checklist, signoff matrix, release guard and privacy rules are in [BNB-EXTERNAL-PAY-WALLET-ACCEPTANCE-DOCKET.md](BNB-EXTERNAL-PAY-WALLET-ACCEPTANCE-DOCKET.md). Repository-side BNB-3.6 / M3-A Level 2 evidence is in [BNB-3.6-M3A-LEVEL2-QUALIFICATION.md](BNB-3.6-M3A-LEVEL2-QUALIFICATION.md), qualified implementation SHA `b01b47a7e72e6af78d34fd965e29a81f95673ad8`. This synthetic/app qualification is not a substitute for independent acceptance.

**Development continuation is authorized, not payment activation.** Keep `travel.bnb_booking=false`, custody/refund/payout unactivated, audit PR #620 draft and unmerged until its planned BNB-3.12 phase qualification/integration decision. Next canonical repository step is **BNB-3.7 — Guest experience**. Return to the blocked external gates only when official network and independently authorized Pay/Wallet operators, test payer, and reviewers exist.
