# 5B.1-H06 - Daily NHL rule decision history

The consolidated implemented specification is [Daily NHL contest engine V1](BET-FANTASY-CONTEST-ENGINE-V1.md). Earlier proposed/open statements below are historical and are superseded by later approved decisions and that specification.

Status: DraftKings-inspired direction selected by the user on 2026-10-24. Proposed numeric baseline below is captured from the official DraftKings Pick6 NHL fantasy-points table; it is not a claim of verified Classic/Showdown compatibility. Contest lifecycle and roster rules remain separate decisions. No runtime implementation or qualification is claimed.

Reference: https://pick6.draftkings.com/pick6-rules-and-scoring-nhl (checked 2026-10-24).

## Scoring baseline

| Skater event | Points |
|---|---:|
| Goal | 8.5 |
| Assist | 5 |
| Shot on goal | 1.5 |
| Blocked shot | 1.3 |
| Shorthanded goal or assist | additional 2 |
| Shootout goal | 1.5 |
| Hat trick | additional 3 |
| At least 5 shots | additional 3 |
| At least 3 blocks | additional 3 |
| At least 3 points (goals + assists) | additional 3 |

| Goalie event | Points |
|---|---:|
| Win | 6 |
| Save | 0.7 |
| Goal against | -3.5 |
| Shutout | additional 4 |
| Overtime loss | 2 |
| At least 35 saves | additional 3 |

The reference credits goalies for other statistics they accrue, including goals and assists. Its shutout requires the goalie to complete the whole game, concede no regulation/overtime goals and be the only goalie of record; shootout goals do not invalidate it.

## Proposed 420Bet interpretation to freeze with implementation

- Count regulation and overtime. Keep shootout goals as a separate field: they do not also receive the ordinary goal award, count toward hat tricks or ordinary goals-plus-assists, or create ordinary shots/saves/goals-against.
- Shorthanded points add to the ordinary goal/assist award. No additional power-play bonus: a power-play goal or assist receives its ordinary award. The selected reference does not list a separate power-play bonus.
- Each milestone bonus is awarded once per athlete per game. Different milestones stack. Six blocks award one blocks bonus, not two. Hat tricks and three-point bonuses can both apply.
- Use tenths of a fantasy point as signed integers: goal 85, assist 50, shot 15, block 13, save 7, goal against -35. No floating point or per-event rounding. Negative totals remain negative.
- Persist event-level stats before slate aggregation; thresholds apply per game, not across multiple games.
- Adopt the source's goalie other-stat eligibility; document the complete metric eligibility map before profile freeze. Do not infer a win or overtime loss from team score alone.
- No points for hits, penalty minutes, plus/minus, faceoffs or time on ice in this baseline.

## Worked cases for future independent test vectors

- Skater: 3 goals, 1 assist, 5 shots, 3 blocks, including 1 shorthanded goal = 55.9 points. Base 25.5 + 5 + 7.5 + 3.9 + shorthanded 2 + four milestone bonuses totaling 12.
- Goalie: win, 36 saves, 2 goals against = 27.2 points (6 + 25.2 - 7 + 3).
- Goalie: shutout win with 36 saves = 38.2 points (6 + 25.2 + 4 + 3).

These are specified expected values, not executed test results.

## Remaining decisions

Roster construction, lineup management and individual DNP handling are recorded in the decisions below. The one-lineup-per-user-per-pool entry limit is recorded below. Operational lock timing, canceled/suspended-game handling, correction/challenge windows remain open. Tie allocation is recorded below. Configurable payout structures are recorded below. They must be frozen in the contest policy before funded activation. Do not import Pick6 line-selection, pardon or void rules into lineup points pools automatically.

## Lineup decision - 2026-10-24

User-selected position-based lineup: seven unique athletes.

| Slot | Count | Eligibility |
|---|---:|---|
| Center | 1 | C |
| Left wing | 1 | LW |
| Right wing | 1 | RW |
| Defense | 2 | D |
| Goalie | 1 | G |
| Flex-player | 1 | C/LW/RW/D; skaters only (confirmed) |

The two defense slots require different athletes. Each athlete may occupy only one slot, including FLEX. This lineup replaces the earlier nine-player discussion candidate for this daily-pool profile; it does not determine other formats' rosters.

Proposed position policy: use a versioned eligibility snapshot published before entry; dual-position players may fill any listed eligible slot, but never multiple slots simultaneously. Preserve separate LW/RW eligibility rather than silently treating all wings as interchangeable. Missing or ambiguous provider positions require resolution before an athlete enters the eligible pool.

FLEX eligibility confirmed by the user: C/LW/RW/D; goalies are ineligible for FLEX. Roster construction confirmed by the user: no salary cap; any seven unique eligible athletes satisfying C/LW/RW/D/D/G/FLEX are allowed. No minimum team count or maximum players per team applies to this daily-pool profile. FLEX remains skater-only. Confirmed lineup management: no bench; owners may edit their eligible seven-player lineup before the slate-wide lock at the first game. Once locked, the entire lineup is immutable; no late swaps or substitutions. Operational lock timing, early starts, postponements and cancellation handling remain to be specified. No runtime implementation or test result is claimed.




## Individual non-participation decision - 2026-10-24

Confirmed by the user: a scratched skater or a goalie who never plays scores zero, with no automatic replacement or individual-DNP entry refund. Before lock, the owner may edit the lineup under the normal eligibility rules. After lock, the selected athlete remains in the lineup. A goalie who appears in relief is scored from actual credited statistics under the scoring profile, rather than treated as a non-participant. Missing or unresolved provider data must not be classified as confirmed non-participation or silently scored as zero. Canceled, postponed or suspended games remain a separate contest-policy decision.


## Entry limit decision - 2026-10-24

Confirmed by the user: one lineup per user per pool. The same user may enter separate pools, subject to each pool's eligibility and funding rules. Editing an existing lineup before lock does not create a second entry. A second entry in the same pool must be rejected without retaining an additional entry payment. Identity and entry ownership must bind to the authorized user, not merely a replaceable session key. The mechanism for enforcing user uniqueness across multiple wallets remains a required implementation decision; a wallet-only limit must not be represented as a proven one-person limit.


## Payout configuration decision - 2026-10-24

Confirmed by the user: payouts are configurable per pool, with the payout structure published before entry. Freeze the payout configuration before entries open; it cannot be changed for an existing funded pool. The configuration must define paid ranks, allocations, any fees and how the distributable pool is calculated. Validate that allocations fit the funded prize pool and cannot create unfunded liabilities. The selected structure must remain inspectable by entrants and committed in the contest manifest. Tie handling is recorded below. The minimum entrant rule is recorded below. Indivisible-unit rounding remains a separate decision.


## Tie allocation decision - 2026-10-24

Confirmed by the user: entries tied on final fantasy points combine the prizes for all ranks they occupy and split that total equally. Two entries tied for second occupy ranks two and three; the next entry ranks fourth. Unpaid occupied ranks contribute zero, so a tie spanning the last paid rank shares that rank's prize with all entries in the tie group. Apply the same rule to every tie group without a performance-based secondary tiebreaker. Allocation of indivisible asset units remains an open rounding decision; settlement must preserve every funded unit.


## Minimum entrants decision - 2026-10-24

User selected a minimum of two entrants for daily points pools. Count distinct valid funded user entries at lock; duplicate attempts, failed payments and invalid lineups do not count. If fewer than two qualifying entrants remain at lock, cancel the pool and refund all entry payments, including any entry fees. No operator deduction applies to a canceled pool. The minimum is two; a higher configurable minimum has not been approved.


## Entry fee decision - 2026-10-24

Confirmed by the user: entry fees are configurable per pool, published and frozen before entries open. The published configuration must distinguish the total amount paid to enter, the amount credited to the prize pool and the development compensation allocation or any separately approved deduction; the later free/paid pool decision sets a 3% development compensation allocation for paid pools. Use the same entry terms for all entrants in a pool. Entry fees cannot change after entries open. Any deduction must be disclosed in the payout configuration and cannot create an unfunded prize obligation. If the pool is canceled for failing to reach two entrants, refund the entire entry payment, including fees, as already specified.


## Maximum entrants decision - 2026-10-24

Confirmed by the user: no maximum entrant count by default. A pool may instead publish an optional entrant cap, fixed before entries open. A configured cap must be at least two and cannot be raised or lowered after entries open. Enforce it atomically when accepting funded entries; reject excess entries without retaining their payment. Pre-lock lineup edits do not consume another place. An uncapped pool still requires a scalable ranking and settlement design that avoids unbounded on-chain loops or a single transaction processing every entrant.


## Withdrawal decision - 2026-10-24

Confirmed by the user: once an entry is accepted and funded, the entrant cannot withdraw it or reclaim its payment voluntarily. The owner may still edit the existing lineup before the slate-wide lock under the approved eligibility rules. After lock, no lineup edits or substitutions are allowed. Cancellation refunds are distinct from voluntary withdrawals: if the pool is canceled under its published policy, refund the entire entry payment, including fees. Funds from an accepted entry remain committed to that pool until settlement or an authorized cancellation refund.


## Lineup visibility decision - 2026-10-24

Confirmed by the user: lineups remain hidden from other entrants before the slate-wide lock and become visible after lock for transparent scoring and verification. Owners can inspect and edit their own lineups before lock. Only the latest accepted pre-lock lineup is authoritative. Other entrants must not be able to retrieve it through public APIs, transaction calldata, events, storage or predictable commitments before lock. The implementation must specify a genuine confidential submission and bounded publication mechanism; hiding a UI element is insufficient. Publication must not depend on an entrant's discretionary reveal after observing results. Any commit/reveal or encrypted design must define validation, availability, failure recovery and prevention of selective non-reveal before funded activation. No privacy mechanism is claimed implemented by this decision.


## Postponed games and scoring window decision - 2026-10-24

Confirmed by the user: postponed games count only if completed within a fixed scoring window published before entries open. A game not completed within that window is excluded in full and contributes zero for every selected athlete from that game; no automatic replacements or individual entry refunds apply. If every game in the slate is excluded, cancel the pool and refund all entry payments, including fees. The window cannot be extended after entries open. Missing or unresolved provider data is not proof of game exclusion and follows the separate bounded data-recovery policy. The exact window cutoff is recorded below. Suspended-game treatment is recorded below. Officially shortened-game treatment is recorded below.


## Scoring window cutoff decision - 2026-10-24

Confirmed by the user: the scoring window ends at 11:59 p.m. Eastern on the calendar day after the slate's last originally scheduled game. Determine that calendar date using America/New_York and the original schedule snapshot frozen before entries open. Publish and commit the exact UTC cutoff timestamp, accounting for daylight saving time. Later schedule changes do not shift the cutoff. Operational interpretation: include the entire 11:59 p.m. minute; use midnight starting the following day as an exclusive boundary. A qualifying game must be completed before that boundary. This is a game-completion window, not the separate statistics correction or challenge deadline.


## Suspended games decision - 2026-10-24

Confirmed by the user: a suspended game counts only if officially completed within the fixed scoring window. If it resumes and completes in time, count the full game's eligible statistics, including play before suspension. If it does not complete in time, exclude the entire game, including statistics accrued before suspension; its athletes contribute zero and receive no automatic replacements. Apply the existing full-refund rule if all slate games are excluded. Completion after the cutoff does not reopen the game for scoring. Officially final shortened games follow the decision below.


## Officially final shortened games decision - 2026-10-24

Confirmed by the user: a shortened game officially declared final by the NHL within the fixed scoring window is eligible. Count its official statistics as played, without projecting a full-length game or prorating athlete scores. A suspended, abandoned or canceled game is not eligible under this exception unless the NHL actually declares it final before the cutoff. Goalie wins, shutouts and other awards still require their selected profile's eligibility conditions; final status does not automatically confer them. Later statistic corrections follow the separate correction/finality policy. The adapter must preserve evidence of the official final declaration and its timing rather than infer it solely from a shortened clock or delayed provider observation.


## Statistics correction and challenge windows decision - 2026-10-24

Confirmed by the user: allow 24 hours for statistics corrections after the slate resolves, followed by 24 hours for challenges before payouts. The slate resolves when every scheduled game has a conclusive eligible-final or excluded status under the fixed scoring-window policy. Games still capable of becoming eligible keep the slate unresolved until their disposition is known or the scoring cutoff excludes them. The authoritative resolution timestamp and supporting event-status evidence must be recorded; an operator cannot reset it to extend the windows.

During the correction window, incorporate authoritative statistic revisions for eligible games and recompute provisional scores. Freeze the candidate statistics revision/root and rankings at the correction cutoff and publish the reproducible evidence. The challenge window is the following 24 hours; payouts remain blocked during it and while any timely challenge remains unresolved. Late source delivery or missing evidence must follow the separately specified data-recovery policy and cannot silently shorten the required opportunity to challenge a published candidate.

A valid challenge concerns the candidate's compliance with the frozen contest rules and authoritative data at the correction cutoff. It does not permit changing scoring rules, reintroducing excluded games or routinely incorporating new statistics first corrected after that cutoff. Any upheld challenge requires corrected evidence and a defined review/finality procedure before settlement. Challenge authority, evidence access, resolution deadlines, re-review mechanics and failure/refund handling remain to be specified. No automatic payment is authorized merely because 48 hours elapsed if required evidence is missing or a challenge is unresolved.


## Pool access decision - 2026-10-24

Confirmed by the user: each pool may be configured as public or private/invite-only. Publish and freeze the access mode before entries open. Public pools accept users meeting the published eligibility requirements; private pools additionally require verifiable invitation authorization bound to the pool and entrant. Enforce authorization when accepting the funded entry, not solely through listing visibility or possession of a shareable URL. Invitations do not bypass the one-entry-per-user rule, entrant cap, payment, roster legality or lock deadline. Revoking an invitation cannot remove or confiscate an already accepted funded entry. Private access does not alter the approved post-lock lineup visibility rule; any broader metadata confidentiality would require a separate decision. Invitation issuance, expiry and revocation mechanics remain implementation details to specify.


## Slate selection decision - 2026-10-24

Confirmed by the user: pool creators select from platform-published NHL game slates; custom creator-built slates are not supported in this daily-pool version. Each published slate must identify its eligible games, original schedule snapshot, eligible athlete/position snapshot, lineup lock and scoring cutoff. Bind the selected slate version to the pool before entries open. Pool creators cannot add, remove or substitute games. Once entries open, platform changes cannot silently replace the pool's committed slate; apply the existing final, postponed, suspended and excluded-game rules instead. Platform slate publishing authority and audit records must be specified separately from pool creation authority.


## Shared scoring profile decision - 2026-10-24

Confirmed by the user: all daily points pools use the same platform-approved scoring profile for the applicable version. Pool creators cannot customize weights, statistical eligibility or bonus rules. Future changes require a newly published scoring profile version; existing pools retain their committed version. The platform must identify which version applies to newly created pools and expose that version before entry. Bind the exact scoring profile identity to each pool's immutable manifest. This decision establishes the versioning policy; it does not claim implementation or qualification of the draft numeric profile and its remaining interpretation details.


## Pool creation rollout decision - 2026-10-24

Confirmed by the user: pool creation is restricted to authorized platform administrators initially. Eligible users may enter public pools or authorized private pools under the agreed entry rules, but cannot create pools at launch. Enforce creation authorization in the authoritative backend/contract path, not only in the interface. Pool creators remain bound by published slates, the shared scoring profile, immutable configuration, funded-liability limits and all other agreed policies; creation authority does not grant arbitrary access to escrow.

Future roadmap: open pool creation to eligible users after the platform is established and operational issues have been resolved. Treat this as a separate rollout requiring explicit activation, qualified creation permissions, abuse controls and demonstrated operational readiness. No automatic date or readiness threshold has been approved. Define those acceptance criteria and qualify the expansion before enabling user creation.


## Free and paid pools; development compensation - 2026-10-24

Confirmed by the user: support both free and paid daily pools.

Free pools charge no entry payment and have no monetary prize by default. A free pool may award monetary prizes only if its launcher deposits the entire advertised prize into that pool's escrow when launching it. An unfunded promise, external balance or later funding pledge does not establish a prize. Freeze the funded prize and payout configuration before entries open. The paid-pool 3% allocation does not apply to free pools or their launcher-funded prizes.

Paid pools allocate 3% of the gross pool of accepted entry contributions to the designated dev compensation fund; the remaining 97% forms the entrant-funded distributable prize pool. This allocation is part of the entry payment, not an additional charge on top. No other platform deduction is approved. Publish the gross contribution, development allocation and net prize calculation before entries open. For example, 100 units of paid entry contributions allocate 3 units to the fund and 97 units to prizes. Indivisible-unit rounding remains to be specified.

Hold all contributions in escrow until valid settlement or cancellation. On valid settlement, account for the fund allocation and participant prizes canonically and prevent duplicate distributions. On cancellation, return full paid entry payments, including the reserved 3%, and return any free-pool launcher-funded prize to its funding launcher; no development compensation is retained from a canceled pool. Bind the fund recipient through the repository's authorized configuration mechanism rather than permitting arbitrary payout redirection.

Consistency update: minimum participation remains two distinct valid accepted user entries. Paid entries must be fully funded; free entries require no payment and still count when otherwise valid. Free prize eligibility depends on the launcher's escrow funding, not entrant payments. Existing one-entry-per-user, access, roster, lock and cancellation rules apply to both modes. This supersedes any earlier generic requirement that every qualifying entrant personally fund an entry.


## Pool denomination decision - 2026-10-24

Confirmed by the user: daily points pools are denominated in the platform's canonical $420 asset. Paid entry payments, launcher-funded free-pool prizes, escrow balances, participant payouts, cancellation refunds and the paid-pool 3% dev compensation allocation all use that same asset. No mixed-asset pools or implicit fiat conversion. Free pools without prizes require no entry payment or prize funding.

Bind accounting to the canonical asset identity for the deployment chain, not the ticker string alone. Token address or native-asset designation and decimal precision must be verified from the repository's deployment configuration before implementation; this decision does not assume either asset form or invent a contract address. Store monetary amounts in integer base units. Percentage and tie-split rounding must conserve every escrowed base unit under a published deterministic policy. Network transaction costs are separate from pool entry and prize accounting.


## Operational lineup lock decision - 2026-10-24

Confirmed by the user: freeze the slate-wide entry and lineup-edit deadline at the first scheduled puck drop in the original published slate schedule. Publish and commit its exact UTC timestamp before entries open. At that deadline, close both new entries and lineup edits for the entire slate. Delays or later schedule changes do not extend the deadline.

If any slate game starts before that deadline, close entries and edits immediately when the early start is detected. An actual start before the scheduled deadline is a security-relevant exception: distinguish the evidenced actual start time, provider observation time and system closure time. Do not claim that feed-triggered closure alone prevents all late entries during reporting latency. Entries or edits accepted after actual puck drop require a precommitted recovery policy. The approved recovery rule is recorded below and must be implemented and qualified before funded activation.


## Early-start recovery decision - 2026-10-24

Confirmed by the user: if an entry or lineup edit is accepted after actual puck drop of a slate game that started before the published lock deadline, cancel the affected pool in full. Do not selectively retain entries or restore earlier lineup versions. Refund every paid entrant's entire entry payment, including the reserved 3% development allocation. For a free pool with launcher-funded prizes, return the prize escrow to the funding launcher. No prizes or development compensation are distributed from a canceled pool.

Apply this rule to every affected pool using the slate, based on its own accepted entry/edit history and evidenced actual start time. An early start alone does not cancel a pool when no entry or edit was accepted after actual puck drop; the immediate closure rule still applies. Preserve authoritative start-time evidence, accepted-entry/edit timestamps and cancellation audit records. Early-start checks must be resolved before payout; unverifiable timing follows a separately bounded recovery policy, not an assumed clean result. The policy prevents discretion based on standings or eventual results.


## Dispute resolution authority decision - 2026-10-24

Confirmed by the user: authorized platform administrators resolve disputes initially. Require a documented challenge, accessible supporting evidence, an identified authorized decision-maker, a recorded decision with reasons and an auditable link to the affected pool and candidate revision. Decisions must apply the pool's frozen rules and authoritative evidence; administrators cannot change scoring weights, eligibility rules, lock/cutoff deadlines, payout terms or the 3% allocation for an existing pool.

An upheld challenge may correct a provable data, computation or rule-application error through the specified candidate revision and review procedure. Resolution authority does not grant arbitrary escrow transfers or permission to select a payout vector without reproducible rankings. Timely unresolved challenges block payout. Challenge submission access, resolver conflict handling, maximum resolution duration, corrected-candidate review and failure/refund procedures remain to be specified and qualified. This is the initial governance model, not a claim of decentralized dispute resolution.


## Results challenge bond decision - 2026-10-24

User-directed policy: challenging results requires a bond equal to 50% of the pool's published entry fee, denominated in canonical $420. Calculate it from the total per-user entry payment before the 3% development allocation, not from the prize pool or the number of entrants. For example, a 100 $420 entry fee requires a 50 $420 challenge bond. Exact base-unit rounding remains to be specified.

Escrow the bond separately from entry contributions, prize funding and the development allocation. If the claim is upheld, return the entire bond to its challenger. If denied, transfer the entire bond to the designated community fund; it does not go to the resolver, development fund or pool prizes. Settle each bond once against its recorded claim outcome. Bind the community fund recipient through authorized platform configuration.

This replaces the proposed fee-free challenge policy, which was not adopted. Free pools use the prize-based bond policy recorded below instead of the paid-pool entry-fee formula. Challenger eligibility, duplicate challenges, withdrawn/invalid claims, unresolved claims on pool cancellation, conflict handling and bounded resolution/re-review rules also remain open. Do not classify an unresolved claim as denied solely to dispose of its bond.


## Free-pool results challenge bond decision - 2026-10-24

Confirmed by the user: for a free pool, the challenger deposits a bond equal to 10% of the launcher-funded prize money escrowed when the pool launches, in canonical $420. Use the committed original prize amount, not the remaining escrow after claims or payouts, and exclude separately escrowed challenge bonds from the calculation. The challenger supplies this bond; it is not deducted from the pool's prize money.

If the claim is upheld, return the entire challenge bond to its challenger. If denied, send the entire bond to the designated community fund. Apply the same separate escrow, recorded outcome and once-only bond settlement requirements as for paid pools. A free pool with no prize escrow has a zero challenge bond under this formula; no positive minimum has been approved. Exact base-unit rounding remains to be specified.


## Dispute deadline, delegation and automation decision - 2026-10-24

User approved a resolution deadline of 72 hours after the original 24-hour challenge window closes. All timely challenges must reach a valid resolution by that deadline. Delegation, candidate revisions and internal review cannot extend it. If a valid final result cannot be established by then, cancel the pool: refund paid entry payments including the reserved 3%, return launcher-funded free prizes and return bonds on unresolved challenges. Bonds on claims already conclusively upheld or denied retain their approved outcome; a timeout alone is not a denial. No entrant prizes or development allocation are distributed from the canceled pool.

User requested a mechanism for later delegation to an authorized verified user and asked for smart-contract-assisted dispute resolution. Add the following implementation work to the shared dispute framework; no such implementation is claimed by this document.

### Resolver authority and delegation

- Launch with administrator resolvers, while implementing a separately controlled delegation capability for later activation.
- Bind each delegation to a verified platform identity and its authorized signing account, explicit pool/claim scope, expiry and permission epoch. Verification alone does not confer resolver authority. Use the repository's established identity and capability mechanisms where applicable.
- Record grant, acceptance, revocation, expiry and resolution actions. Recheck current authority at decision execution; revocation blocks future actions but does not silently undo an executed decision.
- A delegate may adjudicate the assigned dispute, not change frozen rules, redirect fund recipients, withdraw escrow or delegate again. No transitive delegation by default.
- Reject self-adjudication: challengers, affected entrants, pool launchers and other materially interested parties cannot resolve their own pool's disputes. Define enforceable conflict checks and an alternate resolver assignment procedure before activation; verified identity does not establish absence of hidden conflicts.
- Reassignment must remain within the original deadline. If a qualified alternate cannot resolve the claim in time, apply the cancellation/refund policy.

### Smart-contract-assisted resolution architecture

A shared dispute controller should enforce claim submission windows and bond amounts, escrow bonds separately, register evidence commitments, enforce resolver capabilities and conflicts, track candidate revisions and prevent settlement while timely claims remain unresolved. It should execute approved bond destinations, finality transitions and deadline-triggered recovery exactly once.

Automate objective checks where the submitted evidence can establish the result: duplicate claims, stale/wrong-context reports, roster or rule-version mismatch, arithmetic errors, milestone eligibility against authenticated statistics, ranking errors, payout conservation and mismatch against the accepted canonical stat root. These checks require actual authenticated inputs and a deterministic verifier or bounded proof mechanism; a claimant's asserted root is not sufficient. Uncapped pools must not require unbounded on-chain recomputation.

Conflicting real-world statistics, source authenticity not established on-chain, missing evidence and judgment over the approved evidence hierarchy require an authorized resolver. Smart contracts cannot independently observe an NHL game. Administrators or authorized delegates should normally attest only the bounded claim outcome and evidence/candidate identity after automated validation; they must not supply arbitrary payout vectors.

Use scoped signed decisions bound to chain, controller, pool, claim, evidence, candidate revision, outcome, authority epoch, nonce and expiry. Prevent replay, cross-pool substitution and acceptance after the fixed deadline. A reasoned recorded decision must remain auditable, with licensed evidence access designed for challengers and reviewers.

Before qualification, specify duplicate-claim handling, what makes a challenge timely/admissible, objective automatic-denial conditions, authority conflicts, source-evidence precedence and corrected-candidate review. A corrected candidate must receive meaningful review within the fixed deadline; do not reset the global challenge window or enable late claims to stall settlement indefinitely. If the required review cannot finish in time, apply recovery.

Required tests include unauthorized/expired/revoked delegate actions, identity/key rotation, self-resolution, cross-claim signature replay, bond conservation, forged evidence roots, concurrent decisions, deadline boundaries, corrected rankings, failed fund transfers, timeout refunds and attempts to bypass an unresolved claim. Qualify automation and delegation separately; nominal admin involvement is an intended operating model, not an assurance that real-world disputes are fully automatic.


## Dispute controller implementation update

The agreed dispute rules now have an implemented controller: see [Fantasy disputes V1](BET-FANTASY-DISPUTES-V1.md). It provides separate bond custody, fixed deadlines, authorized verified resolvers, revocable scoped delegation and canonical-oracle verdict execution. The production fantasy host, entry/prize escrow wiring and licensed source adapters remain unimplemented and unqualified.

Implementation details: one challenge per entrant per candidate revision (aggregate multiple issues into its evidence); bonds round up to a base unit; upheld corrections require a full 24-hour re-review within the original deadline. The proposed source hierarchy is official NHL evidence, then Sportradar, then SportsDataIO, with fixed-cutoff and authenticated-report requirements. User approved this source hierarchy and its cutoff, fallback and fail-closed rules.


## Monetary rounding decision

Approved by the user: perform all monetary accounting in integer base units of canonical $420.

- For a successfully settled paid pool, calculate development compensation once from total accepted entry contributions: floor(gross * 3 / 100). The entire remainder forms the entrant-funded prize pool. Use overflow-safe quotient/remainder arithmetic or full-precision multiplication/division. No per-entry rounding and no additional deduction.
- Derive configured rank prizes and tied-entry entitlements using exact rational arithmetic. Each tie group shares the combined entitlements for the ranks it occupies, including zero-valued unpaid ranks. Do not apply intermediate rounding that changes those entitlements.
- Round final entrant entitlements down to base units. Distribute any remaining prize base units, one per eligible entry, in ascending immutable entry-ID order among entries with a nonzero fractional remainder. Entry IDs must be assigned by the authoritative engine at initial acceptance, remain unchanged by edits and cannot be selected or regenerated by an entrant to choose the residual-unit order. No entry receives more than one residual unit in this pass. Deterministic settlement must account for the entire distributable prize amount.
- Challenge bonds round upward to the nearest base unit: half the total paid entry amount or one tenth of the original free-pool prize escrow. A zero-prize free pool has a zero bond. This matches the implemented dispute controller.
- Canceled pools return exact original entry payments and launcher funding; there is no development allocation or percentage-based rounding deduction on refunds.

The contest engine must validate that payout entitlements cover the whole distributable prize pool, including configurations with fewer entrants than nominal paid ranks; the rule for those configurations remains to be specified. Source hierarchy and rounding are now approved policy. Arithmetic, residual allocation and escrow conservation still require contest-engine implementation and executed tests; no new runtime qualification is claimed by this decision.


## Two-entrant payout override

User-directed rule: if exactly two valid entries qualify at lock, the pool is winner-take-all regardless of its otherwise configured payout schedule. The higher final fantasy score receives the entire distributable prize pool. If the two entries tie, they share it equally under the approved tie and residual-unit rules. For a paid pool, distributable prizes are calculated after the approved 3% development allocation; for a free pool, they comprise the launcher-funded prize escrow, if any. No-prize free pools confer standings only.

Publish this automatic entrant-count override as part of every pool's pre-entry terms; applying it is not a discretionary post-entry payout change. Count qualified accepted entries at lock, not later withdrawals, claim activity or payout claims. Fewer than two entrants triggers cancellation/refunds as already agreed. This replaces the proposed proportional redistribution rule for two entrants, which the user did not adopt. Treatment of configured payout ranks exceeding the entrant count when three or more entrants qualify remains a separate open decision.


## Entrant-count payout tables

Confirmed by the user: for pools with three or more qualifying entrants, the configured payout schedule automatically adapts to the final entrant count using a table published before entries open. Freeze the complete table in the pool manifest. Select its applicable row deterministically from the number of valid accepted entries at lock; administrators cannot choose or change the row after entry.

Validate that the table covers every permitted entrant count without gaps, overlapping alternatives or payable ranks exceeding that count. Uncapped pools require a final open-ended range. Every row must allocate the entire distributable prize pool through explicit exact weights; use the approved tie and monetary-rounding rules. The existing exactly-two-entrants winner-take-all rule takes precedence over the table, and fewer than two triggers cancellation with full refunds. No specific payout percentages or entrant-count bands are selected by this decision; those remain per-pool configuration subject to these validations.

This resolves the earlier open question about configured paid ranks exceeding qualifying entrants: select a valid count-specific row rather than improvising a redistribution or leaving prize units unallocated. Payout-table implementation and executed integration tests remain required.
