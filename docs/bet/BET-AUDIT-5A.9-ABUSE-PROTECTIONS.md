# BET 5A.9 — Anti-collusion, anti-cheating and abuse protections

## Protection and trust boundary

The protocol already rejects forged actions, stale seat/session signatures,
cross-hand proof replay, invalid shares, premature card openings, arbitrary
payouts and repeated settlement. Those cryptographic and rules protections
remain mandatory. A valid poker action is not proof of honest intent: coordinated
play, off-chain card sharing, unknown related accounts and automation cannot be
universally detected from public-chain observations.

`PokerAbuseControls420` adds prospective admission controls and bounded,
independently reviewed player restrictions. `nlhe-abuse-monitor.mjs` produces
public-data review candidates, never a verdict or an automatic sanction. Real
investigation, correct role assignment and independent beneficial control of
auditors/reviewers remain governance dependencies. Two authorized addresses do
not cryptographically prove two independent people or organizations.

## Immutable protected tables

Governance configures a policy once and binds its controls to the seat ledger
before any seat or escrow exists. The binding pins the controls runtime hash,
ledger/deal identity and complete immutable policy hash. There is no replace,
disable or reconfigure operation. Binding requires a separate table-scoped
capability; table control, dealing or playing alone grants no such power.

Legacy unbound tables retain their qualified behavior for compatibility. They
are **not protected-table 5A.9 deployments** and must never be represented as
such. The 5A.9 acceptance owner requires a nonzero immutable binding and frozen
admission root for the genuinely proved funded hand. Release governance must
bind the reviewed policy before granting operational deposit/admission rights.

The immutable policy bounds are enforced by code:

| Parameter | Allowed bounds | Purpose |
|---|---|---|
| Review delay | 30 seconds–1 day | Notice before a restriction or lift |
| Restriction duration | 60 seconds–30 days | No permanent subjective ban |
| Reentry/sit-out delay | 30 seconds–1 day each | Deter seat-position hunting |
| Deal request interval | 1–600 seconds | Bound admission request cadence |
| Report quota | 1–9 per reporter per UTC day | Bound review spam |
| Identity validity | At most 30 days | Periodic off-chain verification |
| Self-exclusion | 1–365 days, extensions only | Player-controlled new-play stop |

## Related-account admission and player controls

An independent authorized auditor proposes a table-local control-group
commitment, private investigation evidence commitment and expiry. A different
currently authorized auditor confirms the exact chain/deployment/nonce-bound
proposal digest. Neither may be the player, a seated player, the table controller
or either shuffle provider. A pending change does not invalidate a confirmed
claim; replacing a pending proposal invalidates its old approval digest.

New deposits require a live confirmed identity and reject a known related player
already seated, including sitting-out seats. New deals and reservations recheck
the complete 2–9-seat participant set, identity expiry, live auditor authority,
related groups, player avoidance, self-exclusions, active restrictions and
cooldowns. Identity changes cannot bypass the participant check after seating.
The controls prevent admission of *known, attested* related accounts; they do
not pretend to discover every Sybil or verify identity without real evidence.

Players may exclude themselves without needing permission to gamble and may
avoid sharing future hands with another player. Avoidance is symmetric for an
admitted pair; an outsider cannot veto two other players. Expected protection
nonces prevent stale reports/avoidance/exclusion writes from overwriting newer
intent. Self-exclusion cannot be shortened. Leave and effective sit-out times
are recorded by the ledger itself, so a relayer cannot forge a cooldown start.
The existing canonical blind/button rules remain unchanged; no new penalty or
blind amount is selected by a coordinator.

Protected tables allow only a bounded pending deal request. A consumed, expired
or deadline-exhausted request can be replaced, but an obsolete unfunded request
cannot later reserve chips. Every reservation freezes the accepted participants,
their seat/identity revisions and policy into a hand-specific admission root.
The native starting state commits that root. Later restrictions, role changes,
exclusions or identity revisions cannot rewrite the accepted hand.

## Reports, review, appeals and correction

A report must name a real protected reserved hand and its frozen participants,
arrive within seven days of admission, include a nonzero evidence commitment and
consume the reporter's nonce/quota. A reporter cannot accuse themselves or
report repeatedly against the same target/hand by changing category. An old
seat's replacement does not inherit reporting authority. Reports do not freeze
turns or payment and are not proof of misconduct.

A reviewer with the separate table-scoped review capability proposes a bounded
restriction or dismissal and reason commitment. A second independent reviewer
approves the exact evidence-bound proposal. Reporters, targets, seated players,
controllers and providers cannot review their own table's cases. Both roles are
rechecked at activation. A single reviewer cannot impose or lift a restriction.
The target can appeal once before execution, adding evidence and exactly one
review-delay extension. A reviewing party may withdraw its proposal with a
recorded reason. Unexecuted proposals expire after at most two review delays
plus one day, preventing activation of arbitrarily old approvals.

Restrictions affect future funding and admission only. There is at most one
active restriction per player; overlapping cases cannot silently replace or
extend it. Restrictions expire at their exact deadline. A reviewed correction
uses a separate two-party timed lift bound to the current restriction revision.
A stale lift cannot replay or erase a replacement restriction. Expired lift
proposals may be replaced with a new digest. All decisions have public audit
events and preserve the original report/evidence and historical hand records.

## Custody, current hands and reconnection

These controls have no API to choose a card, fold a current player, change a turn
deadline, supply a payout vector, freeze a dispute or move funds. A restriction
or self-exclusion during an accepted hand does not disable its authenticated
actions or all-in claims. Native check/fold timeouts, cryptographic reveals,
bounded missing-evidence refunds, provider fault attribution and canonical rake
and settlement continue under the accepted rules.

Cashout never calls the abuse dependency. A restricted/excluded player may
leave under the existing live leave/withdraw capabilities, and cannot lose a
refund or queued exit merely because of a report. An unavailable or changed
policy fails new admission closed but cannot trap funds. The existing reconnect
snapshot remains wire-compatible; an additive `abuseState` view exposes pinned
policy identity and the hand's admission root. Individual next-hand eligibility
reflects abuse restrictions while current-hand turn authority remains intact.

## Public monitoring and privacy

The monitor accepts at most 256 settled observations, nine players per hand and
4,096 timing observations. It rejects duplicate hands, mixed deployment/table
contexts, unfinished hands, inconsistent chip accounting, invalid clocks,
unsafe integers and unsupported/private fields. Digests bind the public data,
canonical provenance commitments, blind value and analysis thresholds. No IP,
device fingerprint, location, email, credential, seed, private key or unrevealed
card is accepted as telemetry. On-chain evidence is a private dossier commitment;
operators must retain investigation material confidentially with a documented
retention/access policy, never upload personal data or guessable identifier
hashes to this public contract.

Review candidates cover sustained directional chip flow, repeated large legal
folds to the same participant and repeated coarse turn timing across sufficient
samples. Skilled play, batching and legitimate decisions can produce these
patterns. The output explicitly says `automatedSanction: false`; source-shape
validation is not Groth16 verification or proof of chain finality. A trusted
indexer must authenticate finalized chain receipts and admission data before
production use. Local native-execution observations remain labeled as local.

## Focused qualification

Level 2 requires 30 actual native 5A.9 cases, 15 independent monitor model cases,
and the inherited 5A.5–5A.8 mandatory owners. The protected-hand trace must execute
all 41 genuine statements, independently match 399/399 plus 2 rake, prove the
immutable policy/admission identity, exercise two distinct unconflicted reviewers
and timed activation, and preserve the certified terminal result and cashout.
The legitimate hand generates no monitoring accusation or automated sanction.

The original 40-case funded integration owner, ten adversarial scenarios, both
genuine proof bundles and seven verifying keys remain required. No new proof
material is needed because the deterministic cryptographic hand context is
unchanged; eligibility is a separately frozen native admission commitment.
Runtime/initcode limits, actual constructor gas, five-graph static analysis and
matching clean source SHA are certificate gates. Missing/skipped execution or
tampered policy/quorum/outcome evidence must fail closed.

This is local Level 1/Level 2 qualification scope. Independent security/economic
review, production identity investigations, monitoring operations, trusted setup
review, legal/operator approval and live testnet/Level 3 acceptance remain
separate release gates. Unrelated global compiler and 420Arcade documentation
failures are not anti-collusion qualification evidence.
