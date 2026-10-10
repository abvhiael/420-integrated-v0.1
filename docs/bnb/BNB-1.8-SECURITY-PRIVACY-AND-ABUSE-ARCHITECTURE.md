# BNB-1.8 — Security, Privacy and Abuse Architecture

**Scope and provenance.** BNB-1.8 security architecture for the intended 420BnB marketplace; this document is not evidence of an installed backend or browser implementation. Governing sources: `docs/genesis-services/THREAT-MODEL.md`, `docs/genesis-services/GEN-SVC-0-ROADMAP.md`, BNB-1.1–BNB-1.7, Genesis config and retained Travel fail-closed gateway. **Next canonical step: BNB-1.9 — Deployment and Operations Architecture.**

## Threat inventory and trust zones

| Asset / boundary | Attacker goal | Mandatory defense and recovery | Evidence needed at executable implementation |
| --- | --- | --- | --- |
| Host, guest and property Identity | impersonate owner, bypass delegated property scope, stolen token, takeover | independently verify issuer/audience, principal, expiry, revocation, permission and property ID on every write; MFA or step-up for high-risk transitions; forced session invalidation and audit | tenant/property IDOR, revoked capability, stale identity, forged session, role escalation |
| Listing publication | fictitious lodging, fraud, misleading badges, unlawful short stays | controller verification, provenance/licensing rules, human review/appeal, suspicious pattern/rate analysis, safe publication suspension | false property claims, copied license, inactive host, suspended listing |
| Capacity/hold/reservations | overlapping bookings, bot hoarding, expired hold resurrection | authoritative transactional occupancy enforcement, bounded hold TTL, concurrency locks, quotas, fair anti-automation limits, payment-late recovery | parallel overbooking, DST boundaries, expiration race and duplicate hold |
| 420Pay and payout | forged settled status, refund diversion, double charge, unauthorized escrow | **420Pay remains canonical financial authority**; separately verified invoice/payment/finality/merchant/controller proof; canonical refund and payout only; immutable totals; BnB cannot independently authorize settlement, custody, refunds or payouts | unsigned callback, synthetic receipt, wrong chain/asset/merchant, partial refund terminalization, double payout |
| 420Swap conversion | quote replay, stale route, slippage manipulation | approved Pay-bound 420Swap only, correct canonical quote engine, authorized PaymentRouter execution, expiry, minimum delivery, payer/recipient/asset binding | bad quote, route substitution, insufficient output, consumed quote |
| Arbitration and customer support | forged ruling, moderator treasury override | independent 420Arbitration decision proof; support/moderation never transfers funds; dual control for sensitive platform actions | forged remedy, privileged operator bypass, conflicting appeals |
| Reputation/reviews | Sybil reviews, fake verified stays, retaliation and brigading | 420Reputation owns verified-interaction eligibility; one versioned review per verified stay, verified provenance, conflict monitoring, appeal and anti-spam | fabricated stay, self-review, cloned interaction, review replay |
| Search/Travel/Analytics | data poisoning, stale availability, hidden inventory leak | public read models only, visibility before indexing, rebuildability, freshness/lag indication and privacy filtering | unlisted listing discovery, stale search confirmation, inference attacks |
| Geo/private lodging | home address exposure, stalking, check-in code leak, guest travel profiling | public coarse location, exact address and access instructions disclosed only to authorized reservation principals at appropriate lifecycle stage, purpose-bound access, anti-scraping and access audit | bounding-box enumeration, wrong-guest address lookup, unauthorized map coordinates |
| Media/messaging | malicious uploads, malware, phishing, harassment, child safety risks | signed time-bounded upload limits, MIME/magic validation, virus scan, transcoding, Rights provenance, report/block/mute and retention | script injection, cross-tenant attachment access, banned file, stored XSS |
| APIs/webhooks | CSRF, XSS, SSRF, IDOR, injection, replay, mass assignment, credential abuse | strict allowlist schemas, parameterized DB, origin/CSRF defenses, output encoding/CSP, signed domain-separated webhook provenance and nonce, rate limit, network egress controls | fuzz malformed JSON, replay, tampered payload, cross-tenant mutation |
| Database/workers | inconsistent booking state, poison message, insider access, leaked backup | least-privilege DB and KMS roles, serializable capacity transaction, encrypted backups and restore tests, atomic outbox/inbox, cursor checkpoints, append-only audit and idempotency | concurrent state races, crash/restart, tampered cursor, retained duplicate callback |
| Protocol boundary | guessed Registry addresses or new Genesis authority | Registry-resolved source/version/chain; existing frozen catalog and Travel transaction gate unchanged | unregistered service, wrong chain, stale manifest and gateway bypass |

## Data inventory and privacy-by-design

**PII (personally identifiable information)** includes guest and host identity records, contact details, booking and travel information linked to a person, private lodging addresses and precise coordinates, check-in instructions and access credentials, and financial references tied to an identifiable payer or recipient. These categories remain PRIVATE or HIGHLY RESTRICTED according to sensitivity. Enforce purpose limitation, data minimization, independently authorized tenant/property/booking access, encryption in transit and at rest, field-level controls for sensitive values, short-lived access permissions, audit trails, redacted logs and public projections, and retention/deletion rules subject to lawful holds. Never expose PII through public listings, Search, Analytics, 420Travel, notifications, unverified webhooks or cross-tenant API responses. Access codes, private keys, authentication secrets and raw identity documents require stronger segregation and must never be treated as ordinary listing metadata.


Classification: **PUBLIC** redacted listing data, approximate location, published approved attributes; **PRIVATE** guest/host full identity and booking details, precise lodging coordinates, contact methods, private messages, calendars, travel patterns, government IDs, payout references, access codes; **HIGHLY RESTRICTED** authenticated authority proofs, service secrets, KMS metadata, audit/abuse investigations. Store precise location separately from public place coordinates. Perform tenant/property authorization **before** fetching or projecting sensitive records, and strip location/address metadata from media files when needed.

Collect the minimum fields required for booking safety and accommodation eligibility. Purpose-limit host/property verification and guest disclosures. Record consent, publication reason, region and lawful processing basis according to applicable jurisdiction; document retention schedule by data class, deletion/tombstone, legally required financial/audit retention and appeal/incident holds. Do not claim universal GDPR/PIPEDA compliance without jurisdictional and legal qualification. Provide subject access, correction, export and erasure processes with identity checks, third-party redaction and audit trail. Encrypt transit and at rest, separate field encryption for high-sensitivity records, managed key rotation, authenticated short-lived credentials and scoped backup access. Avoid payment secrets, private keys, access codes or raw identification in logs, analytics, alerts or on-chain hashes that could enable correlation.

## Fraud, moderation and escalation

Cover mandatory GEN-SVC-0 classes: `SPAM`, `SYBIL`, `FAKE_REVIEWS`, `SELLER_FRAUD`, `CROWDFUNDING_ABUSE`, `LOCATION_PRIVACY`, `MESSAGING_ABUSE`, `MODERATION_ABUSE`, `CONTENT_RIGHTS_ABUSE`, `ESCROW_FAILURE`, `INDEX_POISONING`, `WEBHOOK_REPLAY`. The unrelated categories remain shared-model constraints, not an assertion that BnB implements crowdfunding.

Use proportional throttles for search, booking holds, request spam, identity registration, review publication and host contact. Pattern checks may flag suspicious conduct but cannot replace source-of-truth verification or automatically seize funds. Moderation supports report, block, mute, hide, suspend, decision, restore and appeal with operator provenance, timestamps and reason; suspend public visibility without modifying Pay custody, Registry entries or immutable prior transactions. Security incidents require triage severity, affected identities/properties, containment (token revocation, publish freeze, feature kill switch), canonical Pay reconciliation, bounded recovery, notification where legally required and durable after-action review.

## State and financial invariants

- Concurrent holds + confirmed stays never exceed real authorized unit capacity over overlapping half-open intervals.
- Expired/revoked session, delegated grant or host ownership cannot authorize a mutation or payout redirection.
- Public indexes and moderation cannot make a reservation confirmed, create Pay finality, expose precise private addresses or grant protocol ownership.
- No finalized refund + reserved refunds + finalized payouts + reserved payouts exceeds exact Pay-finalized captured funds per asset/liability without separately authorized collateral.
- Same idempotency key and digest yields same operation; conflicting digest fails; repeated webhook or reorg cannot duplicate capture, refund or payout.
- Late finalized payment after hold expiry requires governed recovery/refund, never new capacity or fabricated booking.
- Host escrow, cancellation settlement, insurance/damage deposits and transactional Genesis BnB remain disabled absent separately approved authority and live acceptance.

## Acceptance / abuse and security qualification matrix

| ID | Later executable requirement and adversarial proof |
| --- | --- |
| BNB-S01 | Independent Identity/Verify/Registry/Names authority, expiry/revocation, property/tenant isolation and delegated permission |
| BNB-S02 | Fake listing, property claim, license, impersonation and governance-approved publish/report/appeal workflows |
| BNB-S03 | Capacity race, host blocking, hold expiry, bot hoarding, UTC time-zone/DST and replay |
| BNB-S04 | 420Pay finality, asset/merchant/recipient proof, unauthorized settlement and forged invoice/callback |
| BNB-S05 | 420Swap quote expiry, Pay-only settlement adapter, slippage and replay |
| BNB-S06 | Cancellation refunds, partial refunds, payout conservation, Arbitration and moderation authority |
| BNB-S07 | Sybil/verified-stay review abuse, retaliation, reputation provenance and host reply |
| BNB-S08 | PUBLIC/PRIVATE boundary, precise location, address exposure, media geotags, guest data exfiltration |
| BNB-S09 | API IDOR, CSRF, XSS, SSRF, injection, mass-assignment, rate limit and webhook tampering |
| BNB-S10 | Messaging, malware media, content/rights abuse, stalking and evidence preservation |
| BNB-S11 | Encrypted data, secret management, retention/deletion, backup and audit restore |
| BNB-S12 | Multi-instance booking and outbox/inbox crash/recovery, poison event, stale index/reorg |
| BNB-S13 | Moderation/administrator least privilege, action audit, appeals, incident response and kill switch |
| BNB-S14 | Frozen Genesis config, disabled Travel transactions, Registry source/chain correctness and no unauthorized custody |

**Level 1 here:** source-backed security architecture verifier, config guard and prior-app-contract consistency only. **Level 2:** M1 and M2 remain the retained milestones; broader app security integration must occur when executable cross-component changes exist. **Level 3:** complete BNB phase closeout at BNB-1.10, not now. No assertion of a deployed security control, penetration test, live data processing approval, booking backend or operational compliance is made.

**Next canonical step: BNB-1.9 — Deployment and Operations Architecture.**
