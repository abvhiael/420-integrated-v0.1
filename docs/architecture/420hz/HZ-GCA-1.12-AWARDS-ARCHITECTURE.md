# HZ-GCA-1.12 — Awards architecture

Status: **IMPLEMENTED — Level 1 Awards architecture definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-awards-architecture-v1.json`

This step freezes the 420Hz Awards product-domain architecture while preserving separation from Civic governance, Creative rights, Identity, Community, Charts, Search, Notifications and prize settlement.

## Awards domain authority

420Hz Awards owns only the Awards product-domain objects:

- `AwardProgram`
- `AwardSeason`
- `AwardCategory`
- `EligibilityPolicy`
- `AwardNomination`
- `AwardBallot`
- `AwardVote`
- `AwardResult`
- `AwardBadge`

They are canonical only inside the 420Hz Awards product domain.

They are not:

- Civic/Governance proposals, ballots or votes;
- Creative ownership/right records;
- Identity credentials;
- Chart snapshots;
- Community favorites/follows;
- payment/prize records.

## Object graph

The frozen logical graph is:

`AwardProgram → AwardSeason → AwardCategory + EligibilityPolicy → AwardNomination → frozen AwardBallot → qualified AwardVote → immutable AwardResult → permanent AwardBadge`

External systems remain reference-only.

## Program lifecycle

`AwardProgram` states:

- DRAFT
- ACTIVE
- PAUSED
- RETIRED

Program-level metadata/policy may evolve prospectively, but historical seasons keep their own frozen policy/version context.

## Season lifecycle

`AwardSeason` states:

- DRAFT
- SCHEDULED
- NOMINATIONS_OPEN
- NOMINATIONS_CLOSED
- BALLOT_FROZEN
- VOTING_OPEN
- VOTING_CLOSED
- FINALIZED
- ARCHIVED
- CANCELLED

Season identity, date windows and policy commitment are frozen before nominations open.

A finalized season cannot move back to an earlier lifecycle state.

A cancelled season cannot produce a valid AwardResult.

## Category lifecycle

`AwardCategory` states:

- DRAFT
- ACTIVE
- CLOSED
- RETIRED

Category meaning is frozen for the season once active.

Categories are not Creative RecordingClass, Search categories, Chart families or AI disclosure classes.

## Initial category framework

The architecture supports a configurable, versioned category framework.

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

This is **not** a permanent hard-coded global list.

Future seasons may add, remove or rename categories through new versioned definitions without rewriting previous season history.

V1 target types are:

- RECORDING
- CREATOR_PROFILE

## EligibilityPolicy

`EligibilityPolicy` is a versioned rules commitment referenced by season/category.

It may reference:

- Creative publication/status;
- AI disclosure;
- date windows;
- optional Identity eligibility assertions;
- frozen ChartSnapshot references.

It does not duplicate those authorities.

The exact eligibility, self-nomination, thresholds, voter eligibility, anti-Sybil, quorum, tie and finalization rules are deliberately deferred to **HZ-GCA-1.13**.

## Nomination architecture

An `AwardNomination` binds:

- seasonId;
- categoryId;
- targetType;
- targetId;
- nominatorRef;
- submittedAt;
- eligibilitySnapshotCommitment.

The target identity is immutable.

Native Creative CreatorId/RecordingId identity is preserved.

Nomination states:

- SUBMITTED
- ACCEPTED
- REJECTED
- WITHDRAWN
- DISQUALIFIED

Duplicate caps/thresholds remain HZ-GCA-1.13 policy.

## Ballot architecture

An `AwardBallot` freezes one candidate set and policy commitment for one category/season.

States:

- DRAFT
- FROZEN
- OPEN
- CLOSED
- FINALIZED
- VOID

After FROZEN, candidate membership cannot be silently changed.

Any correction requires an explicit void/replacement path under later policy.

An AwardBallot is not a Civic ballot.

## Vote architecture

An `AwardVote` is a 420Hz Awards product-domain vote record/commitment only.

It binds:

- ballotId;
- voterEligibilityRef;
- choiceCommitment;
- submittedAt;
- replayDomain.

States:

- ACCEPTED
- INVALIDATED

Wallet signature/private-key material is not stored in the AwardVote object.

AwardVote is not:

- a Civic vote;
- a Chart signal;
- a payment instruction;
- a Community favorite.

Exact voter eligibility, anti-Sybil, replay, abstention and invalid-vote rules remain HZ-GCA-1.13.

## Result architecture

`AwardResult` states:

- FINALIZED
- SUPERSEDED_BY_CORRECTION

A result may exist only for a valid closed/finalizable ballot under the frozen policy.

It binds:

- resultId;
- ballotId;
- resultCommitment;
- winnerTargetIds;
- finalizedAt;
- policyCommitment.

Final Awards result history is immutable.

Corrections create explicit superseding history rather than mutating previous result bytes in place.

## Badge architecture

`AwardBadge` states:

- ISSUED
- DISPLAY_SUPERSEDED

A badge references exactly one finalized result and exact target/season/category.

A badge is permanent recognition metadata.

It is not automatically:

- a token;
- NFT ownership;
- transferable property;
- Creative rights;
- Identity trust;
- payment entitlement;
- governance privilege.

Display metadata may be superseded while the underlying award/result identity remains unchanged.

## Charts separation

Chart rank/score does not automatically:

- nominate;
- place a candidate on a ballot;
- cast a vote;
- determine a winner.

If a later EligibilityPolicy references Charts, it must bind an immutable ChartSnapshot identity/policy/window.

The Chart itself is not mutated by Awards.

## Community separation

Follow/favorite/playlist/share activity does not automatically:

- nominate;
- satisfy eligibility;
- cast an Award vote;
- determine a result.

COMMUNITY_CHOICE is only a category definition until HZ-GCA-1.13 defines exact nomination/voting semantics.

## Civic/Governance separation

Awards state is categorically separate from 420Governance/Civic.

Civic:

- proposals;
- electorates;
- ballots;
- votes;
- execution results

cannot substitute for Awards:

- seasons;
- nominations;
- ballots;
- votes;
- results.

Awards votes do not execute protocol actions.

## Prize separation

Award legitimacy is independent of any prize.

A valid award may have **zero prize**.

Prize funding/settlement belongs to later HZ-GCA-13 and external Treasury/Grants/Pay/Vault authority.

A failed, withheld or replayed payment cannot change a finalized AwardResult.

## Permanent history

Awards IDs are never recycled.

Finalized seasons/results remain queryable as permanent public history.

Search/Indexer projections may rebuild, but they cannot rewrite Awards canonical product-domain history.

Rejected/withdrawn/disqualified nomination status remains historical state rather than being silently rewritten.

## Architecture validation

The policy requires:

- each Season to reference one AwardProgram and policy snapshot;
- each Category to belong to one Season;
- each Nomination to bind the exact category/season and canonical target;
- each Ballot to bind one frozen candidate/policy commitment;
- each Vote to reference one Ballot and replay domain;
- each Result to reference one valid finalized ballot;
- each Badge to reference one matching finalized result.

External projection/services cannot authoritatively mutate Awards state.

## Failure cases

Architecture fails closed for:

- invalid/unordered season windows;
- material season/category/policy mutation after freeze/open;
- nomination retargeting after submission;
- ballot candidate mutation after FROZEN;
- AwardVote containing wallet private/signature material;
- result creation before valid ballot closure/finalization;
- badge issuance without a matching finalized result;
- Civic objects substituted for Awards state;
- Chart/Community popularity directly creating nominations/votes/results;
- prize payment state changing AwardResult legitimacy.

## Invariants

The machine-readable policy freezes **HZGCA-AWARD-001 through HZGCA-AWARD-018**.

Core guarantees:

- Awards stays product-domain only;
- IDs remain stable and non-recycled;
- season policy/windows freeze before participation;
- category definitions are versioned per season;
- external authorities are referenced, not duplicated;
- ballot candidate/policy sets freeze;
- AwardVote is non-Civic and stores no wallet secrets;
- results are immutable history;
- badges derive from finalized results;
- zero-prize awards remain valid;
- Search/Indexer/Notifications are non-authoritative;
- Awards creates no new Creative, Identity, payment, Chart or Governance authority.

## HZ-GCA-1.12 exit criteria

HZ-GCA-1.12 is complete when:

- Awards object graph and authority boundaries are explicit;
- lifecycle vocabulary is explicit;
- configurable initial category framework is explicit;
- season/category/policy freeze/versioning is explicit;
- Civic/Creative/Identity/Charts/Community/Search/Notifications/prize separation is explicit;
- result/badge permanence is explicit;
- targeted exact-head verifier passes;
- exact nomination/voting policy remains deferred to HZ-GCA-1.13;
- no ABI, deployed contract, live service or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.13 — Define nomination & voting policy framework**
