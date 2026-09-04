# 420Bet RouletteV1 deployment and smoke runbook

This runbook defines the release gate for the first-party RouletteV1 package. It verifies a promoted European single-zero Roulette deployment without granting the frontend, manifest, or smoke tooling any outcome authority.

## 1. Release artifacts

The release package must contain and deploy the qualified contracts:

- `RouletteV1420`
- `RouletteV1View420`
- the shared `WagerRouter420`
- the shared `RandomnessRouter420`
- the shared `SettlementEngine420`
- the shared `BetRegistry420`
- the configured `BankrollVault420`
- the configured `BetAccessPolicy420`
- `BetAuthorization420`

Use `testnet/apps/420bet/roulette-v1.deployment.example.json` only as a schema example. It is intentionally non-promotable placeholder evidence and must never be treated as a live deployment.

## 2. Produce a promoted deployment manifest

A live RouletteV1 deployment manifest uses schema:

`420bet-roulette-v1-deployment-v1`

and must record:

- target chain ID, name, live HTTP(S) RPC URL and native-currency metadata;
- nonzero deployed addresses for RouletteV1, RouletteV1View, WagerRouter, RandomnessRouter, SettlementEngine, BetRegistry, AccessPolicy, vault and BetAuthorization;
- the stake asset address, where zero is permitted only to mean native 420;
- canonical `gameId`, `gameVersionId`, `rulesetId` and `operatorId`;
- promotion deployer;
- exact nonzero 40-character source commit;
- UTC ISO-8601 deployment timestamp;
- status `PROMOTED`.

Validate it before use:

```bash
python3 scripts/verify-420bet-roulette-release.py path/to/roulette-v1.deployment.json
```

The validator fails closed on unpromoted status, placeholder RPCs, missing/zero required contract addresses, malformed asset address, missing/zero canonical IDs, zero/malformed promotion deployer, zero/malformed source commit, or malformed deployment timestamp.

The same validator self-test is part of `scripts/contracts-verify.sh`, so schema/validation regressions fail the Genesis Contract Verification workflow.

## 3. Verify deployed identities and bindings

Against the promoted manifest, verify via RPC that:

1. every required deployed contract address contains runtime bytecode;
2. `RouletteV1420.systemName()` returns `RouletteV1420` and `protocolVersion()` returns `1`;
3. `RouletteV1View420.systemName()` returns `RouletteV1View420` and `protocolVersion()` returns `1`;
4. Roulette's immutable `gameId`, `gameVersionId` and `rulesetId` exactly match the manifest;
5. Roulette's immutable registry and randomness-router dependencies are the promoted BetRegistry and RandomnessRouter;
6. RouletteV1View's registry/randomness/Roulette dependencies point to those same promoted contracts;
7. the registered active game version points to the approved Roulette module and the expected randomness, risk, settlement and access profiles;
8. the configured vault asset matches the manifest asset.

Any mismatch is a release failure. Do not repair it in the UI or by substituting addresses client-side; deploy/promote a corrected package.

## 4. Execute a real wager smoke

Use a funded test wallet or 420 Smart Account with only the scoped `BET_PLACE` capability required for the promoted Roulette game/version and stake limit.

Run at least these live wagers with small stakes:

- one even-money outside bet, such as RED;
- one dozen or column bet;
- one straight-up number bet, preferably including a dedicated straight-zero smoke when practical.

For each wager:

1. derive the parameter hash using the deployed RouletteV1 contract;
2. derive `maxGrossPayout` from `requiredMaxGrossPayout` rather than from UI constants;
3. submit through `WagerRouter420` before the deadline;
4. record the transaction hash and canonical wager ID;
5. confirm stake escrow and exact maximum liability are reserved before randomness exists;
6. request randomness through the configured `RandomnessRouter420` path;
7. confirm the UI/client does not invent or preview a pocket before fulfillment;
8. allow the configured provider to fulfill one canonical root;
9. resolve the pocket through `RouletteV1420`;
10. settle through `SettlementEngine420` using the exact resolved outcome and gross payout;
11. confirm stake escrow and risk liability clear exactly once;
12. confirm economics finalization occurs exactly once;
13. read the wager through `RouletteV1View420` and independently reproduce the same pocket, outcome, payout, params hash and randomness root.

## 5. Canonical roulette assertions

The live smoke must preserve the qualified RouletteV1 rules:

- wheel pockets are exactly `0..36`;
- zero is neither red nor black, neither even nor odd for betting purposes, and is outside low/high, dozens and columns;
- a straight bet wins only its selected pocket and pays 36x gross;
- a dozen or column winner pays 3x gross;
- red/black, odd/even and low/high winners pay 2x gross;
- the contract derives the payout schedule; callers do not supply a payout multiplier;
- the accepted wager's `maxGrossPayout` exactly equals `requiredMaxGrossPayout(stake, params)`;
- one canonical randomness root produces one deterministic pocket;
- replay of the same canonical state reproduces the same result;
- after a wager is VOID, RouletteV1 must not expose a new game outcome;
- after the wager deadline, the Phase B terminal rules remain authoritative: non-VOID economic settlement is forbidden and permissionless deterministic VOID remains the rescue path.

## 6. Failure and retry checks

Before release qualification, exercise at least one controlled failure/retry path on the target environment or an equivalent production-faithful staging deployment:

- repeat the same settlement and confirm it is idempotent;
- attempt a conflicting second settlement and confirm rejection;
- attempt parameter reinterpretation and confirm `ParamsMismatch`/equivalent failure;
- attempt settlement after deadline and confirm only VOID is legal;
- allow an accepted wager to expire without randomness fulfillment and confirm `voidExpired` releases escrow, liability and fee reservation without creating fee claims;
- confirm a late committed randomness proof remains auditable but cannot restore post-deadline economic authority.

## 7. Final release qualification

RouletteV1 is release-qualified only when all of the following are true on the same source head:

- Solidity Contracts is green;
- 420 Integrated Qualification is green;
- 420 Genesis Contract Verification is green, including the Roulette release-manifest validator;
- 420 Genesis Contract Hardening is green, including the Slither high-severity gate;
- the existing 420Bet Dice Client compatibility workflow remains green;
- the promoted Roulette manifest passes `verify-420bet-roulette-release.py`;
- the deployed identity/binding checks pass;
- a live/staging wager smoke reproduces the canonical result through `RouletteV1View420`.

The authoritative release path is:

`wallet/smart account -> WagerRouter420 -> stake escrow + risk reservation -> RandomnessRouter420 -> RouletteV1420 -> SettlementEngine420 -> RouletteV1View420 -> independently reproducible transcript`

Frontend animation, wheel graphics, client-selected multipliers, or locally generated pockets are never evidence of outcome correctness.
