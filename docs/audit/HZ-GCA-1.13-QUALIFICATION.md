# HZ-GCA-1.13 — Nomination & voting policy qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.13 — Define nomination & voting policy framework**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `176718ec0cc1e49587a93b95eda8f7e1e642672e`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.13**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.13 freezes the Awards nomination/voting policy framework required by HZ-GCA-1.12 architecture and the later HZ-GCA-11 implementation phase.

Coverage includes:

- eligibility windows;
- published-target requirements;
- AI disclosure/category compatibility;
- nomination caps/deduplication;
- configurable self-nomination;
- optional community thresholds;
- ballot construction/freeze;
- Wallet/Identity/jury voter eligibility modes;
- minimum-disclosure anti-Sybil eligibility;
- vote replay protection;
- abstention/invalid handling;
- quorum/threshold/tie policy;
- deterministic finalization;
- no retroactive policy mutation.

## Implementation completed

Added:

- `hz/config/gca-nomination-voting-policy-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.13-NOMINATION-VOTING-POLICY.md`
- `scripts/verify-420hz-gca-1-13.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Eligibility windows / canonical source state

Every category policy must freeze explicit eligibility, nomination and voting windows.

RECORDING categories require a canonical published Recording.

CREATOR_PROFILE categories require a canonical CreatorId plus at least one eligible published Recording in-window unless an exact frozen policy explicitly defines another canonical predicate.

Unavailable/withdrawn/deleted/rights-blocked targets fail closed.

### AI disclosure/category compatibility

Frozen initial compatibility:

- BEST_AI_GENERATED_SONG → AI_GENERATED only
- BEST_AI_ASSISTED_SONG → AI_ASSISTED only
- BEST_REMIX_AI_DERIVATIVE → AI_DERIVATIVE only
- other initial categories accept HUMAN / AI_ASSISTED / AI_GENERATED / AI_DERIVATIVE unless a later versioned category policy narrows them.

Disclosure class alone never grants eligibility.

### Nomination framework

Supported nomination modes:

- OPEN_SUBMISSION
- CURATED_SUBMISSION
- COMMUNITY_THRESHOLD

Every category must explicitly freeze:

- max nominations per nominator;
- self-nomination ALLOWED/DISALLOWED;
- nomination mode;
- target type;
- eligibility policy.

The logical nomination key includes season/category/target/nominator eligibility key.

The ballot candidate key excludes nominator identity, so multiple eligible nominations for one target cannot create duplicate ballot candidates.

### Community thresholds

COMMUNITY_THRESHOLD requires explicit threshold type/value.

Only eligible PUBLIC Community state may contribute.

PRIVATE/UNLISTED relations and replayed duplicate relations are excluded.

Meeting a threshold may create nomination eligibility but never an AwardVote.

### Ballot freeze

Ballot construction starts after nominations close.

The ballot freezes:

- deterministic deduplicated eligible candidates;
- candidateSetCommitment;
- policyCommitment;
- voter-eligibility mode;
- quorum;
- winner rule;
- tie rule.

After FROZEN, ordinary candidate mutation is invalid.

### Voter eligibility / anti-Sybil

Supported modes:

- WALLET_ONE_ACCOUNT_ONE_VOTE
- IDENTITY_UNIQUE_ONE_VOTE
- JURY_ONE_MEMBER_ONE_VOTE

Wallet authorization proves account control only and must never be represented as one-person-one-vote.

Production public voting that claims unique-human semantics requires qualified minimum-disclosure Identity eligibility (or a later equally explicit qualified policy).

Identity-unique voting:

- consumes only ballot/policy/audience-scoped eligibility;
- uses a ballot-scoped nullifier/replay key or equivalent;
- excludes raw identity/documents/biometrics/private proof payloads from Awards state;
- fails closed on stale/revoked/wrong-ballot/wrong-policy/wrong-audience evidence.

### Vote replay

Each accepted vote binds exact ballot, eligibility reference/key, choice commitment, timestamp and replay domain.

One ballot-scoped voter key creates at most one ACCEPTED vote.

Duplicate requests are rejected or idempotently resolve to the existing vote.

V1 does not support silently changing an accepted vote.

### Abstention / invalid votes

ABSTAIN is optional.

Where enabled, accepted abstention may count for participation quorum but contributes zero candidate support.

INVALIDATED votes count neither toward quorum nor candidate support.

Candidate votes, abstentions and invalid/rejected counts remain separate.

### Quorum / threshold / ties

Supported quorum:

- MIN_VALID_VOTES
- MIN_PARTICIPATION_BPS

Supported winner modes:

- PLURALITY
- MIN_SHARE_BPS

Supported ties:

- CO_WINNERS
- NO_WINNER
- RUNOFF_REQUIRED

Each active category must freeze the applicable mode/threshold before voting.

MIN_PARTICIPATION_BPS fails closed if a frozen eligible-voter denominator cannot be established.

V1 has no hidden/random tie breaker.

### Deterministic finalization

Finalization requires a CLOSED ballot after votingEnd.

The same frozen policy + ballot + accepted vote set yields the same tally/result commitment and winner/no-winner disposition.

Finalization is single-use.

Repeated finalization cannot create another AwardResult.

Closed/finalized history cannot be recomputed under later policy; correction/dispute must use explicit superseding history.

## Voting-policy invariants

The manifest freezes **HZGCA-VOTE-001 through HZGCA-VOTE-018**.

The targeted verifier checks:

- exact policy-mode vocabulary;
- canonical published-target requirements;
- AI category compatibility;
- nomination caps/self-nomination/dedupe;
- community threshold privacy/replay boundaries;
- ballot freeze;
- Wallet vs unique-human semantics;
- Identity minimum-disclosure/fail-closed rules;
- anti-Sybil nullifier semantics;
- vote replay/idempotency;
- abstention/invalid accounting;
- quorum/threshold/tie rules;
- deterministic single-use finalization;
- no retroactive recomputation;
- prerequisite Awards/Charts/Community/disclosure consistency;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37737039546**
- Run number: **#152**
- Job: **HZ-GCA Level 1**
- Job ID: **113178835820**
- Exact tested SHA: `176718ec0cc1e49587a93b95eda8f7e1e642672e`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. retained HZ-GCA-1.7 verifier;
10. retained HZ-GCA-1.8 verifier;
11. retained HZ-GCA-1.9 verifier;
12. retained HZ-GCA-1.10 verifier;
13. retained HZ-GCA-1.11 verifier;
14. retained HZ-GCA-1.12 verifier;
15. HZ-GCA-1.13 nomination/voting verifier.

The concurrently triggered **420Hz Web Qualification #100** also passed on the same implementation SHA. It is collateral evidence, not a substitute for GCA Level 1.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `df9745f18a4bf103dc111fb0ee6ae89ed5321106`
- Run ID: **37736980341**
- Job ID: **113178648764**
- Failure: `voting privacy rule missing: cross-ballot correlation`

Diagnosis: **test-harness wording defect**.

The normative policy already required:

`ballot-scoped nullifiers/eligibility references must not be reusable across unrelated ballots to correlate voters unnecessarily`

The verifier searched for a shorter phrase not present verbatim.

Repair:

- changed only the verifier string match;
- removed no privacy check;
- changed no voter mode;
- weakened no anti-Sybil rule;
- changed no eligibility, quorum, threshold, tie or replay semantics.

The repaired exact SHA then passed.

## Security / adversarial result

Result: **PASS**

The verifier rejects policy frameworks that:

- claim unique-human voting from Wallet addresses alone;
- accept stale/revoked/wrong-domain Identity eligibility;
- allow duplicate votes or duplicate ballot candidates;
- use private/unlisted community state for public nomination thresholds;
- omit explicit quorum/winner/tie semantics;
- silently/randomly break ties;
- expose raw Identity proof material;
- allow operator tally mutation;
- finalize before voting closes;
- create duplicate results;
- retroactively recompute closed seasons under new policy.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.13 is an ordinary architecture/policy substep.

The documented HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

The later HZ-GCA M3 Awards integration milestone belongs to implementation HZ-GCA-10 through HZ-GCA-13 and is not triggered by this architecture substep.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app suite;
- affected client/service/Indexer/Search/RPC/frontend/backend suites;
- complete adversarial/invariant/security/static qualification;
- deployment/config verification.

Solidity Contracts remains the sole owner of the canonical full Foundry inventory; Genesis/address-authority must remain separate without duplicating that inventory.

## Limitations

HZ-GCA-1.13 intentionally does not implement:

- live nomination/voting API/store;
- production Identity eligibility verifier;
- concrete selective-disclosure/ZK proof scheme;
- production anti-Sybil provider;
- ballot/tally runtime;
- moderation/dispute correction execution;
- prize settlement;
- testnet/production deployment.

Those belong to later canonical work.

## Blockers

None for HZ-GCA-1.13.

## Completion state

**HZ-GCA-1.13 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.14 — Define moderation & dispute boundaries**
