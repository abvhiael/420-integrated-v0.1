# Fantasy dispute controller V1

Status: controller integrated with the implemented [daily NHL contest engine](BET-FANTASY-CONTEST-ENGINE-V1.md); not a deployed fantasy product. Live-provider qualification remains a separate gate. The controller holds challenge bonds only, never entry payments or prize escrow.

## Approved operating rules

- Daily NHL pools use a shared versioned DraftKings-inspired profile, seven unique athletes (C, LW, RW, D, D, G, skater FLEX), no salary cap or team limits, no bench or post-lock substitutions.
- One lineup per user per pool; edits before the first originally scheduled puck drop. Lineups hidden before lock and visible afterwards. Administrator-created public or invite-only pools using platform-published slates initially.
- At least two entrants; optional prepublished cap. Configurable entry amount and payouts, frozen before entries open. No voluntary entry withdrawal. Ties split the prizes of their occupied ranks.
- All monetary amounts use canonical $420. Paid pools allocate 3% of entry contributions to development compensation and 97% to prizes. Free prizes require full launcher funding at launch. Cancellations return full entries and launcher prize funding; no development allocation is retained.
- Game eligibility ends at the committed UTC equivalent of 11:59 p.m. Eastern on the day after the last originally scheduled slate game. Suspended games require completion inside the window; officially final shortened games count. Excluded games score zero; all games excluded cancels the pool.
- An entry/edit accepted after actual puck drop of an early-starting slate game cancels the affected pool. Early detection closes entries/edits immediately.
- Slate resolution starts 24 hours for corrections, then 24 hours for challenges. All disputes must resolve within the following 72 hours. Missing valid results at that deadline cancel the pool.
- Paid challenge bond: half the total per-user entry payment before the 3% allocation. Free-pool challenge bond: one tenth of the original launcher-funded prize. A free pool without a prize has a zero bond.
- Upheld bonds return in full; denied bonds go to the community fund. Unresolved bonds return upon cancellation; already resolved outcomes remain binding. Bonds never fund prizes or development compensation.
- Verified administrators resolve disputes initially. Delegation to authorized verified users is supported for a separately activated rollout, with revocation, expiration, conflict checks and no custody privileges.

The complete discussion record and scoring table are preserved in `BET-FANTASY-DAILY-NHL-V0.1.md`. Operational details below are concrete implementation choices, not claims of additional user approvals.

## Implemented state machine

`REGISTERED -> REVIEW -> FINAL | CANCELED`

An authorized contract host registers immutable pool configuration. The host must already enforce funded entries/prizes and the committed manifest. It starts correction exactly once using the evidenced slate-resolution time. Its delay cannot reset any deadline.

The host publishes a candidate during the correction period. Publication requires a successful canonical `IOracle420.readResult`, matching the domain-bound candidate digest; an observation submission alone is insufficient. Candidate inputs include statistics root, ranking root, accessible-evidence commitment, data cutoff and monotonically increasing revision. Hashing binds chain, controller, pool, host, manifest, data policy and scoring profile. This authenticates an agreed report, not the underlying NHL facts or an unimplemented ranking algorithm.

After the correction cutoff, the candidate is frozen. Only an entrant's current active Identity420 profile controller can challenge it. One challenge per identity per candidate revision may contain multiple issues in its evidence. This prevents unlimited evidence-hash variations from flooding one revision. The production host must enforce actual unique-user admission; creating Identity420 profiles alone does not prove personhood.

Resolutions execute only after that candidate's review window and before the original fixed resolution deadline. A human resolver needs the exact active verified credential type, current profile control and either the claim-scoped resolution capability or an accepted, unexpired delegation. Runtime checks reject interested identities, entrants and the bond payer. The host must identify the launcher and known related/materially interested parties; hidden beneficial relationships still require investigation.

An upheld claim invalidates the candidate. A replacement requires canonical oracle acceptance, a higher revision, no pending claims and a full 24-hour re-review within the original deadline. The replacement cannot incorporate post-correction-cutoff facts. If this cannot finish in time, cancel. New challenges against the replacement are allowed within that re-review and do not extend the global deadline.

Permissionless `finalize` records an immutable accepted candidate when review is over, no claims remain pending and no upheld claim remains uncorrected. A valid frozen result does not require an eternally fresh live feed for subsequent prize claims. Permissionless `expire` cancels an unresolved pool at its deadline. Clean pools cannot be canceled through the timeout path. The host may cancel before finality for a committed operational cancellation condition; it cannot cancel after controller finality.

## Bond custody and automation

The deployment constructor binds authorization, Identity420, canonical oracle, required resolver credential type, canonical asset and community fund. Native $420 is represented by the zero asset address; an ERC-20 deployment must bind its actual canonical contract. This document does not assert a live asset address.

Both native and token paths enforce exact payment; token paths check both payer/vault or vault/recipient balance deltas. Fee-on-transfer/rebasing semantics are unsupported. Percentage bonds round upward to the nearest base unit, so a positive fraction never becomes a free challenge. This rounding applies to bonds only; entrant prize/tie and 3% allocation rounding remain separate rules.

Claim resolution changes state without sending funds. Anyone may convert a settled bond into credit for its fixed beneficiary; only that beneficiary can withdraw. A nonreentrancy guard and effects-before-interactions protect payments. A rejecting beneficiary cannot block another claim or finality. No sweep, arbitrary recipient, admin payout override or escrow callback exists.

Canonical computation verdicts can execute permissionlessly against a claim-specific feed and a digest binding the manifest, data policy, candidate, evidence, result and reason. Unauthenticated roots, absent quorum or cross-pool reports fail. This supports future objective scoring/revision verification adapters. It is not a built-in sports-data scraper, mathematical proof of arbitrary off-chain rankings or an always-accept verifier.

Delegation is disabled initially. A global capability enables it once. Each grant is claim-scoped and binds the subject, exact credential, expiry and increasing epoch, and requires acceptance. The grantor's claim-scoped delegation capability and the delegate's current credential/controller are rechecked at decision execution. Revocation, expiry, key rotation or credential revocation blocks future actions. Delegates cannot redelegate without independently granted administrative capability. Decisions are ordinary sender-authenticated EVM transactions with expected candidate/epoch checks; no off-chain bearer-signature API exists.

## Approved NHL source precedence

User approved the following evidence hierarchy. Freeze its version in the data-policy manifest before entries open:

| Priority | Evidence | Proposed use |
| --- | --- | --- |
| 1 | Authenticated official NHL game records and explicit official scoring corrections | Highest authority for the covered metric and revision available by the correction cutoff |
| 2 | Licensed Sportradar NHL final/reconciled statistics | Normal primary ingestion; preferred when official evidence does not establish a contrary fact |
| 3 | Licensed SportsDataIO NHL statistics | Validation and a predeclared secondary path, not an automatic post-result replacement |

Sportradar describes its NHL API as an official NHL data-partner feed. SportsDataIO documents NHL statistics and post-final corrections. Provider contracts, complete field semantics, retention/redistribution permissions and independent upstream provenance remain unverified. [Sportradar](https://developer.sportradar.com/ice-hockey/reference/nhl-overview), [SportsDataIO](https://sportsdata.io/developers/api-documentation/nhl).

For a disagreement, first compare the same internal athlete/event ID, metric definition, game phase, units and revision cutoff. A shootout goal versus ordinary goal or a stale revision is not evidence of an alternative official score. Suspend acceptance of the disputed candidate while reconciling these differences.

If authentic official evidence settles the specific discrepancy, it prevails. Otherwise, a complete, valid primary record takes precedence over a secondary discrepancy, with the discrepancy and reason for resolution recorded. A resolver must not use highlights, projections, vendor fantasy-point totals or a majority of websites to substitute a preferred value. Do not average statistics or mix fields opportunistically across providers.

If the primary is missing or invalid, the secondary may be used only under a fallback condition defined in the pre-entry policy, with complete required coverage and authenticated evidence. The first proposed fallback is primary unavailability or invalidity established during the fixed correction window, not merely a better-looking secondary result. If evidence remains contradictory at the highest applicable tier, cannot be authenticated or cannot support the entire required normalized snapshot, fail closed and use the bounded dispute/refund path. No resolver can invent data to avoid cancellation.

The canonical oracle must still successfully accept a normalized report reflecting that decision. Exact-result reporter quorum is not a vote on which vendor is correct; independent reporting authority and independent upstream facts are different assurances. Conflicting qualifying oracle quorums cannot be bypassed by a controller admin. A replacement must satisfy canonical reads in the usual way.

Only authoritative corrections available by the approved correction cutoff affect the candidate. Later challenges may prove misapplication of then-available evidence, not introduce routine statistics corrected after the cutoff. Preserve raw captures, timestamps, revision identifiers, normalization mappings and accessible evidence hashes. Licensed evidence must be available to authorized challengers/reviewers; a hash without retrievable evidence is insufficient.

No live provider adapter or source-policy enforcement is claimed implemented here. `dataPolicy` is immutably committed and domain-bound; qualification of the reporting/adjudication pipeline must demonstrate that its reports actually enforce the hierarchy. Official website pages are references, not a substitute for a licensed supported ingestion endpoint.

## Host integration and remaining gates

`IFantasyDisputeHost420` supplies authoritative entrant identity and conflict reads. Only a qualified host contract with a contest-scoped REGISTER capability may register a pool. It must register before entry, bind the manifest, attest the original free prize escrow, preserve immutable membership after lock and supply honest slate-resolution timing. The controller delegates entry/prize custody to its qualified host; the implemented engine supplies bounded recovery for missing data/review startup.

Before any payout, the host must require controller FINAL state and the exact accepted candidate identity, then independently verify the rankings/payout claims under the frozen rules. CANCELED must drive full entry refunds, release reserved development compensation and return launcher funds. Neither `canSettle` nor a human resolution is an arbitrary payout authorization. The production host implements these settlement/refund and emergency-recovery paths; the scoped integration suite executes them against the actual controller. Live paid activation still requires independent deployment acceptance.

Standalone controller tests retain an explicitly test-only host boundary; the contest integration suite uses the actual FantasyContestEngine420 host. Neither test deployment is a live service. Existing poker and cryptographic material are untouched.

## Executable qualification

Run from repository root:

```sh
python3 scripts/fantasy/qualify-disputes.py --output artifacts/fantasy-disputes
```

The runner requires a clean tracked exact SHA, executes actual Foundry tests with Solidity 0.8.30 and 2,500 runs per fuzz case, rejects skips/failures/inventory gaps, verifies deployable runtime size, records transitive source checksums and writes evidence only after success. Explicit workflow dispatch is provided in `420bet-fantasy-disputes-level1.yml`; it does not launch unrelated global qualification.

This is scoped Level 1 controller evidence. Full fantasy Level 2 requires the production host, actual scoring/settlement, licensed provider adapters, end-to-end authoritative evidence and funded cancellation/payout integration. Official testnet and independent production acceptance remain separate gates under the repository's existing three-level model. No merge or deployment is authorized by this document.


Integration update: finalization now checks the host's exact current candidate and fails closed on an unfinished newer authenticated revision or host-read failure. The original standalone qualification remains historical; current scope must execute both controller regressions and actual contest integration.
