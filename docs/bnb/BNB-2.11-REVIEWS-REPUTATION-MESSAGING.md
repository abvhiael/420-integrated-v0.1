# BNB-2.11 — Reviews, Reputation and Messaging

**Canonical scope:** Verified-stay reviews, host responses, 420Reputation integration, guest-host messaging and abuse reporting. PR #600, current BnB app audit; Level 3 deferred to phase closeout.

## Retained existing foundations
- BNB-2.8 already provides completed confirmed-stay guest review creation; guest messaging on permitted booking-request threads; signed independent review moderation with replay protection; publication of approved guest reviews only.
- Published listing details do not disclose the guest identity; booking-thread participants are scoped by authenticated guest and current host authority. No public endpoint exposes private messages.
- Reviewer signing authority is independently configured `BNB_GUEST_REVIEW_*`; never enable self-approved moderation.

## Implementation increment
- Migration `019_reviews_reputation_messaging.sql` adds exactly one response per reviewed stay, moderated host-response states, participant-scoped abuse reports, external reputation export checkpoint state and independent reviewer nonce ledger.
- `POST /v1/bnb/reviews/{review_id}/host-response` requires active host identity matching the currently published property, approved verified-stay review, one response and pending moderation.
- `POST /v1/bnb/internal/host-responses/{review_id}/decision` requires independent reviewer-signed JWT with explicit purpose, review ID, decision and replay protection. Only approved public responses appear with approved reviews.
- `POST /v1/bnb/abuse-reports` requires authenticated guest/host participant ownership and deduplicates target reports. Content stays nonpublic pending independent review.
- `GET /v1/bnb/reputation/public/{property_id}` is a no-store, allowlisted, read-only verified-stay rating/review-ID projection. **420Reputation owns scoring and canonical reputation records**; this endpoint cannot mutate those records or assign scores.
- Booking-request guest/host messaging remains private, nonce-idempotent and restricted by property/booking-request state.
- BnB Runtime Slice applies migration 019 and runs targeted unit/negative tests. BnB Level 1 must pass on exact executable SHA before recording acceptance.

## Outstanding closeout/security work
- Implement independently moderated abuse-report adjudication, message removal/quarantine and user notification, bounded anti-spam/rate-limit and recovery paths. A report submission alone does not assert guilt or remove canonical message content.
- Implement and test the actual **authorized 420Reputation consumer/ingestion contract**, including replay/revocation, identity linkage, withheld-review/withdrawal propagation and current schema interpretation. Public verified-stay facts are not equivalent to a deployed 420Reputation integration.
- Extend PostgreSQL adversarial cases for cross-property host changes, review-response moderation transitions, cross-tenant report IDOR, nonce collisions and status transitions; browser journeys for host responses and reporting.
- Production-equivalent issuer/key custody and 420Reputation operational acceptance must be explicitly handed to the testnet roadmap where genuine independently administered services are required. Local mock approvals do not qualify these external actions.
- Level 2 app integration only at a genuine cross-service milestone; Level 3 once at final accumulated BnB phase reconciliation; never duplicate Foundry inventories.

**Status: IN PROGRESS. No BNB-2.11 completion or CI PASS inferred before tests and all repository-side gaps are closed.**

## Incremental review/reputation and incident integration

- `GET /v1/bnb/internal/reputation/verified-reviews/{property_id}` requires a separately configured BNB_REPUTATION verifier, a signed `verified-review-read` purpose and matching property identifier. It returns verified completed-stay IDs, moderation state, date and rating only when approved; private guest content is withheld.
- `POST /v1/bnb/internal/reputation/export-receipt` requires separately signed `review-export-receipt` purpose, exact review/revision/external reference and monotonic stored acknowledgement. BnB never changes a 420Reputation score or executes financial finality.
- `POST /v1/bnb/internal/abuse-reports/{report_id}/decision` requires independently signed `abuse-report` review proof and permitted one-time pending→accepted/dismissed transition with reviewer nonce and audit event; abuse reports remain private.

**Still required before step completion:** review/message abuse quarantine or removal enforcement, affected browser interactions, production-safe message throttling, exhaustive PostgreSQL adversarial testing for reputation receipt replay/withdrawal and moderation races, and successful Level 1 CI on exact executable SHA. External independent issuer activation and production-equivalent Reputation integration acceptance are separate testnet-dependent gates. Do not treat a new API route as proof the external service has consumed it.
