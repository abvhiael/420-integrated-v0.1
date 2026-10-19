# BET-AUDIT-5A.1 — Architecture and Table Authority Level 1 Evidence

**Scope:** Multiplayer poker architecture, versioned cash-game rules, confidential-deal trust model and table authority. This is an **architecture-level** certificate only, not gameplay, money movement, Level 2, Level 3, approved economics or production qualification.

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `audit/420bet-5a-1-poker-architecture-authority-20261018`
- PR: https://github.com/abvhiael/420-integrated-v0.1/pull/736
- Qualified implementation/document/verifier SHA: `0cbb5281a6286bd135b7b7ce6e4a93d37fbbc4f1`
- Workflow: `420Bet Poker Architecture 5A.1 Level 1`
- GitHub Actions: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39183104401
- Job: `117839863216`
- Verified conclusion: **completed / success**, no failed steps.
- Job log evidence: `BET-AUDIT-5A.1 scoped architecture/authority verifier PASS (requirements, existing authority constants and trust gates)`.

## Qualified inputs

1. `docs/bet/BET-AUDIT-5A.1-POKER-ARCHITECTURE.md` defines rule/version identity, 2–9 player no-limit Hold'em cash-game design, individual authority ownership, table capability scopes, privacy/trust boundaries, canonical state and nonces, side-pot conservation, fraud/replay/collusion controls, failure recovery, production gates and Video Poker separation.
2. `scripts/bet/verify-5a-1-poker-architecture.mjs` enforces a scoped architecture-policy surface and checks existing `BetIds420` poker capabilities, `BetAuthorization420.scopeForTable` and `BetTypes420` poker emergency domains.
3. `.github/workflows/420bet-poker-5a-1-level1.yml` checks the exact PR commit SHA and runs only the dedicated local Node verifier.

No Solidity behavior, custody authorization, runtime/deployment manifest, wager acceptance or confidential-card engine changed in this step. The evidence file is documentation only and does not supersede the qualified SHA.

## Boundaries and remaining acceptance

The architecture names **future** TableRegistry, SeatLedger, HandEngine, PotEngine and confidential dealer protocols and deliberately does not misrepresent them as implemented. Such implementations, adversarial and accounting qualification, live-testnet confidentiality/funding and independently signed operator, risk, mathematical and jurisdictional approvals remain separate follow-on acceptance. This certificate grants no capability to operate real-money poker. See `docs/420BET-TESTNET-WORK-ROADMAP.md`.

**Qualification:** Level 1 architecture-policy PASS only. Level 2 and Level 3 not performed. Production remains disabled.
