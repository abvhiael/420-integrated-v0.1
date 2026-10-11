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

**Status: REPOSITORY-SIDE COMPLETE — Level 1 PASS and app-focused Level 2 milestone PASS on implementation SHA `78b06a9bfbb13ad6341d86858bc190833357d7f3`; live externally authorized 420Reputation/moderator acceptance deferred to `T-BNB-REPUTATION-211`. No Level 3 qualification or merge is claimed.**

## Incremental review/reputation and incident integration

- `GET /v1/bnb/internal/reputation/verified-reviews/{property_id}` requires a separately configured BNB_REPUTATION verifier, a signed `verified-review-read` purpose and matching property identifier. It returns verified completed-stay IDs, moderation state, date and rating only when approved; private guest content is withheld.
- `POST /v1/bnb/internal/reputation/export-receipt` requires separately signed `review-export-receipt` purpose, exact review/revision/external reference and monotonic stored acknowledgement. BnB never changes a 420Reputation score or executes financial finality.
- `POST /v1/bnb/internal/abuse-reports/{report_id}/decision` requires independently signed `abuse-report` review proof and permitted one-time pending→accepted/dismissed transition with reviewer nonce and audit event; abuse reports remain private.

**Still required before step completion:** review/message abuse quarantine or removal enforcement, affected browser interactions, production-safe message throttling, exhaustive PostgreSQL adversarial testing for reputation receipt replay/withdrawal and moderation races, and successful Level 1 CI on exact executable SHA. External independent issuer activation and production-equivalent Reputation integration acceptance are separate testnet-dependent gates. Do not treat a new API route as proof the external service has consumed it.

## Enforcement and browser follow-through

- An independently accepted abuse report now **quarantines** a reported guest message from private thread views or withdraws approved review/host-response visibility, preserving records for audit rather than destructively deleting evidence. Dismissed reports do not alter content. The decision transition and nonce are committed in one transaction.
- Private thread messages enforce 30 authored messages per sender per rolling hour; abuse reports enforce 20 authored reports per reporter per rolling 24 hours. Each threshold uses an account-row lock in the transaction to prevent concurrent bypass across properties. Existing nonce-idempotent replay behavior is preserved.
- The public BnB browser displays independently approved host responses, and offers accessible verified-session submission for review-abuse reports and host responses. New host responses remain pending independent moderation; no host-side auto-approval.
- Tests include unsigned moderator/reputation mutation rejection, strict rating input bounds, property-scope authorization, rejected jurisdiction-independent session bypass and public no-store reputation projection. The cross-service reputation contract is explicitly non-final, without local scoring.

**Outstanding qualification:** run BnB Runtime Slice and changed frontend accessibility on the exact final executable SHA; inspect failures and record a level-1 PASS only when completed. The attached live testnet gate `T-BNB-REPUTATION-211` remains deferred; no independent operator provenance or real 420Reputation deployment has been verified from repository-only code.

## Final repository-side qualification record — 2026-10-11

**Canonical step:** BNB-2.11 — Reviews, Reputation and Messaging; verified-stay reviews, host responses, 420Reputation integration, private guest-host messaging and abuse reporting.

**Level 1 implementation SHA:** `78b06a9bfbb13ad6341d86858bc190833357d7f3`.
**Evidence-only commit:** follows this SHA and changes this documentation alone; no runtime, CI or requirement semantics changed.
**Audit branch / PR:** `audit/420bnb-bnb-1-1-source-reconciliation-20261009`, PR #600, DRAFT and UNMERGED.
**Qualified branch merge base:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.
**Current main when evidence recorded:** `fe21ef07359d6915bf5daac37c4bf24a24fcf19b` — diverged; 414 commits ahead and 686 behind as reported by GitHub compare (do not infer merge readiness).

### Step requirements and verified repository implementation
- **Verified stays:** only completed, confirmed BnB stays produce guest reviews. Independently purpose-scoped reviewer JWT authorizes approval/rejection/withdrawal; duplicate decisions and replay JTIs fail closed.
- **Host responses:** only the current published property's authorized host can respond, once per review; submissions enter independent moderation; publicly returned responses are approved-only.
- **Reputation:** separately purpose-/property-scoped signed verified-review read endpoint emits only confirmed completed-stay facts, with withdrawn/rejected ratings represented as null; signed receipts are monotonic and replay-protected. 420Reputation remains authoritative for scores and actual ingestion; BnB cannot self-assign scores.
- **Messaging:** private request-thread access is checked for the guest/current authorized host; nonces are idempotent, declined/withdrawn/expired requests reject writes, and rolling persisted sender quota is serialized with an account row lock.
- **Abuse:** only authorized guest/host participants can report reviews, private messages and responses; reports are bounded, deduplicated, private, independently dispositioned with signed one-time JWT and audit trail. Accepted reports quarantine messages or withdraw approved reviews/responses. Browser review/response/report controls use safe text rendering and state feedback.
- **Adversarial coverage:** `test_bnb211_postgres_adversarial.py` exercises concurrent moderator decisions, cross-property host denial, accepted-abuse withdrawal, verified-rating nullification on withdrawal, stale/replayed receipts and simultaneous revision acknowledgement. The final fixture correction explicitly creates an approved host response before testing its withdrawal.

### Level 1 — exact-SHA fast qualification PASS
- BnB Runtime Slice **PASS**, run [38165200071](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38165200071): PostgreSQL migrations through 019, BnB pytest/security/adversarial cases, Python compilation, non-root container build/smoke, JS syntax, browser accessibility and frontend verification.
- Associated affected GEN-SVC-3 Travel **PASS**, run [38165200086](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38165200086).
- All nine retained BNB-1.1 through BNB-1.9 app-contract workflows passed on the same implementation SHA; 420Oracle also passed, run [38165199999](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38165199999).
- Global Docs workflow **SKIPPED by path policy**, run 38165199964; not required for this ordinary app-scoped level and **not counted as PASS**.
- Total: **12 executed workflows PASS, zero failures/pending**, on exact implementation SHA. This does not assert that independently issued live credentials have been qualified.

### Level 2 — BNB-2.8–2.11 guest experience / reviews / reputation integration milestone PASS (repository side)
This is a substantive app integration boundary: existing BNB-2.8 guest/review/request lifecycle and BNB-2.11 reputation, abuse and message state transitions share tables and access control. The **retained full BnB Runtime Slice**, covering BnB PostgreSQL transactions, security, browser, and adversarial review/withdrawal/race paths, **already executed successfully as run 38165200071 on the identical SHA**. Retained BNB-1.7 Guest Host Experience **PASS** (run 38165200007), BNB-1.8 Security Privacy Abuse **PASS** (run 38165199921), and GEN-SVC-3 Travel **PASS** (run 38165200086). These exact-SHA app-focused results are inherited as Level 2 evidence rather than rerunning the same tests ceremonially. This is **repository-side integration**, not production/issuer acceptance.

### Explicit external/live-testnet deferrals
`T-BNB-REPUTATION-211` in `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md` retains actual independent moderator and Reputation issuer/operator approval, managed signing keys and revocations, official upstream 420Reputation deployment, authenticated real downstream ingestion and score propagation, producer/consumer receipt witnessing, real multi-instance service operation, manual accessibility/incident acceptance and independent operator/security signoff. None is represented as currently accepted. Service-to-service operations remain fail-closed when independent proofs are absent.

### Phase and next-step boundaries
**BNB-2.11 repository-side step: COMPLETE (Level 1 + milestone Level 2 qualified).** PR #600 is not merged. **Level 3 is DEFERRED** to the *full BnB app audit phase closeout*: reconcile against then-current main, qualify one exact accumulated merge candidate, and use canonical Solidity and Genesis owners without duplicate Foundry inventory. The next roadmap step must be taken from the canonical source; this evidence does not invent or renumber it.
