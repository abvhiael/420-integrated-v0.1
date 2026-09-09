# 420GP-15 — Live Testnet Qualification

420GP-15 converts the Gaming Protocol from repository-qualified to deployment-qualified.

## Current state

The repository now contains the complete live-qualification harness for the four-game Gaming Protocol reference set. The runtime remains `UNRESOLVED_UNTIL_DEPLOYMENT`, so actual live acceptance remains intentionally fail-closed until chainId, protocol/game operator addresses and all six Gaming Protocol contract addresses are populated from a real testnet deployment.

## Qualification sequence

1. Resolve `deployments/gaming/testnet.runtime.json` from the actual testnet deployment.
2. Verify manifest schema, canonical game IDs, operator bindings, non-zero addresses and absence of secret material.
3. Supply `GAMING_TESTNET_RPC_URL`, `GAMING_TESTNET_PLAYER_PRIVATE_KEY` and `GAMING_TESTNET_HIGH_COUNTRY_OPERATOR_PRIVATE_KEY` only through protected CI/runtime configuration.
4. Run `scripts/gaming/qualify-live-testnet.mjs` to verify chain identity and deployed bytecode.
5. Run the complete transaction lifecycle with `npm run qualify:lifecycle` in `clients/420-gaming-testnet-v1`.

## Live qualification journeys

### Reference-game registry
- verifies all four canonical game IDs exist in deployed `GameRegistry420`;
- verifies all four games are active;
- verifies each deployed operator binding exactly matches the runtime manifest;
- fails closed on missing, inactive or mis-bound games.

### Profile
- verifies the High Country game is active;
- creates the player's canonical game profile if one does not already exist;
- verifies `profileIdOf` is non-zero after the transaction.

### Entitlement lifecycle
- verifies the configured High Country operator signer matches the runtime manifest;
- issues a scoped entitlement to the live player profile;
- verifies it becomes active;
- revokes it;
- verifies revoked state fails closed.

### Guest migration lifecycle
- operator issues a target-bound migration claim;
- the exact player account consumes it;
- replay after consumption is rejected;
- a second claim is cancelled by the operator;
- consumption after cancellation is rejected.

### Cross-game attestation lifecycle
- High Country operator issues a scoped source-game attestation;
- the live harness verifies source game, profile, subject type, subject id and payload hash exactly;
- revocation is executed;
- revoked attestation fails closed.

## Reference games

- High Country
- The Green Road
- Budtender
- Smoke & Chrome

The testnet manifest carries canonical IDs and operator bindings for all four reference games. High Country is the first state-mutating live transaction reference because its profile and operator flows are the established integration baseline. Cross-game consumers remain verification-driven and do not gain a wallet-wide activity enumeration API.

## Security boundary

No private keys, mnemonics, session keys or signing material belong in the runtime manifest or repository. Player and operator signing material is injected only at live workflow runtime through protected secrets or an external signer. The operator private key is checked against the manifest address before any privileged transaction is sent.

## Completion definition

The GP-15 implementation harness is complete when repository qualification is green. GP-15 deployment qualification is complete only after:

1. the runtime is deployment-resolved;
2. the manual live workflow passes RPC/bytecode qualification;
3. all four reference games pass registry/operator verification;
4. profile, entitlement, migration and cross-game transaction journeys all pass against the deployed testnet;
5. no secret material is persisted in repository artifacts.

Until those live conditions are satisfied, the project must report GP-15 as **implementation-complete / deployment-pending**, not live-testnet-qualified.
