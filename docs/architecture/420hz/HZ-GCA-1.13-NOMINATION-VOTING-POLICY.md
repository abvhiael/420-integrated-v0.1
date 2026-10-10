# HZ-GCA-1.13 — Nomination & voting policy framework

Status: **IMPLEMENTED — Level 1 nomination/voting policy definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-nomination-voting-policy-v1.json`

This step freezes the policy framework for nomination, ballot construction, voter eligibility, anti-Sybil protection, replay resistance, quorum/threshold/tie semantics and deterministic Awards finalization.

## Scope

HZ-GCA-1.13 defines policy semantics only.

It does not deploy a voting service, Identity verifier, ballot contract, anti-Sybil provider or testnet integration.

## Eligibility windows

Every active category must bind explicit:

- eligibilityStart / eligibilityEnd;
- nominationStart / nominationEnd;
- votingStart / votingEnd;
- target type;
- EligibilityPolicy version/commitment.

A nomination outside the frozen nomination window fails closed.

Voting outside the frozen voting window fails closed.

Once participation begins, material rule changes require a replacement category/season/policy rather than silent reinterpretation.

## Canonical published-target requirement

For RECORDING categories:

- target must be a canonical published Recording;
- publication/source state must remain eligible under the frozen category policy;
- withdrawn, unavailable, deleted or rights-blocked Recordings fail closed.

For CREATOR_PROFILE categories:

- target must reference a canonical CreatorId;
- the creator must have at least one eligible published Recording inside the applicable category/season window unless the exact frozen category policy explicitly defines another canonical predicate.

A Creator profile alone does not substitute for required published-work eligibility.

## AI disclosure compatibility

Initial compatibility is frozen as:

- SONG_OF_THE_YEAR — HUMAN / AI_ASSISTED / AI_GENERATED / AI_DERIVATIVE
- ARTIST_OF_THE_YEAR — all four disclosure classes
- BEST_AI_GENERATED_SONG — AI_GENERATED only
- BEST_AI_ASSISTED_SONG — AI_ASSISTED only
- BEST_REMIX_AI_DERIVATIVE — AI_DERIVATIVE only
- BEST_INSTRUMENTAL — all four
- BEST_LYRICS — all four
- BEST_PRODUCTION — all four
- COMMUNITY_CHOICE — all four
- BREAKTHROUGH_ARTIST — all four

Disclosure class alone does not grant eligibility.

## Nomination modes

Supported modes:

- OPEN_SUBMISSION
- CURATED_SUBMISSION
- COMMUNITY_THRESHOLD

Every category must explicitly declare:

- nomination mode;
- max nominations per nominator;
- self-nomination mode;
- target type;
- eligibility policy.

No category silently defaults to unlimited nominations.

## Self-nomination

Self-nomination is explicitly:

- ALLOWED; or
- DISALLOWED.

The frozen category policy decides.

No application default may override the category policy.

## Duplicate prevention

The logical nomination key is:

`seasonId + categoryId + targetType + targetId + nominatorEligibilityKey`

Replay of the same nomination is idempotent or rejected.

The logical ballot-candidate key is:

`seasonId + categoryId + targetType + targetId`

Thus multiple eligible nominators can support the same candidate without producing duplicate ballot entries.

## Community-threshold nominations

COMMUNITY_THRESHOLD mode requires explicit:

- thresholdType;
- thresholdValue.

Only policy-approved PUBLIC community state may contribute.

PRIVATE and UNLISTED relations are excluded.

Replay/duplicate community relations cannot inflate support.

Threshold satisfaction may make a target nomination-eligible, but never casts an AwardVote.

COMMUNITY_CHOICE does not hard-code a threshold in this architecture step.

## Ballot construction and freeze

Ballot construction occurs after nominations close.

The candidate set is:

- deterministic;
- deduplicated;
- limited to ACCEPTED nominations that remain eligible.

Before FROZEN, the ballot binds:

- candidateSetCommitment;
- policyCommitment;
- voter-eligibility mode;
- quorum policy;
- winner policy;
- tie policy.

After FROZEN, candidate membership cannot silently change.

A correction requires explicit VOID/replacement handling under frozen policy.

## Voter eligibility modes

Supported modes:

- WALLET_ONE_ACCOUNT_ONE_VOTE
- IDENTITY_UNIQUE_ONE_VOTE
- JURY_ONE_MEMBER_ONE_VOTE

### Wallet mode

Wallet/session authorization proves account control only.

It does **not** prove one unique human.

Therefore WALLET_ONE_ACCOUNT_ONE_VOTE must never be described as one-person-one-vote.

### Identity-unique mode

IDENTITY_UNIQUE_ONE_VOTE requires a qualified minimum-disclosure eligibility result from canonical Identity authority or another explicitly approved verifier source.

The result must be domain-separated to the exact:

- Awards audience;
- ballot;
- policy;
- eligibility predicate;
- nonce/replay domain where applicable.

Raw legal identity, documents, biometric material, credential payloads, wallet linkage and private proof bytes remain outside the Awards domain.

Expired, revoked, stale, wrong-ballot, wrong-policy or wrong-audience eligibility fails closed.

If qualified unique-human eligibility is unavailable, voting cannot proceed under IDENTITY_UNIQUE_ONE_VOTE.

### Jury mode

JURY_ONE_MEMBER_ONE_VOTE requires a frozen jury membership snapshot/reference.

One eligible jury member key contributes at most one accepted vote.

## Production unique-human claim

A public production ballot may claim unique-human semantics only when the category uses IDENTITY_UNIQUE_ONE_VOTE or a later equally explicit qualified policy.

Wallet addresses alone are insufficient.

## Anti-Sybil policy

Every ballot policy must state its Sybil assumptions.

Rules:

- one ballot-scoped voter key/nullifier contributes at most once;
- multiple wallets resolving to the same qualified unique-human nullifier cannot multiply votes;
- wallet-only mode is account uniqueness only;
- raw Identity evidence remains outside Awards;
- rate limits/anomaly systems may flag or pause suspicious behavior but cannot fabricate credentials or silently rewrite valid votes.

## Vote replay protection

Every accepted vote binds:

- ballotId;
- voterEligibilityRef/key;
- choiceCommitment;
- submittedAt;
- replayDomain.

One voter key may have at most one ACCEPTED vote per ballot.

Duplicate/replayed requests are rejected or resolve idempotently to the existing vote.

V1 does not support changing an accepted vote.

## Abstention and invalid votes

ABSTAIN is optional per category policy.

An accepted abstention:

- counts toward participation quorum where the selected quorum policy defines participation that way;
- contributes zero support to any candidate.

INVALIDATED votes count neither toward quorum nor candidate support.

Candidate votes, abstentions and invalid/rejected counts remain separately reportable.

## Quorum

Supported modes:

- MIN_VALID_VOTES
- MIN_PARTICIPATION_BPS

Every category must freeze one mode and an explicit positive threshold before voting opens.

MIN_PARTICIPATION_BPS requires a frozen eligible-voter denominator/reference.

If that denominator cannot be established, voting/finalization fails closed.

## Winner policy

Supported winner modes:

- PLURALITY
- MIN_SHARE_BPS

PLURALITY selects the highest valid candidate total after quorum.

MIN_SHARE_BPS additionally requires the frozen minimum share threshold.

Threshold arithmetic is implementation-defined later but must be exact, integer-safe and frozen before voting.

## Tie policy

Supported modes:

- CO_WINNERS
- NO_WINNER
- RUNOFF_REQUIRED

CO_WINNERS returns all tied winners.

NO_WINNER finalizes with no winner and creates no AwardBadge.

RUNOFF_REQUIRED produces no winner from the tied ballot and requires a deterministic replacement/runoff ballot limited to tied candidates.

V1 does not permit hidden or ad hoc random tie-breaking.

Canonical target-ID ordering may normalize display only; it does not secretly select a winner.

## Deterministic finalization

Finalization may occur only after voting ends and from a valid CLOSED ballot.

The finalizer recomputes from frozen state:

- accepted vote set;
- voter eligibility mode;
- quorum;
- threshold;
- tie policy;
- winner set/no-winner disposition.

The same ballot, policy and accepted-vote set must produce the same result commitment and winner disposition.

Finalization is single-use.

Repeated finalization returns the existing result or fails without producing another AwardResult.

## No retroactive policy mutation

A finalized result is not recomputed under a newer policy.

Corrections/disputes must create explicit superseding history under the later moderation/dispute framework.

Closed/finalized seasons are not silently reopened.

## Privacy

Awards public state must not expose:

- wallet private keys;
- signatures beyond bounded public verification artifacts if later needed;
- raw Identity proofs;
- legal identity;
- biometric/document data;
- unnecessary voter-linkage data.

Ballot-scoped nullifiers/references should avoid cross-ballot correlation.

Search/Indexer/Analytics public projections must not receive private proof material.

## Separation from Charts / Community / Civic / prizes

Chart rank does not cast votes.

Community popularity does not cast votes.

Prize funding does not determine vote validity.

Civic/Governance votes are unrelated to AwardVote.

An AwardVote creates no Creative rights, Identity trust, payment entitlement or governance authority.

## Failure cases

The policy fails closed for:

- nomination outside the frozen window;
- unpublished/ineligible target;
- AI-disclosure mismatch;
- prohibited self-nomination;
- nomination-cap overflow;
- duplicate nomination inflating ballot candidates;
- private/unlisted community support used for threshold;
- incomplete ballot policy at voting open;
- Wallet-only policy claiming one-person-one-vote;
- unique-human mode without qualified current eligibility;
- duplicate/replayed accepted vote;
- non-candidate/wrong-ballot choice;
- missing MIN_PARTICIPATION_BPS denominator;
- operator/manual tally mutation;
- premature/non-CLOSED finalization;
- second result from repeated finalization;
- retroactive recalculation under a later policy.

## Invariants

The machine-readable policy freezes **HZGCA-VOTE-001 through HZGCA-VOTE-018**.

Core guarantees:

- nomination/voting policy is frozen before participation;
- published-target eligibility is canonical;
- AI-category disclosure compatibility is exact;
- nomination replay/caps/self-nomination are explicit;
- community thresholds use eligible PUBLIC state only;
- ballot candidate set/policy freeze;
- Wallet control is not unique-human identity;
- unique-human voting is minimum-disclosure and fail-closed;
- one voter key/nullifier produces at most one accepted vote;
- raw Identity evidence remains outside Awards;
- quorum/threshold/tie semantics are explicit;
- finalization is deterministic and single-use;
- closed history is not retroactively recomputed.

## HZ-GCA-1.13 exit criteria

HZ-GCA-1.13 is complete when:

- eligibility windows and canonical published-target rules are explicit;
- AI disclosure compatibility is explicit;
- nomination caps/dedupe/self-nomination/community-threshold framework is explicit;
- ballot construction/freeze is explicit;
- Wallet/Identity/jury voting modes are explicit and honest about Sybil guarantees;
- minimum-disclosure unique-human proof handling is explicit;
- replay/abstention/invalid/quorum/threshold/tie semantics are explicit;
- deterministic close/finalization/no-retroactive-recompute semantics are explicit;
- targeted exact-head verifier passes;
- no Identity proof scheme, ABI, live voting service, deployment or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.14 — Define moderation & dispute boundaries**
