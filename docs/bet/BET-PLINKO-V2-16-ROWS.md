# 420Bet Plinko V2 — 7–16 rows / 8–17 buckets

## Versioning and scope

V1 is retained, unmodified, at 12 rows and 13 buckets. V2 is a new resolver and new authority, with separate gameVersionId, rulesetId, PARAMS_DOMAIN, PATH_DOMAIN, client entry points and canonical settlement.

V2 accepts row counts 7..16 (each row corresponds to one independent left/right decision) and three risk tiers (0 Soundcheck, 1 Showtime, 2 Riot). Every wager commits rows, risk, and a fixed array of 17 gross payouts; cells indexed above the chosen row count **must be zero**. There are rows + 1 reachable buckets, indexed 0..rows. The 16-bit path encodes up to 16 independent binary decisions.

The V2 authority approves exactly one multiplier schedule (in basis points) per (rows,risk) pair. Approval requires ACTION_GAME_ACTIVATE scoped to the game version and is irrevocable for that configuration. Unapproved pairs cannot be wagered through `placePlinkoV2Wager`. A separate registered module and game version are required; the V2 authority and resolver cannot occupy a version already bound to V1.

## Acceptance and settlement

`WagerRouter420.bindPlinkoV2Paytable` authorizes and binds the V2 module and its authority; `placePlinkoV2Wager` verifies the exact schedule, stake-scaled gross payouts, ruleset and params hash **before** accepting and reserving liability. `SettlementEngine420.bindPlinkoV2Resolver` and `settlePlinkoV2` compute and settle canonical outcomes. Generic settlement remains prohibited.

Gross payout is not net profit: values below the stake are LOSS (including nonzero partial returns), equal stake is PUSH, and values above the stake are WIN. This permits <1x centre buckets while remaining compatible with settlement accounting. Maximum gross payout must equal the maximum of reachable buckets and be fully liability-reserved subject to configured risk limits.

Each ball is one canonical wager. A browser multi-ball batch of 5/10/25 **does not** represent a single on-chain wager and must invoke multiple independent authorized wager lifecycles if enabled for live play.

## Economic qualification required

The contracts **do not certify any RTP**. The payout tables must be independently approved and verified at all 30 supported (10 row counts × 3 risks) combinations. With independent 50/50 decisions, terminal bucket probability is `C(rows,bucket)/2^rows`; calculate theoretical gross return as `sum(p(bucket) * multiplierBps(bucket)/10000)`. Check centre and edge ordering across risk tiers, rounded unit payouts, worst-case liability, bankroll limits, and the applicable jurisdictional and governance approvals before activation.

The companion browser PR #1117 extends its practice-only choices to 17 buckets. Its illustrative paytable is not a live authority. Production activation and live-bet integration remain blocked until V2 tests, deterministic replay, authorization, gas, and settlement qualification pass.
