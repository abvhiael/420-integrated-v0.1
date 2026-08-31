# 420Bet DiceV1 deployment and smoke runbook

This runbook promotes a real DiceV1 deployment into the browser client and verifies the live path without giving the frontend outcome authority.

## 1. One-command local deployment harness

For a real local deployment, install Node dependencies and Foundry, then run from `clients/420bet-dice-v1`:

```bash
npm install
npm run local:deploy-smoke
```

That command:

1. builds the Foundry contracts;
2. starts a deterministic local Anvil chain on `http://127.0.0.1:8545` with chain ID `31337`;
3. deploys the real 420Bet authorization, registries, bankroll/risk, wager, randomness, DiceV1, settlement and DiceV1 view contracts;
4. deploys only two clearly local-only helpers: `DiceLocalCapabilityRegistry420` and `DiceLocalToken420`;
5. configures the same Dice module/game/operator/profile/risk/randomness relationships exercised by the qualified vertical slice;
6. seeds 1,000 L420 of bankroll liquidity;
7. grants the second deterministic Anvil account only the scoped Dice `BET_PLACE` capability and funds it with 100 L420;
8. writes a promoted manifest to `testnet/apps/420bet/local/dice-v1.deployment.json`;
9. runs the live RPC/code/identity/game-ID smoke against that manifest;
10. generates `clients/420bet-dice-v1/public/config.js` from the promoted manifest;
11. shuts Anvil down after the smoke passes.

Use:

```bash
npm run local:deploy-smoke -- --keep-alive
```

to leave the local Anvil process running for browser/manual wager testing. Generated local deployment manifests are intentionally gitignored.

## 2. Deploy and configure a shared/testnet protocol stack

For a shared testnet deployment, deploy the already-qualified 420Bet stack using the target environment's production deployment process. The deployment must include the configured `BetAuthorization420`, `WagerRouter420`, bankroll vault, `RandomnessRouter420`, `DiceV1420`, `SettlementEngine420`, and `DiceV1View420`, with the Dice game/module/operator/profile registrations and capabilities required by the vertical slice.

Do not copy addresses from a unit-test or local deployment. Record the addresses emitted by the actual target-chain deployment.

## 3. Create a promoted shared/testnet deployment manifest

Copy:

`testnet/apps/420bet/dice-v1.deployment.example.json`

to an environment-specific file such as `testnet/apps/420bet/dice-v1.testnet.json`.

Populate the target RPC URL, contract addresses, Dice game/version/operator IDs, deployment commit, deployer, and deployment timestamp. Set `status` to `PROMOTED` only after those values have been checked against the target chain.

The public 420 testnet metadata currently contains placeholder RPC URLs and a candidate chain ID. Do not promote a public-testnet Dice manifest until those network values themselves are frozen.

## 4. Run the live RPC smoke

From `clients/420bet-dice-v1`:

```bash
DICE_DEPLOYMENT_MANIFEST=../../testnet/apps/420bet/dice-v1.testnet.json npm run smoke:rpc
```

The smoke fails unless:

- the RPC chain ID matches the manifest;
- Dice, Dice view, wager router, vault and Bet authorization addresses all contain bytecode;
- a non-native stake asset also contains bytecode;
- `DiceV1420`, `DiceV1View420`, and `BetAuthorization420` report the expected system identity and protocol version;
- the deployed Dice contract's `gameId` and `gameVersionId` exactly match the promoted manifest.

## 5. Generate the browser runtime config

```bash
DICE_DEPLOYMENT_MANIFEST=../../testnet/apps/420bet/dice-v1.testnet.json npm run manifest:config
npm run build
npm run dev
```

`manifest:config` refuses unpromoted manifests, placeholder RPC URLs, zero required contract addresses, zero canonical IDs, or incomplete promotion evidence.

## 6. Execute a real wager smoke

Use a funded test wallet/smart account on the selected network.

1. Grant only the scoped `BET_PLACE` capability required for the promoted Dice game/version and chosen stake limit.
2. Open the Dice browser client and connect that wallet/session.
3. Confirm the UI reports the session as authorized.
4. If the stake asset is ERC-20, approve the configured bankroll vault for the smoke stake.
5. Enter a small test stake and valid Dice threshold/payout terms.
6. Submit one wager.
7. Record the returned transaction hash and canonical wager ID.
8. Confirm the UI enters `waiting-randomness`; it must not display a fabricated roll.
9. Allow the configured target-chain randomness provider/operator path to fulfill the request and the configured settlement authority to settle it.
10. Refresh until the controller reaches `result-ready` and then `settled`.
11. Open **Verify this roll** and confirm params, canonical randomness root, reproduced result, settlement outcome and gross payout all agree.

## 7. Pass criteria

The smoke is PASS only when the live RPC smoke succeeds and a real target-chain wager completes through:

`wallet/session -> WagerRouter420 -> risk/liability reservation -> RandomnessRouter420 -> DiceV1420 -> SettlementEngine420 -> DiceV1View420 -> rendered verification transcript`

Frontend animation is never evidence of outcome correctness. The canonical contracts and reproduced view result are the evidence.
