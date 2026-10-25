# Fantasy format frameworks V1

## Current approved implementation

The original draft-library checkpoint below is retained as history. It is superseded for approved NHL operation by [approved V1 rules](BET-FANTASY-APPROVED-RULES-V1.md) and [canonical funded implementation and local qualification](BET-FANTASY-APPROVED-IMPLEMENTATION-V1.md). Salary/captain, all four season modes, and separate peer/house pick'em now have funded contracts and confidential client/custodian adapters. The original 56 framework tests and their evidence remain limited to their original source and scope. Production governance, official/live acceptance and new-format webpages remain separate.

## Historical decision and scope

On 2026-10-25 the user reopened H07–H09 for local framework implementation. NHL points modes reuse `NHL_DAILY_V1`, including the existing strict field validation, special-teams points and milestone bonuses. New roster, salary, season, category and pick'em defaults remain **drafts**. Both peer-funded and house-backed pick'em models are supported with separate liability accounting. This supersedes the earlier instruction to defer these frameworks until testnet launch.

Executable code is in `clients/420bet-fantasy/formats/`. This is a domain framework with real arithmetic, state transitions and cryptographic transport. It is not a new deployed contest host. Its result statements are reproducible candidate digests, not signatures, authorized oracle results or spend permissions. All input configuration and facts are supplied by a trusted embedding host; this library is not an authentication boundary. The ledger classes model funds in integer smallest units and do not transfer $420.

The existing daily seven-player host, custodian receipt ABI and client remain unchanged. Their qualification cannot be extended to nine-player salary or six-player captain contests by renaming a profile.

## Implemented interfaces

| Module | Executable behavior |
| --- | --- |
| `core.py` | Defensive versioned rule copies; immutable sport/position/salary/event snapshots; registered sport scoring; exact rational arithmetic; tied-rank pooling, deterministic residuals, explicit fees and two-entrant override |
| `salary.py` | Configurable position slots, unique athletes, frozen prices, exact cap checks, minimum teams and per-team limits; one captain with separately configured rational salary/score multipliers; one canonical user entry, monotonic edits, whole-slate lock and context-bound scoring |
| `season.py` | Exclusive roster ownership; snake draft turns and timed autopicks; atomic batch validation and rolling waiver priority; bilateral trades/deadlines/capacity; active-period roster freeze; position-based active lineups; pre-lock matchup schedules; correction revisions and finality; total points, H2H points, H2H categories and roto |
| `pickem.py` | Immutable metric/line/side cards; per-market locks; duplicate/opposite selection checks; explicit correlation groups; missing/final/participation checks; configurable push and DNP treatment; complete void-reduction payout tables; independent peer and house liability models |
| `transport.py` | Variable 1–32 athlete encrypted submissions using real X25519, HKDF-SHA256 and AES-GCM; contest/profile/snapshot/user/edit context; secret salt and commitment verification; tamper/replay rejection |

The API requires explicit policies rather than silently selecting defaults. `Rules.freeze` admits only `draft` and `test-only` status. Production approval is an external governance decision and is not implemented by changing that string.

`drafts.py` supplies reviewable discussion presets for nine-slot salary, six-slot captain, the four season modes and pick'em. The numbers are deliberately not approved: the draft cap, team limits, multipliers, category minimum and gross payout examples require separate selection. Season timestamp placeholders must be replaced with published UTC dates. Creating a draft does not register a contract or grant authority.

### Salary and captain boundaries

Salary units are configuration units, not an implied dollar conversion. Multipliers use exact fractions; a half-unit salary is not rounded down to evade the cap. Scores retain exact fractions until final prize allocation. NHL scores use the inherited **tenths-of-a-point** unit. The same base scorer applies to both points formats.

Slots and team restrictions are published with the snapshot. Nine-slot salary and six-slot captain layouts discussed in the hockey roadmap remain candidates, not approved settings. No automatic salary generation, discretionary repricing, late swaps or extra-entry policy is introduced.

### Season boundaries

Period boundaries are explicit UTC timestamps; a future schedule publisher must convert local time/DST before committing them. Periods cannot overlap, and corrections cannot overwrite an equal/older revision or run beyond the cutoff. Final rankings require every period and closed correction windows.

The initial executable policy freezes roster transactions during active periods. Trades/waivers invalidate affected future lineups so dropped players cannot continue scoring; historical locked lineups survive later trades. Waivers use one claim per user per batch and initial free-agent availability. A host must authenticate and publish claims before invoking the batch. Autopicks require the actual turn timeout; the host must commit its ordered ranking before the draft to prevent discretionary selection after observing play.

Category profiles explicitly name numerator, optional denominator, direction and participation minimum. Ratios aggregate **total numerators / total denominators**, never averages of game percentages. Negative denominators are rejected. Ineligible ratios receive zero roto points; one eligible H2H side defeats an ineligible side; both ineligible sides earn no point. H2H ties earn one-half each; roto tied ranks average occupied points. These are implemented draft policies requiring approval.

Auction, keeper/dynasty, IR eligibility, multi-claim waiver bidding and mid-period player-specific lock variants are separate extensions. They are not silently enabled.

### Pick'em and liability boundaries

Each market commits event, subject, metric, exact line, lock and correlation group. A successful host oracle check must bind these facts before calling the grader. `final=false`, absent metrics, wrong market hashes and incomplete participation remain unresolved; they never become zero or an automatic loss. DNP and push behavior is explicit (`void` or `loss`). Void reduction never consults a new price: all `(active legs, wins)` gross multipliers must already exist. All void returns the stake.

**Peer pools:** the reference ledger permits only entry contributions plus a separately contributed launcher prize. At least two entrants are required; one entry per canonical user; same profile, market universe and leg count. Draft ranking is number of winning legs, with exact tied-rank allocation. Fees and payout weights are explicit configuration; free pools cannot deduct a fee. The ledger returns full original entry contributions and the launcher prize on cancellation; an entirely void pool cancels without fees. No house payout multiplier is promised by this model.

**House tickets:** the ledger reserves the ceiling of stake times the maximum published **gross** multiplier, at least the full refund amount. Reserve sufficiency includes new stake, existing gross reserves and outstanding beneficiary credits. Correlated tickets do not net against each other. House withdrawals cannot consume reserves or credits. Grading releases the ticket reserve and creates a beneficiary credit; unresolved grading retains the entire reserve. Claims reduce cash and credit together. This is conservative solvency arithmetic, not an independently approved risk policy or funded token escrow.

The host must authorize cancellation/settlement, enforce finality and disputes, handle oracle outage/timeouts, and atomically reconcile the model with canonical escrow. The library does not permit a caller-supplied boolean to impersonate dispute approval.

## Remaining implementation versus live acceptance

| Next work | Dependency |
| --- | --- |
| Approve exact draft roster/cap/multipliers, season policies, category profiles, lines/void treatment, peer ranking and house prices/risk limits | Product/risk decisions; no running network required |
| New variable-roster canonical contract hosts, immutable manifest ABI, admission receipts, bounded authority, oracle consumers and dispute-host integration | Local implementation and funded adversarial Level 2; **not testnet-only** |
| Extend custodian durable storage/release and wallet clients for these profiles, season ownership and pick cards; authenticate users and facts | Local implementation and browser/Anvil Level 2; **not testnet-only** |
| Deterministic salary/line publishers, committed autopick rankings, authenticated waiver queues, source mapping and operational recovery | Local implementation plus source rights/authority decisions |
| Official deployment, finalized identities/receipts, prospective provider reports and live funded dispute/payout evidence | TN-FAN-01–05 plus a separate approved-format acceptance record |
| Cross-format independent review and milestone acceptance | Level 3 at the application phase boundary, after funded Level 2 |

Daily NHL remains the opening live test configuration. These draft frameworks do not expand the approved funded launch scope.

## Adding another sport

Shared roster, rank, draft, encryption and liability algorithms contain no hardcoded NHL positions. `SportRegistry` requires an explicit sport/scoring version and complete raw fields. An executed synthetic second-sport case demonstrates reuse of the same salary engine; it is not a real sport's approved scoring profile.

For a similar team-slate sport, most new work is an adapter and configuration: competition/event/athlete IDs and mapping epochs; original schedules and positions; complete raw fields/units; participation and event finality; corrections; approved scoring/category/market profiles; provider rights and replay fixtures. Confirm that the existing horizon/lock model fits. Sports organized around innings, sets, heats, races or multi-day tournaments may need new period, participation and cancellation semantics. That is a larger domain change, while custody, identity, disputes and conservation remain reusable. Relative effort follows those differences, not merely the number of statistic fields.

## Qualification

Run `python scripts/fantasy/qualify-format-frameworks.py --output artifacts/fantasy-formats` with the existing fantasy requirements installed. The runner executes the explicit framework inventory and all 77 inherited client/provider tests. It fails on dirty/untracked scoped source, skipped/missing cases, failed commands or SHA drift, and emits raw logs plus source/evidence SHA-256 and exact Git SHA.

This is **Level 1 domain qualification**. It must never be described as funded Level 2, official testnet acceptance or production approval. The focused workflow uses the checked-out event SHA. No unrelated global qualification is dispatched.
