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

## 2. Stage a shared/testnet protocol deployment

Shared networks use the real target-chain Capability Registry and a real ERC-20 stake asset. No local capability or token mocks are deployed.

Set:

- `DICE_RPC_URL`
- `DICE_CHAIN_ID`
- `DICE_DEPLOYER_PRIVATE_KEY`
- `DICE_CAPABILITY_REGISTRY`
- `DICE_STAKE_ASSET`
- `DICE_RANDOMNESS_PROVIDER`
- optional `DICE_TARGET_NAME`, risk-limit overrides, seed-liquidity override and withdrawal-cooldown override

Then run from `clients/420bet-dice-v1`:

```bash
npm run shared:deploy -- ../../testnet/apps/420bet/dice-v1.testnet.json
```

The deploy stage verifies the target chain ID and bytecode at the shared Capability Registry and stake asset, builds the qualified contracts, deploys the real DiceV1 stack, derives canonical 420Bet scopes from the deployed authorization adapter and writes a manifest with status `DEPLOYED_AWAITING_CAPABILITIES`.

It deliberately does **not** register, approve, activate, configure or seed the protocol. Instead the manifest includes the exact `requiredCapabilities` matrix for the deployer and newly deployed protocol contracts. Those grants must be issued through the shared Capability Registry by the target environment's normal authority process. This preserves default-deny and prevents a deployment script from acquiring an implicit super-admin path.

## 3. Verify capabilities and promote

After the required static capabilities are granted on-chain, rerun with the same deployer key and manifest:

```bash
npm run shared:promote -- ../../testnet/apps/420bet/dice-v1.testnet.json
```

Promotion fails closed unless every required capability is currently authorized for the exact component, action, scope and required amount recorded by stage 1. It also rechecks bytecode at the deployed/shared addresses and verifies that the deployer key matches the staged manifest.

Only after those checks pass does promotion:

1. register the vault asset in canonical accounting;
2. register randomness, risk, settlement and access profiles;
3. register and approve the Dice module;
4. register and activate the operator;
5. register and activate DiceV1;
6. configure the bounded risk profile;
7. configure the chosen shared randomness provider;
8. seed the bankroll from the deployer's real stake-asset balance;
9. mark the manifest `PROMOTED`;
10. run the live RPC smoke and generate browser runtime config.

Runtime/player capabilities such as scoped `BET_PLACE` and per-wager settlement authority remain separate from this static deployment grant set.

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
