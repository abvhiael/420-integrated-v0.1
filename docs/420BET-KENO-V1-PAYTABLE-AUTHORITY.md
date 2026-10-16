# BET-AUDIT-4.2 — Keno V1 canonical paytable authority dossier

**Status: APPROVAL REQUIRED — NOT AN APPROVED PAYTABLE.**

**Scope:** 420Bet Keno V1, 80 numbers, 20 unique drawn numbers, player selection of 1–10 unique numbers. This dossier is the controlled request for **independent** authority to approve a canonical, immutable, stake-normalized payout matrix. No approver has signed this artifact, and no production/game-rule authority is created by committing it.

## Repository findings (verified on main at the start of BET-AUDIT-4.2)

- `contracts/src/bet/KenoV1420.sol` binds `pickCount`, ten-slot `picks` and eleven-slot `grossPayoutByHits` into `hashParams`; `requiredMaxGrossPayout` takes the greatest nonzero payout from the submitted schedule and `resolve` reproduces the hit count and selected gross payout.
- `contracts/test/BetKenoV1420.t.sol`, `BetKenoHardening420.t.sol`, `BetKenoV1View420.t.sol` and `BetKenoVerticalSlice420.t.sol` contain illustrative **test fixture** schedules. A tested payout array is not proof of operator-authorized odds.
- No signed canonical table, versioned authority artifact, designated approving actor, or independent approval was established by repository search for Keno paytables, odds and authorization. Absence of a search hit is not proof no artifact exists elsewhere; a qualifying approved source may still be supplied.
- Binding a player's paytable into `paramsHash` and reserving `maxGrossPayout` protects against post-acceptance changes and over-reserve payouts; **it does not authorize arbitrary economic terms**. Keno 4.2 must not certify operator paytable policy merely from these checks.

## Canonical paytable requirements for approval

The independent decision maker must approve a complete matrix, not a fixture copied from a test:

1. **Scope and version**: `420BET.GAME.KENO.V1` and an immutable ruleset/paytable version or hash. Record asset, unit precision, supported stakes, minimum stake, and jurisdiction/environment restrictions.
2. **Full selection coverage**: a row for each `pickCount = 1..10`; columns `hits = 0..pickCount`. Each entry is gross return **including stake** (zero on loss). Unused hit slots must be zero. State whether any `0-hit` award is permitted; current KenoV1 implementation **rejects** a nonzero `grossPayoutByHits[0]`.
3. **Exact odds**: for `n` picks and `k` hits on 20 unique numbers drawn from 80,
   `P(k|n) = C(n,k) * C(80-n,20-k) / C(80,20)` (integer combinatorial calculation, not simulated odds). Record each row's rational RTP `sum_k P(k|n) * grossMultiplier(n,k)` and house edge, including any approved rounding.
4. **Risk envelope**: each row's exact maximum gross payout, net additional-liability reserve `max(0,maxGross-stake)`, stake limit, correlation exposure, and vault solvency relationship. Reject unrepresentable multipliers, integer overflow, invalid fractional token results, payouts in `(0, stake)` (the current contract forbids them), or schedules not reserved at the accepted maximum.
5. **Immutability and authorization**: an independently approved checksum of the complete matrix, on-chain or otherwise enforceable paytable authority binding to the approved `rulesetId`/game version **before wager acceptance**. A UI-only published table or post-hoc signature is insufficient. The existing `KenoV1420` implementation is currently a resolver, **not** a paytable authorization registry.
6. **Outcome settlement**: preserve wager-parameter commitment, canonical randomness root, deterministic 20-unique draw, match count, gross payout, appropriate LOSS/PUSH/WIN, escrow and risk release, one-time terminal settlement, refund/void handling, replay protection and post-settlement verification.
7. **Independent review**: approver must be distinct from the proposer/implementer, authorized by the repository's actual governance or product/operator decision policy. Record verifiable reviewer identity and role, signed decision or approved PR review, decision timestamp, exact table digest, simulation/combinatorial review, permitted networks, and effective date. Do not invent an approver or claim legal/regulatory clearance.

## Required approval record (all blank until evidenced)

| Field | Value |
| --- | --- |
| Approved table version / URI | **PENDING** |
| Complete 1–10-pick gross-return matrix | **PENDING** |
| Expected return and house-edge analysis, independently verified | **PENDING** |
| Maximum liability, token precision and risk limits | **PENDING** |
| Ruleset/authority binding design and enforcement evidence | **PENDING** |
| Designated independent approving authority and evidence of delegation | **PENDING** |
| Signed decision / approved review URL and date | **PENDING** |
| Approved immutable digest (SHA-256 / on-chain hash) | **PENDING** |
| Implementation, tests and exact-SHA Level 1 PASS against approved matrix | **PENDING** |
| Live/testnet release approval | **SEPARATE EXTERNAL GATE** |

## Exit decision

**BET-AUDIT-4.2 economic/paytable approval remains BLOCKED** until the preceding record is completed and independently verifiable. Successful Keno engine or integration CI is separate evidence: it does not close this policy gap. Do **not** label the illustrative five-pick fixture a canonical product paytable or quietly introduce a proposed multiplier matrix into executable rules.

Once an authorized external reviewer has approved a complete matrix, implement its enforceable version/hash binding at wager acceptance and add precise per-row odds, payout, security, maximum-liability and settlement tests; run only directly affected Level 1 owners against the resulting exact implementation SHA. Public real-money activation separately requires the applicable independent licensing, eligibility, responsible-gaming and deployment gates.
