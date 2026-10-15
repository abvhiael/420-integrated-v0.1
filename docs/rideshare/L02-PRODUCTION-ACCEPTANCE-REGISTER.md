# LIFTd — Production and Independent Acceptance Register

**Scope:** M-L02-A retained external gates, 2026-10-14.  
**Last qualified milestone executable SHA:** `596bcfc329555916e26f42a50702481b0f348193`.  
**M-L02-A Level 2:** [CI 38654899486](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38654899486) PASS (app integration only).  
**Acceptance rule:** Automated fixture or isolated PostgreSQL success is never production approval. Each gate remains **NOT ACCEPTED** until the independent evidence below exists and an authorized owner signs an immutable, dated acceptance record bound to an actual deployed environment, deployment digest and service configuration.

## A. Production Identity / signed session authority — NOT ACCEPTED

Owner: independent Identity issuer + independent session authority; LIFTd is consumer only. Evidence required:
1. Identify production issuer/audience, signing-key IDs/public-key fingerprints, session-resolution endpoint and environment/deployment digest; prove independently managed and separate keys.
2. Exercise freshly minted real rider, driver and operator sessions through deployed LIFTd endpoints with correct scoped grants/account bindings.
3. Capture issued/revoked/recovered/expired-device/access-token cases, revoked session/status propagation, foreign-account and cross-role denials and verified audit events.
4. Demonstrate secret-handling, key rotation, fallback fail-closed behavior, multi-instance verification and nonproduction/live-environment isolation.
5. Approving Identity and security owners sign the evidence reference. Do not copy actual credentials/secrets into repository.

## B. Independent live transport/Registry eligibility — NOT ACCEPTED

Owner: approved BC passenger-transport/legal authority, Registry and transport proof issuer. Evidence required:
1. Independent jurisdiction/service/operator/route approvals for the **actual Vancouver passenger-transport service**, not reused delivery approvals.
2. Verified driver licence, vehicle registration/inspection, coverage/insurance and approved operator credentials in independent issuers, tied to current, expiring signed proofs.
3. Demonstrate suspension/revocation immediately blocking assign, arrive and start, including during concurrent dispatch and stale proof replay; prove no acceptance of forged or applicant-issued approval.
4. Validate geography (municipality and excluded airport/cross-boundary), passenger capacity and scope; attach approval IDs/expiry and independent compliance signoff.
5. No dispatch or public live availability until all applicable authorities certify.

## C. Private document-vault and reviewer acceptance — NOT ACCEPTED

Owner: private vault operator, security/privacy and independent reviewer/Compliance. Evidence required:
1. Provision approved encrypted segregated vault; document ingestion via authenticated scoped upload receipt, malware/file-type/size checks, encryption and access/audit retention policy.
2. Bind opaque receipt to driver, account, vehicle, document class, expiry and immutable content version; demonstrate revoked/deleted/expired/forged/cross-account receipt denials.
3. Verify approved reviewer credentials, independent attestation issuer, legal transport evidence binding, revision-controlled remediation/approval/rejection/revocation and reviewer separation from applicant.
4. Test database backup/restore and vault outage/rotation; ensure private bytes/receipt paths never leak into discovery/Indexer/trip events, public responses, browser storage or logs.
5. Obtain data protection/reviewer approval and securely retain evidence references only.

## D. Scoped rider–driver messaging/contact — NOT ACCEPTED

Owner: canonical Messaging/420Town provider, Identity/session owner, safety/privacy reviewer. Evidence required:
1. Authorize a conversation **only** for the currently assigned rider and driver on an eligible trip, using a server-minted, short-lived, single-trip scoped conversation entitlement.
2. Verify cross-trip, nonparticipant, reassignment, trip cancellation/completion, revocation, blocked users and replay denials, including consent and retention.
3. Confirm delivery receipts, transport encryption, abuse reporting/incident escalation, moderation and accessibility handling without exposing personal phone numbers.
4. Demonstrate outages fail closed without opening uncontrolled contact channels; reviewer signs redacted evidence.
5. Until accepted, keep current UI notice and absence of messaging controls.

## E. Independent accessibility acceptance — NOT ACCEPTED

Owner: independent accessibility QA with actual representative devices/assistive technologies. Evidence required:
1. Test rider account, manual/permission-denied pickup, route preview, fare/expiry/cancellation disclosure, explicit consent, trip status, safety reporting, onboarding/remediation and failures.
2. Keyboard-only and focus order, visible focus, skip links, error recovery, semantic field labels, status announcements, zoom/reflow, reduced motion, contrast and touch targets.
3. Screen-reader assessments on representative Windows/browser and iOS/Android combinations; mobile viewport and touch navigation, orientation, high zoom and live-region behavior.
4. Document WCAG 2.2 AA criterion-level results, defects, severity, retest proof and independently signed acceptance; automated DOM/static CI alone does not constitute a PASS.
5. A failed critical safety/payment/consent flow blocks operational use until repaired and retested.

## Required acceptance artifact per gate

A future certificate must include: gate identifier; real environment and issuer/operator identity; deployed implementation/config digests; independent test results with dates, negative/security paths and evidence links; reviewer name/role and signed disposition; exceptions with owners and deadlines; explicit PASS/FAIL status; expiry/revalidation triggers; no passwords, tokens, raw ID documents or personal health/location details.

**Operational release rule:** Neither a production claim nor driver dispatch, payment capture or a public booking experience may be enabled while any applicable gate remains unaccepted. M-L02-A code Level 2 and L02.5 Level 1 certification do not alter these statuses. External/testnet work remains subject to its canonical phase roadmap and the separately authorized owner signoffs.
