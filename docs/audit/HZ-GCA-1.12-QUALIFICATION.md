# HZ-GCA-1.12 — Awards architecture qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.12 — Define Awards architecture**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `f3c41f1add4fe4dfa72b90ab27e7c369685ff28f`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.12**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.12 freezes the Awards product-domain architecture required by the roadmap's later HZ-GCA-10 implementation phase:

- Award Program;
- Season;
- Category;
- Eligibility Policy;
- Nomination;
- Ballot;
- Award vote/commitment;
- Result;
- Award Badge/history.

It also freezes the initial category framework without turning that list into permanent global hard-coded categories.

## Implementation completed

Added:

- `hz/config/gca-awards-architecture-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.12-AWARDS-ARCHITECTURE.md`
- `scripts/verify-420hz-gca-1-12.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Awards product-domain authority

Awards owns only:

- AwardProgram
- AwardSeason
- AwardCategory
- EligibilityPolicy
- AwardNomination
- AwardBallot
- AwardVote
- AwardResult
- AwardBadge

These are canonical only inside the 420Hz Awards product domain.

They do not become Civic/Governance, Creative, Identity, Charts, Community, payment or Search authority.

### Object graph

Frozen graph:

`AwardProgram → AwardSeason → AwardCategory + EligibilityPolicy → AwardNomination → frozen AwardBallot → qualified AwardVote → immutable AwardResult → permanent AwardBadge`

### Lifecycle vocabulary

Frozen logical states cover:

- Program: DRAFT / ACTIVE / PAUSED / RETIRED
- Season: DRAFT / SCHEDULED / NOMINATIONS_OPEN / NOMINATIONS_CLOSED / BALLOT_FROZEN / VOTING_OPEN / VOTING_CLOSED / FINALIZED / ARCHIVED / CANCELLED
- Category: DRAFT / ACTIVE / CLOSED / RETIRED
- Nomination: SUBMITTED / ACCEPTED / REJECTED / WITHDRAWN / DISQUALIFIED
- Ballot: DRAFT / FROZEN / OPEN / CLOSED / FINALIZED / VOID
- Vote: ACCEPTED / INVALIDATED
- Result: FINALIZED / SUPERSEDED_BY_CORRECTION
- Badge: ISSUED / DISPLAY_SUPERSEDED

### Category framework

Initial category keys:

- SONG_OF_THE_YEAR
- ARTIST_OF_THE_YEAR
- BEST_AI_GENERATED_SONG
- BEST_AI_ASSISTED_SONG
- BEST_REMIX_AI_DERIVATIVE
- BEST_INSTRUMENTAL
- BEST_LYRICS
- BEST_PRODUCTION
- COMMUNITY_CHOICE
- BREAKTHROUGH_ARTIST

The policy explicitly marks the list as configurable/versioned per season and not a permanent hard-coded global list.

### Season / category freeze

- season windows and policy commitment freeze before nominations open;
- material rule changes after opening cannot be silently reinterpreted;
- category meaning freezes for that season once active;
- future seasons use new versioned definitions;
- FINALIZED season cannot return to earlier state;
- CANCELLED season cannot produce a valid result.

### Nomination / ballot / vote architecture

- nomination target identity is immutable and keeps native Creative CreatorId/RecordingId references;
- ballot freezes exact candidate set and policy commitment;
- candidate set cannot silently change after FROZEN;
- AwardVote is product-domain voting only;
- wallet signing/private-key material is excluded;
- AwardVote is not Civic voting, Chart input, payment instruction or Community favorite.

Exact eligibility, nomination caps, self-nomination, thresholds, voter eligibility, anti-Sybil, replay, quorum, ties and finalization math remain correctly deferred to HZ-GCA-1.13.

### Results and badges

- AwardResult requires a valid finalizable ballot;
- finalized result history is immutable;
- corrections create explicit superseding result/history rather than in-place mutation;
- AwardBadge references exactly one finalized result;
- badge is recognition metadata, not automatically a token/NFT or transferable asset.

### Charts / Community / Governance separation

- Chart rank cannot directly nominate, ballot, vote or win;
- Community follows/favorites/playlists/shares cannot directly nominate or vote;
- COMMUNITY_CHOICE remains only a category until HZ-GCA-1.13 defines actual participation policy;
- Civic proposal/ballot/vote state cannot substitute for Awards state.

### Prize separation

Awards legitimacy is independent of financial reward.

Zero-prize awards remain valid.

Prize settlement remains later HZ-GCA-13 / external Treasury-Grants-Pay-Vault work and cannot modify finalized Awards truth.

## Awards invariants

The manifest freezes **HZGCA-AWARD-001 through HZGCA-AWARD-018**.

The targeted verifier checks:

- exact Awards-owned object set;
- external authority separation;
- object graph;
- lifecycle vocabulary;
- season freeze rules;
- initial configurable categories;
- EligibilityPolicy versioning and HZ-GCA-1.13 deferral;
- nomination target immutability;
- ballot candidate freeze;
- vote/Civic/signature-material separation;
- result immutability;
- badge/result relationship;
- Charts/Community separation;
- zero-prize legitimacy;
- architecture validation/failure rules;
- all 18 invariant identifiers;
- HZ-GCA-1.2/1.10/1.11 prerequisite consistency;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37736118218**
- Run number: **#139**
- Job: **HZ-GCA Level 1**
- Job ID: **113175914546**
- Exact tested SHA: `f3c41f1add4fe4dfa72b90ab27e7c369685ff28f`
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
14. HZ-GCA-1.12 Awards architecture verifier.

The concurrently triggered **420Hz Web Qualification #93** also passed on the same implementation SHA. It is collateral evidence rather than a substitute for required GCA Level 1.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `e6a75f3dd21ba5df43b1028828cefe6b3939b150`
- Run ID: **37736063211**
- Job ID: **113175740662**
- Failure: `vote architecture missing: never a Civic vote`

Diagnosis: **test-harness wording defect**.

The normative manifest already said:

`AwardVote does not become a Civic vote, Chart signal, payment instruction or community favorite`

The verifier searched for the different literal phrase `never a Civic vote`.

Repair:

- changed only the verifier string match to the normative phrase;
- changed no Awards state;
- changed no authority boundary;
- changed no category definition;
- removed no validation or security assertion;
- did not weaken Civic separation.

The repaired exact SHA passed.

## Security / adversarial result

Result: **PASS**

The verifier rejects architectures that:

- substitute Civic/Governance state for Awards state;
- mutate category/policy/season semantics after freeze;
- retarget nominations;
- alter frozen ballots;
- place wallet private/signature material in AwardVote;
- create results before valid finalization;
- create badges without matching results;
- let Charts/Community popularity directly create nominations/votes/results;
- couple AwardResult legitimacy to prize payment.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.12 is an ordinary architecture/policy step.

The documented HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

The broader M3 Awards integration milestone in HZ-GCA-17 belongs to later implementation HZ-GCA-10 through HZ-GCA-13, not this architecture substep.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app suite;
- affected clients/services/Indexer/Search/RPC/frontend/backend suites;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

Solidity Contracts remains the sole owner of the canonical full Foundry inventory; Genesis/address-authority must remain separate without duplicating that full test inventory.

## Limitations

HZ-GCA-1.12 intentionally does not yet freeze:

- exact nomination caps;
- self-nomination policy;
- community thresholds;
- voter eligibility;
- anti-Sybil scheme;
- one-person/one-identity policy;
- quorum;
- tie handling;
- detailed deterministic finalization math;
- moderation/dispute mechanics;
- runtime Awards API/storage;
- prize settlement;
- testnet/production deployment.

Those belong to later canonical work.

## Blockers

None for HZ-GCA-1.12.

## Completion state

**HZ-GCA-1.12 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.13 — Define nomination & voting policy framework**
