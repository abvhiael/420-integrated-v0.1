# NHL salary-cap and captain V1 decisions

## Approved roster and budget rules — 2026-10-25

The user explicitly approved the following proposed rules in conversation. This records product decisions, not production authorization, implementation qualification or approval of the remaining draft policies.

| Setting | Multi-game salary cap | Single-game captain |
| --- | --- | --- |
| Budget | 50,000 nonredeemable salary credits | 50,000 nonredeemable salary credits |
| Lineup | 2 C, 3 W, 2 D, 1 G, 1 FLEX; nine unique athletes | 1 captain, 5 flex; six unique athletes |
| Eligibility | W accepts LW/RW; FLEX accepts C/LW/RW/D, no goalie; published dual eligibility allowed | Any position including goalie in captain or flex |
| Team diversity | At least three teams; maximum four athletes per team | Both teams represented; maximum four athletes per team |
| Captain multiplier | None | Exactly 3/2 salary and 3/2 score |
| Entries | One lineup per canonical user per pool | One lineup per canonical user per pool |
| Lock | Whole lineup at first originally scheduled game | Whole lineup before the game |
| Snapshot | Salaries and positions published and frozen before entries open | Salaries and positions published and frozen before entries open |
| Scoring | Existing NHL points profile | Existing NHL points profile |

Salary credits are roster constraints and are not redeemable $420. Captain fractions remain exact during legality and scoring calculations. The existing draft framework encodes these roster candidates, but retains draft status: salary generation, full funding/payout inheritance, exceptional-event policy and complete host integration still need decisions and implementation. No arbitrary approval string should enable a funded deployment.

## Pending decisions

Exact salary formula; salary input provenance, missing data, bounds and rounding; exceptional-start policy details; format-specific funded host, custodian/client and Level 2 qualification. Season-long and pick'em numerical defaults remain drafts and are not approved by this decision.

## Approved publication, funding and protection approach — 2026-10-25

The user subsequently approved this approach for both salary-cap and captain:

- Platform-published salaries calculated using a transparent, versioned historical-NHL-performance formula. Freeze the table before entry; no manual repricing after publication. The exact formula remains a separate decision.
- Canonical $420 funding. Paid pools allocate 3% to the development compensation fund; free-pool prizes require full launcher escrow upfront.
- Minimum two entrants. Exactly two means winner-take-all; larger pools use published payout tables. Tied occupied-rank prizes are shared.
- Inherit the existing daily pool's lineup confidentiality, pre-lock edits, mandatory post-lock publication, challenge bonds, dispute windows and full cancellation refunds. The consolidated daily specification governs exact bond formulas, timing, rounding and beneficiary rules; this does not create alternative versions of those rules.

This product approval does not qualify the future funded salary/captain hosts or activate production. The local framework remains draft pending the remaining exact salary decisions and integration.

## Approved historical salary basis — 2026-10-25

The user approved using each athlete's last ten completed NHL appearances, scored under the existing NHL points profile, and averaging those scores. Confirmed DNPs do not count as appearances. At least five appearances are required; otherwise use a published position-based fallback. Missing or incomplete statistics prevent salary publication rather than becoming zero. Calculate goalies separately from skaters. Publish the input cutoff and formula version with every frozen salary table.

Still pending: salary ranges, performance-to-credit conversion, rounding, exact fallback cohort/value, history coverage and feasibility checks. The approved basis alone does not resolve those parameters or qualify a salary publisher.

## Approved salary ranges, rounding and feasibility — 2026-10-25

The user approved these base salary ranges:

| Format/player | Minimum | Maximum |
| --- | --- | --- |
| Multi-game skaters | 2,500 | 9,000 |
| Multi-game goalies | 6,500 | 8,500 |
| Single-game players, including goalies | 2,000 | 12,000 |

Round base salaries upward to the next 100 credits (exact multiples remain unchanged). Apply the captain's 3/2 salary multiplier exactly, with no further rounding. Both formats retain the approved 50,000-credit budget. Before publication, prove at least one legal lineup fits the budget and all roster/team constraints; otherwise withhold the contest. Historical replay testing remains required before funded qualification.

This supersedes the earlier pending range/rounding/feasibility decisions. The exact performance mapping, limited-history fallback and historical coverage rules remain pending.

## Approved performance mapping and limited-history fallback — 2026-10-25

The user approved comparing historical scoring averages within three separate pricing groups: forwards, defensemen and goalies, using a published NHL-wide player list. Equal averages receive equal percentile ranks. Map the percentile linearly into the applicable format/group salary range, then apply the approved upward base-salary rounding.

Players with fewer than five qualifying appearances use their group's median scoring average. Dual-position athletes have one published pricing group; lineup slot selection cannot change salary. Each pricing group needs at least five established players; otherwise withhold publication. Group membership is published and reproducible, not an entrant-selected pricing input.

Historical coverage and the exact percentile/median arithmetic convention still require a final specification. No particular percentile endpoint or tie formula is implicitly approved by this qualitative mapping decision.

## Approved historical coverage and cutoff — 2026-10-25

Use the last ten qualifying appearances within the 365 days before the published salary cutoff. Initial coverage is NHL regular-season games only, including the previous season where it falls within that window. Exclude preseason, playoffs and other competitions.

Only completed-game statistics and corrections available by the cutoff may enter the salary calculation. Later corrections do not reprice an existing pool. Fewer than five qualifying appearances triggers the approved group-median fallback; missing statistics remain a publication blocker rather than triggering that fallback. Publish cutoff, player-group membership and source-data revision with the salary table.

This resolves historical coverage. Exact percentile/tie and median arithmetic remains the final salary-calculation decision. These decisions do not themselves implement or qualify the publisher.

## Approved exact salary arithmetic — 2026-10-25

The user approved exact fractional historical averages and the following percentile convention. For an established-player group of size N, let B be the count with strictly lower averages and E the count with equal averages. Percentile P = (B + E/2) / N. Include an established athlete themselves in E. Equal averages have equal percentiles. Only established players form the reference group.

For an even-sized group, its median is the exact average of the two middle values. A limited-history athlete uses that median average in the same comparison without being added to the established-player reference group.

For applicable base salary bounds L and U, calculate S = L + P*(U-L), then base salary = 100*ceil(S/100). Captain cost is exactly 3/2 of the rounded base salary with no further rounding. At percentile 1/2, a multi-game forward costs 5,800 credits and a single-game player costs 7,000 credits.

This resolves the exact salary-calculation policy. Publisher implementation, replay calibration, feasibility checks and funded qualification remain separate work. Exceptional event handling is the remaining salary/captain policy discussion before moving to season-long rules.

## Approved exceptional-event inheritance — 2026-10-25

The user approved inheriting the daily pool's event handling for both variants: no late swaps or replacements after lineup lock; confirmed DNPs score zero; count games officially completed within the published scoring window and exclude all statistics from other games. If every game is excluded, cancel and refund in full, including a single-game captain pool whose game is excluded. Cancel and refund if an early start allowed any entry or edit after actual puck drop. Retain the daily correction, challenge and dispute-resolution windows. Salaries and captain multipliers remain frozen throughout.

The existing daily specification supplies exact scoring-window timestamps, shortened/suspended-game treatment, correction/challenge deadlines, bonds and recovery mechanics. Missing data does not become confirmed DNP or an excluded game without the required evidence.

This completes the salary-cap/captain product-policy decisions discussed in this approval sequence. It is not implementation completion, mathematical calibration, funded Level 2 qualification, official-network acceptance or production activation. The executable draft framework and future salary publisher/hosts must be reconciled to these approved decisions and tested before any such claims.
