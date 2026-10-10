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
