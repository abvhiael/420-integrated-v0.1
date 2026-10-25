# NHL pick'em V1 decisions

## Approved funding-model scope

The user selected both peer-funded pools and house-backed fixed payouts, with separate liability rules. A funded peer prize pool does not collateralize house payout promises. Numeric house payout tables and risk limits remain unapproved.

## Approved selection structure — 2026-10-25

Initial coverage is NHL regular-season player-stat over/under selections. Available metrics are goals, assists, shots on goal, blocked shots and goalie saves. Card size is two or three selections, fixed per pool. Each card permits one selection per athlete. One card per canonical user per pool.

Use platform-published lines frozen before entries open. Peer entrants share the same available market board and card size. Allow edits before the published slate lock and no changes afterward. Prohibit combinations identified by a published, frozen correlation policy. Team-winner selections, live betting and larger cards are later extensions, not approved initial scope.

Participation requirements, pushes, void reduction, game cutoffs, peer ranking, exact correlation rules, house multiplier tables/reserves/limits, fees, funding, challenge and recovery policy remain pending. This is a product decision record, not evidence that the draft domain framework or funded contracts implement or qualify these policies.

## Approved participation, pushes and voids — 2026-10-25

Skater selections count once the player records official ice time; early injury does not void an eligible selection. Goalie-save selections require the goalie to start: relief-only participation is void, but an early exit after starting still counts. Confirmed nonparticipation voids a selection. A statistic exactly equal to the line is a push, treated as void.

Excluded games void their selections under the daily pool's completion cutoff. Missing or disputed statistics remain unresolved and never become an automatic loss. A house card reduces only through its frozen payout table; fewer than two remaining selections produces a full stake refund. This supersedes the draft framework's one-active-leg multiplier behavior and requires implementation and new tests.

In peer pools, remove a void selected market from scoring for every entrant who selected it. Exact resulting rankings and refunds remain the next approval decision; neither a win-percentage method nor the draft framework's raw-win method is implicitly approved here.

## Approved peer rankings and refunds — 2026-10-25

A peer card needs at least two nonvoid selections to qualify. Refund an entrant's full payment if its card falls below that minimum. Rank qualifying cards by correct selections divided by nonvoid selections, using exact fractions; two-of-two and three-of-three tie.

If fewer than two qualifying entrants remain, cancel and refund the entire pool. Calculate prizes and any fee only from retained qualifying contributions; refunded entries incur no fee. Exactly two qualifying entrants means winner-take-all. Larger fields use the published payout table. Ties combine occupied-rank prizes and split equally, using deterministic smallest-unit rounding. Return launcher prize escrow when a free pool cancels.

This supersedes the draft reference ledger's raw-win ranking and lack of per-entry void refunds. Neither implementation nor qualification is claimed by recording this approval; the future funded host must reconcile qualifying entrants, contributions and payout-table selection atomically.

## Approved funding and fees — 2026-10-25

Use canonical $420 throughout. Peer pools may be paid or free; free prizes require full launcher escrow. Paid peer pools allocate three percent of retained qualifying contributions to the development compensation fund.

House-backed cards are paid initially, with a published stake and gross payout table. A quoted gross payout includes returned stake. Allocate three percent of nonrefunded house-entry stakes to the development compensation fund without reducing the quoted winner payout. Before admission require sufficient house collateral for promised gross payouts and the development allocation. Keep house liabilities separate from peer-pool funds.

Full refunds include reserved fees; canceled/refunded entries generate no development allocation. Keep fees, reserves and prizes escrowed until dispute-gated settlement. The house reference ledger currently omits the development allocation and is not qualified against this newly approved policy; it requires revised reservation and settlement accounting with conservation tests.

## Approved initial house payout table — 2026-10-25

| Nonvoid selections | Result | Gross payout |
| --- | --- | --- |
| Three | All three correct | Five times original stake |
| Two | Both correct | Three times original stake |
| Two or three | Any incorrect | Zero |
| Fewer than two | Any result | Full original stake refund |

A three-selection card reduced to two uses the three-times gross payout. No partial-win payouts or repricing. Refund treatment below two nonvoid selections takes precedence over whether a remaining selection is correct. Quoted gross payout includes returned stake; the development allocation cannot reduce it.

House cards settle individually and do not require two entrants because the house is the counterparty. Every accepted card must remain fully collateralized, including its development allocation. A stake of 100 units returns 300 gross for two correct selections or 500 gross for three.

These are approved initial product settings. Economic calibration, reserve/fee accounting, funded adversarial qualification and independent acceptance remain required. This decision is not an assertion of expected return, statistical independence or production authorization.

## Approved correlation/exposure controls with user exception — 2026-10-25

The user approved the proposed controls, with an explicit exception to the different-game rule: permit same-game combinations on days with fewer than three different NHL games being played. On other days, each selection must come from a different NHL game. Retain one selection per athlete per card.

Publish and freeze stake, card size and maximum aggregate house liability before entries open. Reserve every card's maximum gross payout plus its development allocation without offsetting against other cards, including opposing selections. Reject admission before payment when collateral or the published exposure limit is insufficient. New entries may be suspended for stale data or operational problems; accepted cards retain their original rules and payout promises. Different games are not proof of statistical independence.

The precise calendar/schedule-count snapshot and allowed same-game combinations remain to be specified. A platform-selected subset must not be silently substituted for the NHL-wide game count. The exception does not approve arbitrary correlated combinations, an assumption of independence, a different payout table or a relaxation of gross collateral. Same-game economic/risk cases require explicit qualification.

## Approved same-game exception boundaries — 2026-10-25

Determine the daily game count from the official NHL schedule for the slate's America/New_York calendar date, frozen before entries open, rather than the platform's selected subset. Same-game combinations are permitted when that count is fewer than three; otherwise each selection must come from a different game. Retain one selection per athlete.

Publish an explicit allowed-combination list and block directly linked combinations, such as a skater's shots and the opposing goalie's saves. Keep the approved payout table and full collateral requirements. Same-game combinations require separate qualification before enablement. This resolves the count/snapshot policy but does not itself enumerate or approve every allowed combination; the concrete whitelist and adversarial economic cases remain implementation/review deliverables.

## Approved disputes and recovery — 2026-10-25

Inherit established source precedence, a twenty-four-hour correction window, twenty-four-hour challenge window and seventy-two-hour resolution deadline. The challenge bond is half the published entry stake, or ten percent of launcher prize escrow for free pools. Return upheld bonds; send denied bonds to the community fund. Use authorized conflict-free reviewers and the approved delegation mechanism.

A disputed peer result holds the entire pool's settlement because rankings may change. A disputed house result holds every affected card and its reserves; unaffected cards may settle after their own finality requirements pass. If unresolved at the deadline, refund the peer pool or affected house cards in full, including reserved fees, and return unresolved challenge bonds. Cancel and refund an affected pool if an early start allowed entries or edits after actual puck drop.

These decisions require immutable original windows, candidate/market dependency tracking, bounded delegation, authenticated evidence and atomic escrow reconciliation. No document marker, unsigned model result or freely supplied approval boolean constitutes the required dispute finality.

## Approved initial same-game whitelist — 2026-10-25

On days with fewer than three NHL games under the approved schedule-count snapshot, allow same-game combinations only of skater shots on goal and blocked shots, using different athletes. Two or three such selections may come from one game. Goals, assists and goalie-save selections remain available, but each must come from a game not shared by any other selection on that card.

Retain the approved three-times/two-selection and five-times/three-selection gross payout table, including the previously approved void/refund rules and full collateral plus development allocation. Qualify allowed pairs and three-selection combinations before enabling them. Broader combinations require a separately qualified whitelist version; existing entries retain their frozen version.

This resolves the initial whitelist decision. The approved product policies above supersede incompatible draft-framework behavior. They are not an implementation or qualification certificate, a claim of independence, or permission to enable funded operation before the required integration and acceptance.
