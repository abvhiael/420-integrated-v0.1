# 420AI / ComputeMarket recovery audit

Status: implementation recovery in progress

## Why this recovery exists

The frozen 420AI and 420 ComputeMarket architecture documents named mature V1 Solidity modules that were not present in `contracts/src/ai` or `contracts/src/compute` on `main`. The Genesis AI compatibility contracts were real and hardened, but the architecture-to-implementation bridge was incomplete.

The main missing pieces were:

- AI authorization and policy surfaces
- AI model deployment registry
- mature request/result facades
- AI-to-Compute adapter
- AI router/interface
- the entire architecture-named ComputeMarket Solidity stack

The existing `AIModelRegistry.sol` protocol v3 already owns both model-family and immutable model-version state. This recovery deliberately does not add duplicate `AIModelRegistry420` or `AIModelVersionRegistry420` mutable state.

## Recovery design

The recovery preserves the frozen invariants:

- AI execution remains off-chain.
- Compute execution remains off-chain.
- no provider registration grants consensus/governance/custody authority.
- request spend remains user bounded.
- matching cannot settle above funded/requested limits.
- provider/node/resource identities remain distinct.
- receipts are monotonic and replay-safe.
- result commitments are not represented as proof of factual truth.
- settlement beneficiary derives from canonical provider state.
- mature request/result views do not duplicate the frozen AIJobManager lifecycle.

## Added ComputeMarket modules

- `ComputeIds420.sol`
- `ComputeAuthorization420.sol`
- `ComputePolicyRegistry420.sol`
- `ComputeProviderRegistry420.sol`
- `ComputeNodeRegistry420.sol`
- `ComputeResourceRegistry420.sol`
- `ComputeOfferRegistry420.sol`
- `ComputeRequestRegistry420.sol`
- `ComputeMatch420.sol`
- `ComputeJobRegistry420.sol`
- `ComputeReceiptRegistry420.sol`
- `ComputeVerificationRouter420.sol`
- `ComputeSettlement420.sol`
- `ComputeDispute420.sol`
- `ComputeRouter420.sol`
- `ICompute420.sol`

## Added mature 420AI modules

- `AIAuthorization420.sol`
- `AIPolicyRegistry420.sol`
- `AIModelDeploymentRegistry420.sol`
- `AIRequestRegistry420.sol`
- `AIResultRegistry420.sol`
- `AIComputeAdapter420.sol`
- `AIRouter420.sol`
- `IAI420.sol`

The frozen compatibility contracts remain canonical:

- `AIProviderRegistry.sol`
- `AIModelRegistry.sol`
- `AIJobManager.sol`
- `AIJobEscrow.sol`
- `AIReputationRegistry.sol`

## Adapter authority model

`AIComputeAdapter420` does not create an unrestricted hidden marketplace.

The requester creates and funds the ComputeMarket request. The adapter binds that request only when:

- requester identity matches the AI job requester;
- compute spend does not exceed the AI job maximum or funded amount;
- compute deadline does not exceed the AI deadline;
- input commitment matches the AI request commitment;
- privacy and verification profiles match;
- the compute workload is the correct AI inference/training class.

The adapter then binds a canonical ComputeMarket match/job and validates that the selected 420AI provider's `computeProviderRef` equals the canonical compute provider on the match.

It can synchronize only explicit ComputeMarket lifecycle evidence into the frozen `AIJobManager`.

## Website/UI audit

The public website repository currently contains only a 420AI documentation page at:

`/docs/applications/ai/`

No production 420AI client exists there yet. In particular there is no current:

- `ai.420integrated.org` application source
- prompt/job submission console
- model browser
- provider browser
- job/history dashboard
- provider operator dashboard
- wallet-connected AI request form

The website UI should be built as a separate application/client phase after contract/API qualification, while preserving a configuration-driven RPC/contract-address manifest.

## Remaining work after this PR

1. qualify Solidity compilation and fuzz/invariant tests;
2. add dedicated ComputeMarket fuzz/invariant coverage;
3. add Vault funding/settlement adapter integration rather than reference-only accounting;
4. add Trust evidence adapter for compute outcomes;
5. add provider worker protocol and signed endpoint/service manifests;
6. implement provider daemon / worker runtime;
7. implement API/indexer layer for user-facing job discovery;
8. build the `ai.420integrated.org` web client;
9. add deployment manifests and testnet smoke tests;
10. complete end-to-end testnet qualification from Wallet -> AI request -> ComputeMarket -> provider -> verification -> settlement.
