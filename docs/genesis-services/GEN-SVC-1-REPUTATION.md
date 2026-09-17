# GEN-SVC-1 — 420Reputation

## Purpose

420Reputation is the shared application/service layer for domain-scoped reviews, verified-interaction reputation views and portable trust presentation across Genesis consumer applications.

It is **not** a second reputation protocol. The canonical protocol foundation already exists as 420Trust V1. 420Reputation consumes 420Trust evidence, combines it with off-chain review/application data under explicit versioned policy, and exposes reusable APIs/UI models to consumer applications.

## Authority boundary

420Reputation is replaceable and derived.

- 420Trust owns canonical authenticated evidence signals and per-metric aggregates.
- 420 Identity owns identity/profile/credential authority.
- 420Reputation owns neither.
- star ratings, review text, display confidence and UX summaries are application policy and off-chain data.
- reputation cannot create wallet authority, settlement authority, governance weight, validator weight, credit scoring, political scoring or a universal social score.

## GEN-SVC-1.1 — Identity binding

Reputation subjects use typed subject references and stable subject IDs. Profile-backed subjects bind to 420 Identity references when present, but 420Reputation does not make real-world identity mandatory.

Requirements:

1. support pseudonymous profiles;
2. preserve subject type and subject ID separately;
3. distinguish reviewer profile from reviewed subject;
4. reject direct self-review for reputation-bearing review flows;
5. keep wallet/account authority outside the reputation service.

## GEN-SVC-1.2 — Domain-scoped reputation

Genesis domains are intentionally separate:

- marketplace
- classifieds
- travel
- employer
- freelancer
- creator
- crowdfunding
- community
- education

No API may return a hidden cross-domain universal score. A UI may show multiple domain cards side-by-side only when each card identifies its domain and policy version.

## GEN-SVC-1.3 — Review schema

A review records:

- review ID;
- domain;
- typed subject reference;
- reviewer profile;
- 1–5 integer rating;
- optional title/body/attachments;
- optional dimension ratings;
- verification state;
- optional verified-interaction evidence reference;
- timestamps and version state;
- optional subject/business response.

Review bodies and attachments are off-chain. Optional digests may be anchored, but that does not make subjective content canonical Trust truth.

## GEN-SVC-1.4 — Verified interactions and Trust evidence

Verified review status requires an interaction evidence record appropriate to the domain. Genesis examples include purchase/sale, P2P transaction, completed booking/stay, contribution, reward delivery, course completion and credential issuance.

Objective facts may be recorded through 420Trust only when an exact governed metric exists and the issuer is authorized for that metric.

Subjective star ratings are **not** canonical 420Trust signals at Genesis.

## GEN-SVC-1.5 — Anti-Sybil controls

Genesis controls:

- one review per verified interaction;
- self-review blocked;
- verified and unverified reviews visibly separated;
- rate limits required;
- transaction/booking/contract evidence may establish verified status;
- account age may inform rate limiting but is not protocol truth;
- stake and wallet balance must never weight reputation;
- conflict-of-interest evidence may reduce application display confidence;
- display confidence is versioned application policy, never canonical Trust state.

## GEN-SVC-1.6 — Responses

Subjects/businesses may publish one active response per review, with versioned edits.

Response authority is limited to the reviewed subject or a delegated organization operator. A response cannot change the review, Trust evidence or moderation history.

## GEN-SVC-1.7 — Moderation

Shared moderation actions from GEN-SVC-0 apply. Reputation-specific report reasons include spam, conflict of interest, harassment, fraud, duplicate content, irrelevant content, personal-information exposure and rights violation.

Moderation may change visibility and application eligibility. It may not delete or rewrite canonical 420Trust evidence, transfer assets or revoke 420 Identity authority.

## GEN-SVC-1.8 — Portable views

The portable view returns domain-scoped presentation data:

- policy version;
- verified/unverified review counts;
- rating distribution;
- dimension summaries;
- exact Trust metrics and provenance;
- moderation summary;
- update timestamp.

Trust metrics retain metric/domain/unit/revision/source context. Applications must not flatten them into a hidden universal score.

## GEN-SVC-1.9 — API contract

Genesis API surface:

- `GET /v1/reputation/{domainId}/{subjectType}/{subjectId}`
- `GET /v1/reviews/{domainId}/{subjectType}/{subjectId}`
- `POST /v1/reviews`
- `PATCH /v1/reviews/{reviewId}`
- `POST /v1/reviews/{reviewId}/response`
- `POST /v1/reviews/{reviewId}/report`
- `GET /v1/interactions/{evidenceRef}/verification`
- `GET /v1/policy/{domainId}`

All mutating requests require idempotency semantics. Authority-bearing verification responses preserve provenance.

## GEN-SVC-1.10 — UI component contract

Reusable consumer UI components should expose:

1. rating summary;
2. verified-review count;
3. rating distribution;
4. review card;
5. verified-interaction badge;
6. response card;
7. domain label;
8. Trust evidence details drawer;
9. report/moderation state;
10. policy/version disclosure.

Applications may style these independently, but semantics must remain compatible.

## Genesis integrations

Initial consumers:

- 420Classifieds — seller/buyer verified transaction reviews;
- 420Travel — places, hosts, stays/events and business responses;
- 420Launchpad — creator/project delivery history;
- 420Learn/Knowledge — instructor/course and knowledge reputation views;
- 420Town — community-domain moderation/activity signals where explicitly supported;
- 420Freelance — schema/API groundwork for post-Genesis contract reputation.

## Validation

Run:

```bash
python3 scripts/validate-gen-svc-1.py
```

The validator enforces:

- 420Trust remains the canonical evidence protocol;
- subjective ratings are not canonical Trust signals;
- domains remain separated;
- one-review-per-interaction and self-review protections are enabled;
- stake/balance weighting is disabled;
- review bodies remain off-chain;
- moderation cannot rewrite Trust history;
- portable views expose policy/provenance and forbid universal scores;
- required API endpoints, invariants and consumers exist.

## Exit criteria

GEN-SVC-1 is complete when the Genesis reputation profile validates, documentation captures all GEN-SVC-1.1–1.10 requirements, CI gates the profile, and downstream consumer phases have one stable domain-scoped reputation contract to build against.

## Next phase

After GEN-SVC-1 qualification and monolithic merge, proceed to **GEN-SVC-2 — Location, Maps & 420Events foundation**.
