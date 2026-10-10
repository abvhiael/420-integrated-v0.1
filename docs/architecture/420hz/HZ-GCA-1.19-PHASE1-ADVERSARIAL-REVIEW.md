# HZ-GCA-1.19 — Phase-1 adversarial review

Status: **IMPLEMENTED — Level 1 adversarial architecture review**

Canonical parent: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable review:

`hz/config/gca-phase1-adversarial-review-v1.json`

HZ-GCA-1.19 performs the final ordinary architecture-level negative review across HZ-GCA-1.1 through HZ-GCA-1.18.

This is not the HZ-GCA-1.20 Level-2 milestone and does not replace later runtime/testnet adversarial testing.

## Review result

**PASS**

Open findings:

- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- Architecture contradictions: 0
- Unresolved authority duplication: 0

## Review method

The review actively attempted to violate the frozen architecture by:

- substituting lower-authority/derived state for canonical source state;
- widening PRIVATE/UNLISTED visibility during dependency failure;
- replaying or changing payloads under existing idempotency domains;
- substituting upload possession/training permission/provider metadata for rights/consent;
- conflating quote/funding/earned/paid/refund states;
- resurrecting tombstoned storage or replacing bytes under a fixed identity;
- converting Community popularity/raw plays/Award votes across authority domains;
- mutating frozen Award ballots/results or weakening voter eligibility;
- escalating moderation or Arbitration into external protocol authority;
- restoring stale projections before owning source state during recovery.

## Adversarial matrix

The machine-readable review freezes **HZGCA-ADV-001 through HZGCA-ADV-040**.

### Authority and confused-deputy cases

The review confirms that:

- Wallet connection alone cannot authorize mutations;
- Identity cannot substitute for Wallet authority;
- Search/Indexer/Analytics/Notifications cannot authorize protected writes;
- Chart rank, Community relations and Search results cannot directly create Award outcomes;
- consolidation cannot introduce a second canonical authority.

### AI/provider attacks

Rejected cases include:

- provider/model prose claiming canonical success;
- provider/job/model/result substitution;
- provider failover silently changing accepted economic/privacy/verification terms;
- provider/result state bypassing canonical verification.

### Rights/consent attacks

Rejected cases include:

- treating private reference-audio possession as permission;
- treating training permission as transformation permission;
- synthetic voice/persona publication without explicit consent evidence;
- moderation/UI/provider metadata rewriting canonical Rights.

### Privacy/evidence attacks

Rejected cases include:

- private prompt/draft/reference-audio leakage through public derived surfaces;
- evidence commitment treated as disclosure permission;
- dependency failure widening PRIVATE/UNLISTED state.

### Storage/recovery attacks

Rejected cases include:

- resurrection from stale cache/backup/index rebuild;
- hash-mismatched replacement bytes;
- restart restoring lower-authority projections before canonical sources;
- partial output becoming verified/published/settled merely after restart.

### Economics/replay attacks

Rejected cases include:

- timeout causing a second paid attempt;
- local state fabricating PAID/REFUNDED;
- hidden 420Hz surcharge;
- changed payload under existing idempotency key;
- duplicate event redelivery repeating source effects.

### Community/Charts attacks

Rejected cases include:

- private favorites/unlisted playlists entering public discovery/Charts;
- RAW_PLAY becoming QUALIFIED_PLAY;
- hidden/manual/sponsored Chart boosts;
- AwardVote reused as Chart credit.

### Awards attacks

Rejected cases include:

- Wallet-only mode described as one-person-one-vote;
- multi-wallet duplicate voting under qualified unique-human mode;
- candidate mutation after ballot freeze;
- target-ID ordering secretly resolving substantive ties;
- finalized results recomputed under later policy.

### Moderation/Arbitration attacks

Rejected cases include:

- report automatically becoming enforcement/finding;
- moderator rewriting Rights/Identity/Wallet/payment;
- vote-abuse reviewer hand-editing totals/winners;
- ordinary report auto-opening Arbitration;
- Arbitration ruling directly moving funds or rewriting Rights/AwardResult bytes.

### Dependency-failure attacks

Rejected cases include:

- Identity outage silently downgrading unique-human voting;
- Creative/Rights outage publishing from cached rights state;
- Notifications outage rolling back source operations.

## Current-main shared dependency review

During HZ-GCA-1.19, current `main` had advanced to:

`dbe29983986fefb77a4e78ff96a3689c8589f956`

with CMP-7 SDK/API/CLI/Indexer work.

The review inspected the new Compute developer-facing surfaces, including:

- `docs/compute-market/CMP-7.2-JOB-SUBMISSION-API.md`
- `docs/developers/compute-market-integration.md`
- `services/compute-api/src/job-api.ts`
- `420-indexer/src/compute-read-model.ts`

No HZ-GCA authority contradiction was identified.

The merged CMP-7 API:

- prepares unsigned Wallet-authorized intents;
- rejects secret-bearing request material;
- marks read projections `authoritative:false`;
- retains chain/finality context;
- does not become signing, custody, funding, matching, verification or settlement authority.

Because HZ-GCA-1.19 is an ordinary architecture-review step, this shared-dependency inspection does not justify ceremonial branch reconciliation. The documented HZ-GCA-1.20 milestone and later Level-3 closeout retain their reconciliation responsibilities.

## Accepted residual risk

The review does not falsely claim runtime protection against every future implementation attack.

Accepted/deferred risks include:

- probabilistic AI output quality/safety;
- Wallet-one-account-one-vote not proving one unique human;
- social collusion;
- off-chain evidence unavailability;
- live media scanner/anti-bot/rate-limit/provider-isolation behavior;
- unresolved external legal/personality-right disputes.

## Deferred runtime adversarial evidence

Still deferred:

- AI worker sandbox/tool/network abuse tests;
- media scanner/codec/CSP/egress attacks;
- persistent idempotency-store crash/replay tests;
- live settlement/refund failure injection;
- storage restore/tombstone fault injection;
- qualified-play bot/replay simulation;
- production unique-human/nullifier abuse testing;
- live moderation privilege/appeal testing;
- live Arbitration remedy-consumer testing;
- public-testnet restart/reorg/stale-index testing.

## Completion boundary

HZ-GCA-1.19 is complete only when:

- all 40 architecture adversarial cases pass;
- Critical/High open findings are zero;
- architecture contradictions are zero;
- unresolved authority duplication is zero;
- runtime-deferred attacks remain clearly separated from architecture qualification;
- the exact-head targeted verifier passes.

Next canonical work package:

**HZ-GCA-1.20 — HZ-GCA-1 Level-2 milestone qualification**
