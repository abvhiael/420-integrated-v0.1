# RR-6 — Ecosystem Integrations

## Canonical definition

**RR-6 — Ecosystem Integrations**

> Live 420 Search, 420 Notifications and 420Mail adapters plus reconciliation/failure handling.

RR-6 completes the repository-side consuming application boundaries for these three shared services. It does not promote repository fixtures into production-equivalent live evidence. Real endpoints, credentials, provider operation, Registry/deployment identity and testnet outage/recovery remain under the existing REEFER-AUDIT-7+ live gates.

Because three shared service boundaries converge and durable cross-component recovery is introduced, RR-6 is a meaningful app integration milestone: targeted Level 1 plus retained ReeferReview Level 2 are required. Level 3 remains RR-10.

## Requirements

### RR-6.A — 420Search adapter

Emit the canonical `search/result` contract for ReeferReview articles without creating Search authority.

Required:
- only `PUBLISHED + PUBLIC` articles are eligible;
- a current retained 420Rights provenance record must match the publication body digest;
- the stable source-key namespace is ReeferReview-owned;
- the result category identifies a ReeferReview article;
- the canonical URL is deployment-supplied and HTTP(S);
- article body/private Storage locator/session credentials are not projected;
- ranking and sponsorship remain non-canonical.

### RR-6.B — Search reconciliation

Provide deterministic reconciliation from canonical ReeferReview publication metadata:
- upsert every currently eligible article;
- remove stale ReeferReview-owned article projections;
- never delete another application's Search result;
- Search outage or projection corruption cannot mutate Publication, Rights or Storage state.

### RR-6.C — 420Notifications adapter

Target canonical service `420/service/notifications/v1` through a deployment-supplied qualified authority boundary.

Requests must:
- originate from `420/service/reefer-review/v1`;
- use deterministic event and idempotency identity;
- include only public presentation and provenance fields;
- preserve publication ID/revision, Rights claim, chain/block evidence and canonical article URL;
- exclude body bytes, body/storage references, sessions, tokens and wallet secrets.

Consent suppression is a valid non-delivery result. Accepted delivery requires a non-empty delivery ID and timestamp. Contradictory or incomplete receipts fail closed.

### RR-6.D — 420Mail adapter

Use the canonical Mail transport contract for internal mail:
- authenticated deployment-supplied ReeferReview sender identity;
- opt-in internal recipient resolver;
- canonical `420/service/mail/v1` source value;
- recipient-bound deterministic idempotency;
- bounded article title/summary/link content only;
- no external SMTP enablement;
- no paid external newsletter enablement;
- no attempt to spoof ReeferReview as canonical Mail source authority.

### RR-6.E — Durable integration outbox

Failed Search, Notifications and Mail side effects must survive restart.

The outbox must be:
- schema-versioned;
- owner-only on disk;
- OS-file locked;
- written through temporary file + fsync + atomic rename + directory fsync;
- deterministic/idempotent per integration operation;
- non-authoritative.

### RR-6.F — Reconciliation and failure isolation

Enqueue recovery intent before calling the derived dependency.

On dependency failure:
- retain pending work and bounded error evidence;
- return a warning/error only from the side-effect hook;
- never roll back an already-authorized publication;
- never widen visibility or synthesize successful delivery;
- retry through explicit reconciliation;
- complete/remove work only after the delegated dependency succeeds.

A Search delete failure during HIDE/TOMBSTONE must remain recoverable even when canonical moderation intentionally ignores derived Search outage.

### RR-6.G — Authority/privacy invariants

Search, Notifications and Mail may not:
- create or approve publications;
- change visibility;
- create Rights claims;
- mutate 420Storage content;
- grant Wallet capabilities;
- sign or spend;
- become the canonical record of publication state;
- expose restricted article content through public Search or notification payloads.

### RR-6.H — Honest live boundary

Repository completion must not invent live endpoint URLs, Registry records, deployment credentials, provider IDs, notification subscription state, Mail sender credentials or public-testnet receipts.

The repository adapter contract may be complete while TESTNET, GENESIS and PRODUCTION readiness remain false.

## Exit criteria

RR-6 is COMPLETE only when RR-6.A through RR-6.H are implemented and individually verified, exact-head RR-6 Level 1 passes, the required ecosystem-integration Level 2 suite passes on the same implementation SHA, durable qualification evidence is committed, Level 3 remains deferred to RR-10, and live/testnet readiness is not overstated.

## Next canonical roadmap step

**RR-7 — Newsfeed Security**
