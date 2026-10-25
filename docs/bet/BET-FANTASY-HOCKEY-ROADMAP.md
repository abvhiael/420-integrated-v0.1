# 5B.1 - Hockey fantasy framework mini-roadmap

Research began 2026-10-24. Current status: daily NHL contract engine implemented and merged; Sportradar scoring normalization and canonical oracle/scorer integration implemented with scoped Level 1/2 evidence on the testing branch. Other formats remain open. The consolidated specifications and current evidence below supersede older proposed/open decision-log wording for the daily format.

Hockey is the selected starting sport. NHL regular-season hockey is the proposed first coverage boundary. Playoffs, preseason, international competitions and other leagues require explicit coverage and rules versions. Numeric scoring presets below remain discussion candidates.

## Shared framework

Daily describes the contest horizon; salary cap describes roster construction. They can coexist. Implement shared identities, statistics, scoring and settlement primitives, then compose formats rather than creating four incompatible engines.

The common model should contain:

- A competition/event/athlete registry with stable internal IDs, provider mappings, mapping epochs and position eligibility snapshots.
- A versioned raw-stat schema: units, null versus zero, event status, source provenance, source timestamps and correction revision.
- Immutable scoring profiles: weights, signed values, bonus thresholds, category direction, ratio formulas, rounding and source-reference capture hashes.
- Contest manifests committing the slate, roster rules, salary snapshot, lock rules, scoring profile, data policy, payout table, cancellation policy and deadlines before entry funding.
- A roster and entry authorization layer with explicit ownership, asset accounting and bounded authority.
- Separate provisional scoring, accepted final statistics, deterministic ranking and atomic payout/refund stages.

Rules changes create a new profile version. Existing funded contests retain their original rules. Provider fantasy-points totals are comparison inputs; our engine computes scores from the selected raw statistics.

## Mini-roadmap inside 5B.1

Current scoped status is recorded below; no row is closed for every fantasy format. Daily contract/runtime evidence does not imply an application client, production custodian service or live funded testnet acceptance.

- Daily contract engine: [consolidated rules](BET-FANTASY-CONTEST-ENGINE-V1.md), merged PR #822.
- Daily scoring/source-to-oracle integration: [implementation and field rules](BET-FANTASY-SPORTRADAR-SCORING-ORACLE.md), exact head `3a4379e6ef76599e35151416403d2978c99c3bf9`, [Level 2 run](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40166254483); branch reconciliation/merge remains separate.
- Official deployment and prospective live funded settlement: moved to [420Bet testnet roadmap, TN-FAN-01 through TN-FAN-05](../420BET-TESTNET-WORK-ROADMAP.md#daily-nhl-fantasy--official-testnet-deployment-and-live-settlement-qualification).
- **Daily application implementation:** confidential lineup custody, wallet client and isolated browser/ERC20 integration runner are in [daily application](../../clients/420bet-fantasy/daily/README.md). The runner requires actual execution and a clean source SHA for a Level 2 certificate; official-network operations remain TN-FAN-01–05.
- **Opening fantasy test scope (2026-10-25):** use the established uncapped seven-position daily NHL points pool for initial testing. Paid and launcher-funded free pools are configurations of this one format.
- **Next:** prepare and execute TN-FAN-01–05 for this daily format when the official testnet is running. H07 salary-cap/captain, H08 season-long and H09 pick'em are explicitly deferred until after testnet is running; resume their rule discussions and implementation as separately qualified integrations. Deferral does not mark them complete.

| ID | Work | Completion evidence |
|---|---|---|
| 5B.1-H01 | Freeze NHL scope and format matrix | Approved competition, season type, contest horizon and roster/scoring/payout combinations |
| 5B.1-H02 | Evaluate data providers and rights | Field-level sample comparison, measured latency, correction history, ID mapping and written permitted-use coverage |
| 5B.1-H03 | Specify canonical hockey data | Schemas, event transitions, revisions, missing-data handling and replayable normalization fixtures |
| 5B.1-H04 | Specify scoring profile versions | Captured reference rules, explicit deviations, exact arithmetic and independently calculated example results |
| 5B.1-H05 | Specify common contest lifecycle | Entry/lock/finality/challenge/settlement/refund transitions, role boundaries and custody invariants |
| 5B.1-H06 | Daily and single-event framework | Daily contract roster/slate/escrow/scoring/dispute engine implemented and scoped-qualified. Confidential custodian service and daily application/client are implemented with an executable local browser/Anvil qualification path; prospective funded deployment/settlement is TN-FAN-01–05. Single-event variant decisions remain open. |
| 5B.1-H07 | Salary-cap and captain variants | DEFERRED until testnet is running. Salary/position/captain decisions, frozen snapshots, implementation and focused qualification |
| 5B.1-H08 | Season-long framework | DEFERRED until testnet is running. Points, H2H and category/roto decisions; draft/waiver/period rules; implementation and focused qualification |
| 5B.1-H09 | Pick'em framework | DEFERRED until testnet is running. Metric/line/void/payout decisions, liability boundaries, implementation and focused qualification |
| 5B.1-H10 | Oracle and cross-format acceptance | Daily Sportradar field normalization and canonical oracle/scorer connection implemented and scoped-qualified. Official-network acceptance is TN-FAN-01–05; cross-format integration and independent-source acceptance remain open. |

H01-H05 establish shared contracts and interfaces. H06-H09 each follow: discuss scoring and boundaries, approve a precise version, implement the framework, execute tests, then qualify. Provider evaluation and schema design can proceed alongside format discussions. Live provider and official-chain acceptance belongs in the testnet roadmap; local implementation and replay qualification need not wait for an active testnet.

## Format 1: daily and single-event points pools

Proposed first deliverable: a peer-funded NHL points pool with a fixed slate and published payout table. Distinguish a one-game roster from a multi-game slate; they cannot share identical team-diversity limits.

Proposed boundaries:

- Freeze eligible events, athletes and positions before entries. Lock the whole lineup at a published deadline before the earliest scheduled game; no late swap in the initial version.
- Reject duplicate athletes and invalid positions. Publish entry limits, minimum entrants, fees, maximum liability and refund conditions.
- Count regulation and overtime under the selected profile. Handle shootout statistics separately.
- Use deterministic ties and allocation of indivisible payout units. The pool cannot distribute more than funded escrow.
- Define DNP, scratched players, late starts, early starts, postponements and canceled games before entries open. No discretionary replacement after results become known.

Scoring discussion: goals/assists versus shots and blocks; hits and penalty minutes; special-teams bonuses; goalie saves, goals against, wins and shutouts; threshold bonuses and stacking. Start with a simple linear profile, then decide whether milestone bonuses justify another version.

Reference families: FanDuel NHL points and the independently verified DraftKings Pick6 NHL scoring page. Pick6 is not evidence of DraftKings Classic or Showdown rules. Capture those exact current rules separately before claiming compatibility.

## Format 2: salary-cap DFS and single-game captain

Reuse the daily slate and points engine. Add a versioned salary and position snapshot, deterministic lineup-cost calculation and roster legality checks.

Discussion candidates, not approved defaults:

- Multi-game: 50,000 internal salary credits; 2 C, 3 W, 2 D, 1 G and 1 UTIL. Specify UTIL eligibility and dual-position handling.
- Multi-game diversity: consider at least three teams and at most four players from one team; evaluate this against slate size. A one-game contest needs a separate policy.
- Single-game: consider six unique players drawn from both teams and one captain with 3/2 scoring and salary multipliers. This is a proposed 420Bet design, not a verified statement of another operator's current rules.

Salary credits are roster constraints, not redeemable funds. Freeze salary values and positional eligibility before entry; record their origin and redistribution rights. Do not require projections to settle a contest. Apply rational multipliers exactly and define rounding once. A captain cannot also occupy a flex slot.

Decide whether salary tables are internally generated or licensed, whether goalies are eligible in each variant, maximum entries per person, lineup visibility, tie allocation and whether later versions support late swaps.

## Format 3: season-long leagues

Build one league lifecycle with distinct scoring modes:

| Mode | Ranking rule | Additional decisions |
|---|---|---|
| Season total points | Sum versioned athlete points across the season | Roster activation, games caps, season cutoff |
| H2H points | Compare weekly/period points against an opponent | Schedule, tied matchups, playoffs, seeding |
| H2H categories | Compare each selected category per matchup | Category ties, one-win versus category-win standings |
| Rotisserie | Rank season aggregates per category, then combine rank points | Tied ranks, minimum participation, category direction |

Start with snake drafts; auction drafts and keeper/dynasty mechanics are extensions requiring their own budgets and long-term obligations. Decide roster size, benches, injured-reserve eligibility, exclusive athlete ownership, draft timeouts/autopicks, waiver priority or FAAB, trade deadlines and review authority.

Freeze scoring for the paid season. Commissioner permissions must not permit retroactive scoring edits or arbitrary withdrawal of league funds. Specify canceled-season handling and league dissolution.

Periods need explicit UTC boundaries and sport-local calendar/DST semantics. Decide goalie minimum starts, maximum games, stat-correction deadlines and playoff tiebreakers.

For ratio categories, compare aggregate fractions exactly: save percentage = total saves / total shots against; GAA = 3600 * total goals against / total seconds played. Never average per-game ratios. Define zero denominators, minimum eligibility, ties and lower-is-better categories. Yahoo and ESPN provide useful format references; exact numeric profiles require separate captured settings and approval.

## Format 4: pick'em / selection contests

Use a separate selection and payout engine sharing canonical hockey facts. Initial scope should be a funded peer pool with fixed lines and explicit scoring/ranking. House-backed fixed multipliers require a separate funded-liability model and approval.

Freeze eligible athletes, metrics, lines, selection deadline, allowed combinations and payout/void tables before entry. Candidate metrics include goals, assists, shots, blocks and goalie saves. Specify whether a goalie must start, whether partial participation qualifies, and how injury, DNP, pushes and postponed games affect a selection.

A void leg may reduce the number of legs only through a precommitted payout table; otherwise apply the predeclared refund rule. No repricing after outcomes. Decide correlated selections, duplicate athletes, opposing selections and maximum exposure. Do not assume the product's legal classification merely from the fantasy label.

## Cross-format hockey boundaries

- Official ordinary goals, shots and saves are distinct from shootout events. Profiles may score a separate shootout metric explicitly.
- Define goalie win, overtime loss, relief appearances, shutout eligibility and empty-net treatment from named source fields; do not infer goalie goals against from the team's score.
- Specify bonus threshold frequency and stacking. A power-play goal and a power-play point can create double counting unless explicitly intended.
- Allow negative athlete scores. Use bounded signed arithmetic and explicit fixed-point/rational units, separate from unsigned escrow amounts.
- Missing or conflicting statistics are unresolved data, not zero. Define a bounded recovery deadline and cancellation/refund path.
- Provisional scores may change before finality. Choose correction and challenge windows per format; a provider's Final/Closed status is not a promise of no later corrections. A 24-hour correction window plus a 24-hour challenge window is only a discussion candidate, not an adopted rule.
- Define whether suspended/rescheduled games remain in their original slate or period. Do not move them after results to improve a payout.
- A published lock must address actual early puck drop and delayed reporting. Block timestamps alone cannot prove that play has not begun.
- Decide roster privacy honestly: plaintext on-chain lineups are public. Commit/reveal designs need legality checks and a bounded reveal policy that prevents selective non-reveal after outcomes; a hash alone does not solve fairness.

## Selected testing provider — Sportradar NHL

Decision: use Sportradar NHL API v7 trial access for development and testing. Defer evaluation of alternate providers until the userbase begins to grow. This selection does not assert an active account, an issued API key, successful live ingestion or production licensing. See [testing runbook](BET-FANTASY-SPORTRADAR-TESTING.md).

Use the existing provider-neutral oracle/contest interfaces. Keep official NHL evidence precedence and all frozen pool/source-policy identities unchanged. A single Sportradar upstream with multiple reporters is single-source testing, not independent multi-provider qualification. Alternate-provider procurement below is deferred.

## External data recommendation

| Candidate | Recommended role | Conditions still to establish |
|---|---|---|
| Sportradar NHL | Preferred primary production candidate | Contract, permitted fantasy and chain use, sample fields, corrections, latency/SLA and failure behavior |
| SportsDataIO NHL | Fantasy slate/salary support and secondary validation candidate | Licensed real-data access, metric equivalence, salary rights and upstream independence |
| Stats Perform / Opta | Alternate procurement comparison | Actual NHL field-level coverage, IDs, delivery, correction semantics and rights |

Sportradar identifies itself as an official NHL data partner and exposes NHL event and statistical feeds. Its documentation describes validation and later reconciliation, so provisional data needs a revision policy. [NHL API overview](https://developer.sportradar.com/ice-hockey/reference/nhl-overview).

SportsDataIO documents NHL statistics and fantasy data, and warns that final box scores can receive corrections. Its trial may contain scrambled statistics; those cannot settle contests or establish scoring accuracy. Historical replay is useful integration evidence, not live-provider evidence. [NHL API](https://sportsdata.io/developers/api-documentation/nhl), [scrambled data](https://sportsdata.io/help/scrambled-data), [historical replay](https://sportsdata.io/help/historical-data-integration-guide).

Stats Perform documents general structured sports-data delivery. That alone does not establish NHL equivalence. [API delivery FAQ](https://www.statsperform.com/stats-perform-faqs-apis-and-data-delivery/).

Evaluate field coverage, identifier stability, official versus derived metrics, correction history, outage behavior and measured latency using representative games, including overtime, shootouts, relief goalies and postponements. Confirm paid-contest rights, storage/replay retention and public-chain redistribution/commitment rights in writing. Costs and actual contracted service levels remain unknown. No subscription or outreach is authorized by this roadmap.

## Oracle recommendation

Keep the existing provider-neutral 420Oracle interface canonical. The repository's Oracle model already separates adapters, provider/feed registries, risk policies and consumer reads. These shared primitives do not constitute an implemented hockey adapter.

Proposed sports adapters normalize a specific stat revision and commit its digest/root through exact-result QUORUM_EQUAL aggregation. Sports facts must not be averaged with MEDIAN_NUMERIC. Require a successful canonical IOracle420 read before accepting a snapshot, with feed/source epochs and freshness checked. Align normalization and revision cutoffs so honest sources can agree on identical bytes.

Bind reports and scoring results to chain, contest, competition, event, athlete mapping epoch, period, data policy, revision, stat root, scoring profile and roster commitments. Separate reporting, scoring, dispute and settlement authorities. Reporters cannot change rules or choose arbitrary payouts.

Different node keys do not establish independent source data. Two vendors may share NHL upstream facts. Document beneficial control and provenance, and state whether a quorum protects transport, reporter honesty or independently observed facts. Do not silently switch sources after seeing results.

After finalization, claims should use the immutable accepted root; releasing earned funds must not require the live feed to remain fresh forever.

- Chainlink CRE is an optional transport/execution candidate, subject to supported-chain deployment, access, report verification, secrets, licensing, latency and cost validation. A network of nodes reading one API still has one upstream data source. Do not start a new Chainlink Functions integration: its documentation reports mainnet deprecation on June 30, 2026. [CRE](https://docs.chain.link/cre), [Functions status](https://docs.chain.link/chainlink-functions).
- UMA Optimistic Oracle V3 is an optional bonded challenge mechanism, not a live NHL statistics feed. Confirm deployment/bridge support, accessible evidence, challenge duration and bond economics relative to contest liabilities. No native 420-chain availability has been established. [OOv3](https://docs.uma.xyz/developers/optimistic-oracle-v3).

Cryptographic report authenticity and reproducible scoring do not establish that a real-world statistic is correct. Disputes require a named evidence hierarchy, bounded resolution authority, deadlines and a funded/refund recovery policy.

## Scoring reference capture and discussion order

1. Daily/single-event: select core skater and goalie weights, peripheral stats and bonus policy.
2. Salary cap/captain: choose roster and budget, reuse or deliberately fork the points version, then set multipliers and rounding.
3. Season-long: select total points, H2H points, categories and roto presets individually; settle ratios, waivers and period policies.
4. Pick'em: choose metrics, participation/void semantics, lines and payout model independently of lineup points.

Use popular formats as references with explicit deviations; do not imply endorsement or exact compatibility. Archive the precise source/settings, capture date and content hash when freezing a preset. Verified reference pages:

- [FanDuel rules](https://www.fanduel.com/rules): hockey scoring reference.
- [DraftKings Pick6 NHL](https://pick6.draftkings.com/pick6-rules-and-scoring-nhl): verified Pick6 reference only; current Classic and Showdown capture remains pending.
- [Yahoo scoring formats](https://help.yahoo.com/kb/fantasy-hockey/scoring-types-formats-fantasy-sports-sln6868.html): points, H2H and category/roto format references.
- [ESPN scoring settings](https://support.espn.com/hc/en-us/articles/360000069512-Scoring-Settings): configurable scoring reference; commissioner mutability is not adopted for funded contests.

## Qualification and exit conditions

5B.1 architecture completion requires approved format specifications, data schemas, profile versions, provider/oracle decisions and executable acceptance plans. Implementation and runtime qualification must be recorded separately as they occur.

Use the repository's three-level qualification model without waiving any acceptance conditions. Level 1 should execute focused arithmetic, roster, lifecycle, normalization and invariant tests. Level 2 should execute integrated funded contests and adversarial source/revision/settlement cases against an exact SHA with raw execution evidence. Official testnet/live milestone acceptance remains a separately tracked gate under the repository model, including independent review requirements.

Required future cases include malformed/duplicate athletes, late or unauthorized entry, salary overflow, signed-score bounds, category denominator edges, false bonuses, cross-contest reports, stale epochs, replayed reports, conflicting revisions, missing metrics, fraudulent provider aliases, outage recovery, late corrections, duplicate claims, tied rankings, partial refunds and per-asset conservation. Verify source normalization and scoring independently from the implementation under test. Preserve inherited green evidence only when its source identities remain applicable.

No current row is qualified merely by this document. No production feed, oracle deployment, proof of licensing, paid contest or implementation test result is claimed.

## Decision update - 2026-10-24

User selected DraftKings-inspired daily points scoring, including special-teams and milestone bonuses. See [Daily NHL scoring v0.1](BET-FANTASY-DAILY-NHL-V0.1.md). Numeric baseline and explicit 420Bet interpretations are documented there; other format scoring and contest lifecycle decisions remain open.

Daily lineup decision: user selected C, LW, RW, D, D, G and FLEX (seven unique athletes). FLEX is confirmed as skater-only: C/LW/RW/D; no goalies. This supersedes the daily profile's previous roster discussion candidates; other formats remain separate decisions.


Daily roster construction confirmed: uncapped; any seven unique eligible athletes filling C/LW/RW/D/D/G/FLEX, with skater-only FLEX. No team-diversity restrictions. Salary-cap contests remain a separate format workstream.

Daily lineup management confirmed: no bench; lineup edits allowed until the first game locks the entire slate lineup; no late swaps or substitutions after lock. Operational timing and exceptional event policies remain open.

Daily individual-DNP policy confirmed: scratched players and goalies who never play score zero, with no automatic replacement. Confirmed non-participation is distinct from missing source data and canceled-game policy.

Daily entry limit confirmed: one lineup per user per pool; additional entries may be made in separate pools. Pre-lock edits update the existing entry. User identity binding and multi-wallet enforcement require an explicit implementation policy.

Daily payouts confirmed: configurable per pool, published and frozen before entries open. Paid ranks, allocations and fees must be explicit and bounded by funded escrow. Tie allocation, minimum entrants and rounding remain open.

Daily tie allocation confirmed: combine prizes for occupied ranks and split equally across tied entries, including ties spanning paid and unpaid ranks. Subsequent ranks advance by the tie-group size. Indivisible-unit rounding remains open.

Daily minimum confirmed: two distinct valid funded entrants at lock. If fewer qualify, cancel and refund all entry payments. A higher configurable minimum is not adopted.

Daily entry fees confirmed: configurable per pool, published and frozen before entries open, with total payment, prize contribution and any operator deduction separately disclosed. No platform deduction rate is selected.

Daily maximum entrants confirmed: uncapped by default; an optional cap of at least two may be published and frozen before entries open. Entry acceptance must enforce the cap atomically.

Daily withdrawals confirmed: no voluntary withdrawal after an entry is accepted and funded. Pre-lock lineup edits remain allowed; canceled pools refund the full entry payment, including fees.

Daily lineup visibility confirmed: hidden from other entrants before lock, visible after lock. Requires actual submission confidentiality and a publication mechanism preventing selective non-reveal; UI hiding alone does not satisfy this rule.

Daily postponed-game policy confirmed: include only games completed within the published, fixed scoring window; excluded games contribute zero. If all slate games are excluded, cancel and refund all entry payments. Exact window and suspended/shortened-game policy remain open.

Daily scoring cutoff confirmed: 11:59 p.m. America/New_York on the day after the slate's last originally scheduled game, converted to an exact published UTC cutoff before entry. Original schedule and cutoff remain fixed; correction/challenge deadlines are separate.

Daily suspended-game policy confirmed: count the full game only if officially completed within the fixed window; otherwise exclude all of its statistics. Completion after cutoff does not restore eligibility. Officially final shortened games remain open.

Daily shortened-game policy confirmed: games officially declared final by the NHL within the fixed scoring window count using official statistics as played, without score prorating. Profile-specific bonus eligibility still applies.

Daily correction/finality windows confirmed: 24 hours after conclusive slate resolution for statistics corrections, then 24 hours for challenges before payout. Publish the candidate revision and evidence; unresolved timely challenges or unavailable evidence prevent settlement. Bounded dispute/recovery procedures remain to be designed.

Daily pool access confirmed: configurable public or private/invite-only per pool, with access mode frozen before entries open. Private entry requires enforceable invitation authorization; all existing entry, payment and lock rules still apply.

Daily slate selection confirmed: pool creators choose platform-published NHL slates only; no custom slates. Freeze the selected slate version before entries open and apply the agreed event-exclusion policies to subsequent schedule changes.

Daily scoring governance confirmed: one shared platform-approved scoring profile per applicable version, with no creator customization. Future changes publish a new version; existing pools retain their committed profile.

Daily pool creation rollout confirmed: authorized platform administrators only at launch. User-created pools are a later milestone after operational readiness and a separately qualified, explicitly activated permission expansion. User entry into eligible pools remains allowed.

Daily free/paid pool policy confirmed: both supported. Free pools offer no monetary prize unless the launcher escrows the entire prize at launch. Paid pools allocate 3% of gross accepted entry contributions to the dev compensation fund and 97% to prizes, with no additional deduction approved. Keep the allocation escrowed until settlement; canceled pools refund the full paid entry amount and return launcher-funded free prizes. Two valid free entrants satisfy the minimum without entry payments.

Daily denomination confirmed: canonical $420 only for paid entries, launcher-funded free prizes, escrow, payouts, refunds and the 3% dev compensation allocation. Bind the actual deployment asset identity and decimals; no mixed assets or implicit fiat conversion.

Daily operational lock confirmed: freeze entries and edits at the first originally scheduled puck drop, with an exact published UTC deadline and no extensions for delays. An early start triggers immediate closure on detection; recovery for entries or edits accepted after actual start remains a required policy decision.

Daily early-start recovery confirmed: cancel an affected pool if any entry or lineup edit was accepted after actual puck drop of an early-starting game. Refund all entry payments including the reserved 3%; return launcher-funded free prizes. Resolve timing evidence before payouts.

Daily dispute authority confirmed: authorized platform administrators initially, with evidence-backed, reasoned and auditable decisions applying immutable pool rules. Resolution grants no arbitrary escrow access; deadlines, conflicts and recovery remain to be specified.

Daily results challenge bond selected: 50% of the pool's published total per-user entry fee in $420, separately escrowed. Upheld claims receive a full bond return; denied claims send the full bond to the community fund. Free pools use the separately approved 10% of launch prize escrow formula.

Daily free-pool challenge bond confirmed: 10% of the committed launcher-funded prize escrow at launch, supplied separately by the challenger in $420. Return fully if upheld; send fully to the community fund if denied. Free pools with no prize escrow yield a zero bond; no minimum is adopted.


Daily dispute architecture update: 72-hour resolution deadline after the original challenge window, then cancellation/recovery if no valid result. Add scoped, revocable delegation to authorized verified users for later activation, with conflict checks and no custody privileges. Build a shared dispute controller for bonds, windows, authenticated objective checks, authorized decisions, finality and timeout recovery; factual source conflicts retain authorized human adjudication. Implementation and qualification remain future work.


## Controller implementation progress

Historical status at the dispute-only checkpoint (superseded for daily runtime implementation by the current status above): the dispute controller was implemented first; the integrated daily host/scoring/payout engine and Sportradar source-to-oracle work have since been implemented. H10 remains open for cross-format and official-network acceptance; see [Fantasy disputes V1](BET-FANTASY-DISPUTES-V1.md). Source precedence is approved: official NHL evidence, then Sportradar, then SportsDataIO, under the documented cutoff, fallback and fail-closed rules. This does not close 5B.1 or qualify full fantasy Level 2.


Daily monetary rounding approved: floor the 3% development allocation once over gross accepted paid entries; distribute all prize units using exact entitlements, final floor rounding and deterministic residual units by immutable entry ID. Retain upward rounding for challenge bonds. Refund original amounts exactly. Contest-engine implementation and qualification remain open.


Daily two-entrant payout rule approved: exactly two qualifying entrants at lock makes the pool winner-take-all, regardless of its standard payout schedule. A tied result splits the distributable prize equally. Publish this override before entry. Paid-pool prizes remain net of the approved 3% allocation.


Daily payout adaptation confirmed: for three or more qualifying entrants, automatically select the entrant-count payout table row published and frozen before entries open. Cover all allowed counts, allocate the whole prize, and prohibit impossible paid ranks. Two entrants remain winner-take-all; fewer than two cancels. Specific table bands and weights are per-pool configuration.


Daily-engine implementation update: [the consolidated V1 specification](BET-FANTASY-CONTEST-ENGINE-V1.md) now maps approved daily rules to actual pool, escrow, encrypted admission/lock, verified scoring, bounded rankings and dispute-gated settlement modules. H06/H10 runtime framework work is implemented; exact scoped qualification evidence is emitted by the contest runner. Licensed live ingestion, deployment and the other format workstreams remain open.
