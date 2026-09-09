# 420GP-15 — Live Testnet Qualification

420GP-15 converts the Gaming Protocol from repository-qualified to deployment-qualified.

## Current state

The repository contains the full four-game testnet runtime catalogue, but the runtime remains `UNRESOLVED_UNTIL_DEPLOYMENT`. Therefore live qualification is intentionally fail-closed until chainId, protocol/game operator addresses and all six Gaming Protocol contract addresses are populated from a real deployment.

## Qualification sequence

1. Resolve `deployments/gaming/testnet.runtime.json` from the actual testnet deployment.
2. Verify manifest schema, canonical game IDs, operator bindings, non-zero addresses and absence of secret material.
3. Supply `GAMING_TESTNET_RPC_URL` only through CI secret/runtime configuration.
4. Run `scripts/gaming/qualify-live-testnet.mjs`.
5. Confirm RPC chain ID exactly matches the manifest.
6. Confirm deployed bytecode exists at GamingAuthorization420, GameRegistry420, GameIdentity420, GameEntitlements420, GameClaims420 and CrossGameRegistry420 addresses.
7. After basic code/RPC qualification, add transaction-level journeys for game registration, profile creation, entitlements, migration claims and scoped cross-game attestations.

## Reference games

- High Country
- The Green Road
- Budtender
- Smoke & Chrome

## Security boundary

No private keys, mnemonics, session keys or signing material belong in the runtime manifest. The live workflow consumes only the RPC endpoint; transaction-signing qualification will use dedicated testnet accounts through protected CI secrets or an external signer.

## Completion definition

420GP-15 is not complete merely because repository CI is green. It is complete only after the runtime is deployment-resolved and the live RPC/on-chain qualification passes against the deployed testnet.
