# NHL season-long V1 decisions

## Approved format structure — 2026-10-25

The user approved four season-long modes, selected and frozen before entries open:

| Mode | Standings |
| --- | --- |
| Total points | Cumulative NHL fantasy points across the season |
| Head-to-head points | Weekly matchups decided by NHL fantasy points |
| Head-to-head categories | Weekly comparisons across separately approved statistical categories |
| Rotisserie | Season-wide rankings in each approved category, combined into league standings |

Both points modes reuse the existing NHL scoring profile. Category lists require separate approval. Athlete ownership is exclusive within a league: each athlete belongs to one team. Initial acquisition uses snake drafts; auction, keeper and dynasty variants are later extensions. Scoring rules cannot change after entries open.

Pending: league size and roster; draft order/timeouts/autopicks; active-lineup locks and transactions; waivers/trades; category profiles; schedule/ties/playoffs; participation limits and correction/finality; funding/disputes/cancellation. These product decisions do not qualify the draft domain framework, a funded contract host or an official deployment.

## Approved league size and roster — 2026-10-25

The user approved 4–12 teams per league, with even membership required for head-to-head modes. Active slots are C, LW, RW, D, D, G and FLEX. FLEX accepts skaters only (C/LW/RW/D), not goalies. Five bench positions accept athletes of any position, making twelve unique athletes per roster. No injured-reserve slots initially. Published dual-position eligibility is allowed. There is no salary cap; athlete ownership is exclusive within the league.

This resolves league size and roster. Remaining pending decisions above still require explicit selection; these approvals do not imply funded implementation qualification.

## Approved snake draft rules — 2026-10-25

Freeze league membership before generating a verifiably random draft order. Reverse the order each round for twelve rounds. Allow sixty seconds per pick; a valid pick starts the next turn immediately.

Users may maintain private preference lists until draft start; freeze them when the draft starts. At timeout, choose the highest-ranked available athlete from that user's frozen list, then fall back to a published platform ranking. Every pick must leave a legally fillable roster; autopicks prioritize missing required positions. Disconnected users remain in the draft through autopicks.

Freeze the scheduled draft start before funding. If the draft cannot complete before the first scoring period, cancel and refund. Verifiable randomness, confidential preference storage, published fallback rankings, roster-feasibility enforcement and timeout execution require actual implementation and qualification; an operator-chosen order or an editable post-start ranking does not satisfy these rules.

## Approved weekly lineup and transaction boundaries — 2026-10-25

Use Monday–Sunday scoring periods in America/New_York, publishing exact UTC deadlines before funding. Lock the whole active lineup at the first originally scheduled NHL game of each period. Allow bench/active changes before lock; no substitutions afterward. Carry forward the previous valid lineup when a manager makes no changes. Confirmed DNPs score zero with no automatic bench replacement.

Trades and waiver processing occur only between periods. Following a roster transaction, require a valid replacement lineup before the next lock; otherwise apply a published deterministic lineup-selection fallback. Exact fallback selection is still pending. These approvals supersede incompatible draft-framework behavior and must be implemented and tested; they do not assert that the current framework already carries lineups forward or automatically builds replacements.

## Approved deterministic lineup fallback — 2026-10-25

Carry forward the previous lineup whenever it remains legal. Otherwise retain its surviving athletes in their previous slots where a complete legal lineup remains possible, then fill empty slots from the current roster in immutable athlete-ID order. Each selection must leave the remaining slots fillable. Use the same process after the draft if no initial lineup was submitted. Reject trades and waiver transactions that would leave a roster unable to field a legal lineup.

Selection cannot use later results, projections or administrator discretion. This fallback guarantees roster legality, not optimization; managers may select preferred athletes before lock. Exact stable ID encoding, slot traversal and feasibility tie-breaking must be specified in implementation and checked against reproducible vectors, without introducing discretionary choices.

## Approved waivers — 2026-10-25

Initial waiver priority is reverse draft order. Managers submit private ranked add/drop claims during the week. Freeze claims at a published cutoff and process them between scoring periods before the next lineup lock.

Process one successful claim per manager per round in priority order, repeating until no eligible claims remain. Each successful claim moves its manager to the bottom of rolling priority; unsuccessful claims retain priority. Every claim must preserve roster size, exclusive ownership and a legally fillable lineup. Dropped athletes become available in the following weekly waiver batch, not the current batch. No first-come free-agent pickups or waiver bidding initially.

This policy requires a multi-round ranked-claim processor and confidential queues beyond the draft framework's one-claim-per-member batch method. Exact batch timestamps, priority snapshots, claim sequencing and replay evidence remain implementation requirements. No existing test is claimed to qualify this newly approved policy.

## Approved trades — 2026-10-25

Two managers must explicitly accept the same player-for-player exchange. No cash, future picks or outside consideration. Equal numbers of athletes change hands, preserving twelve-player rosters and legally fillable lineups. Agreements may be submitted during a scoring period; execution occurs only between periods.

Allow twenty-four hours for review before execution. Accepted trades cannot be withdrawn unilaterally. No league voting or veto based on perceived player value. Authorized reviewers may block a trade only for documented collusion, abuse or rule violations; reviewers involved in the trade must recuse themselves. Unresolved challenged trades remain unexecuted and expire at the published processing cutoff. Publish and freeze the season trade deadline before funding.

The funded host must bind both acceptances to exact athletes, parties and proposal version, recheck ownership/roster legality at execution, and reconcile trade processing with the frozen waiver batch schedule. Those implementation requirements do not create additional product approval or imply an existing qualified review system.

## Approved category set — 2026-10-25

Head-to-head categories and rotisserie share ten categories. Skater categories are goals, assists, shots on goal, blocked shots, power-play points and short-handed points, all higher-is-better. Goalie categories are wins, shutouts and save percentage (higher-is-better), and goals-against average (lower-is-better).

Calculate goalie ratios from aggregate raw statistics, never averages of per-game percentages. Save percentage is total saves divided by total shots against. GAA is 3,600 times total goals against divided by total goalie seconds played. Shootout events do not count as ordinary goals or saves. Participation minimums and tie treatment remain pending.

Power-play points, shots against and goalie playing time require explicit verified fields beyond the daily scoring schema. These category approvals do not imply existing provider normalization or oracle acceptance covers those additional fields; complete field validation and integration are required before enabling category contests.

## Approved participation and category standings — 2026-10-25

Require two official goalie starts per full week, or one in a shortened opening/closing week. Only active-lineup appearances count. In H2H categories, missing that minimum forfeits all four goalie categories for the week; if both opponents miss it, neither earns those category points.

For rotisserie, the season minimum equals the sum of the published weekly requirements. Teams below it receive zero ranking points in all four goalie categories. This is a season eligibility test, not a requirement to satisfy each weekly minimum independently. Teams satisfying the minimum retain their aggregate active-lineup statistics, subject to event eligibility and correction rules.

H2H category wins earn one standings point, ties one-half, and losses zero; accumulate category points across weeks. Rotisserie awards league-size points for first, descending to one for last; ties share the average of occupied ranks. Compare ratios exactly without display rounding. Missing data prevents finalization rather than becoming participation failure.

These minimums apply to category modes only. Points modes retain approved NHL scoring. Exact zero-denominator behavior, schedule-exclusion treatment and final tied-prize allocation must be reconciled with subsequent approved season rules and tested.

## Approved schedule and final standings — 2026-10-25

Publish scoring start/end dates and exact weekly deadlines before funding. Cover NHL regular-season games only. No fantasy playoffs initially; all four modes use the full published scoring period.

For H2H modes, publish a deterministic round-robin scheduling method before funding. Freeze actual matchups after membership closes and before the draft; balance repeat opponents as evenly as possible. H2H points awards one standings point per weekly win, one-half per tie and zero per loss. Total-points leagues rank cumulative NHL fantasy points. Category modes use the approved category standings rules.

Final standings ties combine prizes for occupied ranks and split them equally, with deterministic smallest-unit rounding. The exact payout implementation must conserve all prize units and use immutable entry IDs for residual distribution as in the shared daily policy.

The user additionally directed that playoff pools can be set up closer to their start. Track NHL playoff pools as a separate future product/rules version; this is not approval of playoff scoring, rosters, funding, bracket rules or an implementation timeline. They do not alter funded regular-season leagues or block this initial season format.

## Approved weekly game resolution — 2026-10-25

Assign each game to its published scoring week and never count it twice. Count a game only if officially completed by 11:59 p.m. America/New_York on the following Monday, with the exact UTC cutoff published beforehand. A postponed or suspended game missing that cutoff contributes no statistics and is not reassigned to a later week. Officially final shortened games count as played without prorating.

If every game in a week is excluded, void that week: no statistics, H2H standings points or goalie-start requirement. The league continues. Use the established source precedence, followed by twenty-four hours for corrections and twenty-four hours for challenges, then the approved dispute-resolution process. Preserve historical locked lineups when applying corrections; later trades cannot change the beneficiaries of historical statistics.

Incomplete or conflicting evidence cannot be treated as conclusive exclusion merely to close a period. Weekly closure, dispute authority, season settlement dependencies and recovery must be implemented against these approved windows; the existing daily timing rules do not by themselves provide a season host.

## Approved season funding and payouts — 2026-10-25

Support paid and free leagues denominated in canonical $420. Paid leagues allocate three percent of accepted entry contributions to the development compensation fund. Free prizes require full launcher escrow. Publish an exact league size, entry fee, funding deadline and final payout table before entries open. If the league does not fill, cancel and refund in full. One team per canonical user per league.

Hold prizes and the development allocation in escrow until season settlement; no weekly cash payouts initially. No voluntary withdrawal after entry acceptance. Disconnected or inactive managers retain their teams through the approved autopick and lineup fallback rules. Pay only after final corrections and all timely disputes are resolved. Inherit the approved challenge bonds, delegated conflict-free resolution and exact payout rounding from the shared daily policy.

Cancellation/recovery triggers and their effects on season standings and separately escrowed challenge bonds remain the next decision. No approved fee allocation may be withdrawn early or retained from canceled entry contributions.

## Approved season cancellation and recovery — 2026-10-25

Cancel and refund if funding fails, the draft misses its deadline, the NHL season is officially canceled, or no scoring weeks remain eligible. Ordinary game disruptions use the approved exclusions and void-week rules.

If required evidence or a timely dispute remains unresolved seventy-two hours after the original challenge window closes, cancel the league rather than settle uncertain standings. Refund original entry payments in full, including the reserved three percent; return launcher-funded prizes. Return unresolved challenge bonds. Already resolved bonds follow their recorded decisions.

Manager inactivity alone does not cancel a league. Administrators cannot cancel because they dislike standings or change agreed rules after funding. Recovery must be bounded by the original published windows, not reset through candidate replacement or administrative delay.

The main season policy selections are now recorded. Remaining precise edge semantics, including undefined ratios and early-start recovery, must be explicitly reconciled before the final specification and implementation qualification. This record does not claim funded season contracts or clients already implement the approved policies.

## Approved final season edge boundaries — 2026-10-25

If shots against or goalie playing time is zero, the corresponding ratio is ineligible, not a perfect score. An eligible H2H opponent wins that category; if neither qualifies, neither earns points. An ineligible ratio earns zero rotisserie ranking points in that category. Failure of the separately approved goalie-start minimum still affects all four goalie categories as specified above.

If an early game start allows a lineup edit after actual puck drop, void the affected week under the approved void-week rules, including no statistics, H2H standings points or goalie-start requirement.

Execute approved trades first, then process waivers. Recheck ownership and roster legality at execution. Skip invalid claims without consuming waiver priority. Publish processing deadlines before funding. The transaction processor must finish before the next lineup lock and cannot amend a historical locked lineup.

This resolves the season edge cases raised during this approval sequence. It does not implement the agreed roster, scheduling, confidentiality, review, source-field or funded-settlement behavior. Reconcile all approved decisions into a versioned specification and executable implementation before claiming qualification.
