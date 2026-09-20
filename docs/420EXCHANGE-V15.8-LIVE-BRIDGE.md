# 420Exchange V15.8 — Source/proof/destination testnet bridge qualification

V15.8 implements a protected operational drill using the canonical `GatewayRouter420` on **two distinct resolved testnet chains**. Repository tests exercise deterministic doubles, not actual interchain settlement. Live qualification remains pending until the manual workflow produces actual finalized transaction evidence.

## Contract boundaries

`ExchangeBridgeQualification420` is read-only eligibility, not a bridge executor. The source gateway `GatewayRouter420.initiateOutbound(bytes32,bytes32,bytes32,bytes,uint256,bytes)` emits `OutboundInitiated(routeId, adapterId, sourceMessageId)`. The destination gateway `acceptInbound(bytes32,bytes)` must validate the externally sourced proof through the registered bridge adapter, then emits `InboundAccepted(transferId, adapterId)`. Exchange does not synthesize a proof or use an outbound receipt as evidence of destination settlement.

## Operational sequence

1. Bind a resolved source manifest and an independently resolved destination manifest; reject identical chain IDs and unresolved deployments.
2. Obtain the disposable test account on each provider and validate its live chain; require source authorization explicitly bound to source principal, asset and raw amount.
3. Build exact reviewed outbound calldata via V15.2, perform V15.3 preflight including source capability and configured allowances, and use V15.4 wallet submission.
4. Wait for canonical **FINALIZED** source receipt through V15.5, require exactly one source GatewayRouter `OutboundInitiated` event matching the requested route and adapter, and extract the nonzero `sourceMessageId`.
5. Supply the finalized source transaction hash, source block hash and message ID to an external proof-provider endpoint. The endpoint must return proof bytes and matching source transaction hash/message ID/destination adapter metadata. Metadata matching does not prove the proof valid; the destination gateway and bridge adapter remain the verification authority.
6. Construct `acceptInbound(bytes32,bytes)` only with the externally supplied proof. Simulate/gas-estimate on the destination, submit through the destination test account, wait for canonical **FINALIZED** destination receipt, and verify `InboundAccepted` on the actual destination gateway, the expected adapter and a bytes32 transfer ID.
7. Produce source and destination transaction hashes, block hashes, message ID and transfer ID in a sanitized evidence record bound to the source commit SHA.

## Manual protected workflow

`.github/workflows/exchange-testnet-bridge.yml` is manual-only and uses the `exchange-testnet` environment. It expects protected GitHub secrets `EXCHANGE_TESTNET_MANIFEST_JSON`, `EXCHANGE_TESTNET_DESTINATION_MANIFEST_JSON`, `EXCHANGE_TESTNET_BRIDGE_FIXTURE_JSON`, `EXCHANGE_TESTNET_SOURCE_SIGNER_RPC_URL`, `EXCHANGE_TESTNET_DESTINATION_SIGNER_RPC_URL`, and `EXCHANGE_TESTNET_PROOF_URL`. Both signing-capable endpoints must use isolated disposable test accounts, not production credentials; the proof URL must be credential-free HTTPS. The fixture has schema `420-exchange-live-bridge-fixture-v15.8`, environment `testnet`, and an explicit `operatorApproved:true`, plus `reviewedIntent`, `execution`, `authorizationChecks`, `destinationAdapterId`, optional `expectedTransferId`, freshness/allowance checks and poll policy. Use canonical deployed routes, asset IDs, registered adapters, recipient bytes and a funded test account; do not copy arbitrary placeholder values.

The workflow does not manufacture a proof, select the destination from an untrusted message, auto-retry value movement or mark a transaction successful without a finalized matching event. It emits a sanitized `exchange-v15.8-live-evidence.json` artifact, excluding RPC URLs, proof contents, manifest contents and signing credentials. The bridge registry/settlement indexer and destination token or escrow release still require their own canonical verification; `InboundAccepted` itself confirms proof acceptance and transfer registration, **not** completed beneficiary payout.

## Repository versus operational gates

`npm run check` and `npm test` qualify the code and failures. They are not evidence of a real transfer. A live V15.8 operational closeout needs verified source/destination deployments, valid proof-provider integration, canonical finalized gateway transactions, transfer-registry and beneficiary settlement evidence (where required by the bridge design), and a retained exact-SHA evidence artifact. Until then operational status remains `PENDING_LIVE_TESTNET_DRILL`.

Follow-on: V15.9 wallet/browser compatibility and V15.10 Genesis testnet closeout.
