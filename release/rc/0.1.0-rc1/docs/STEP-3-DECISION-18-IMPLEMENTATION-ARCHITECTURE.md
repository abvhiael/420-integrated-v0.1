# Step 3 Decision 18 — Implementation Architecture

Status: **FROZEN FOR TESTNET**

## Reference clients
- Consensus daemon: `fourtwentyd` (Go)
- Execution client: `node420`
- `node420` is a minimal maintained Geth-derived execution distribution/configuration.
- Processes are separate and communicate through a private JWT-authenticated Engine API.
- `fourtwentyd` owns slots, proposer selection, fork choice, QCs/finality, validator/committee state, randomness, slashing, rewards, and SAFETY_HALT/recovery.
- `node420` owns EVM execution, mempool, execution state, gas/base-fee mechanics, receipts/logs, contracts, and Ethereum-compatible JSON-RPC.

## Consensus and contracts
Consensus P2P uses libp2p. Consensus state uses its own key-value database. Protocol system calls are deterministic, non-mempool and fee-exempt; consensus computes exact protocol amounts and node420 applies execution-state transitions.

System/application contracts use Solidity with Foundry.

Remote BLS signing and a local slashing-protection database are required.

## Cannaseurs
The historical Whale/Publisher application role is renamed **Cannaseur**. Cannaseur status grants no additional consensus power.

The 420 wallet may surface opt-in Cannaseur advertising and Attention rewards. Campaign budgets/escrow and critical campaign metadata are on-chain; large media remains off-chain.

Ads may not execute wallet code, silently request signatures, initiate transactions automatically, access keys/seeds, or bypass user confirmation. Naive pay-per-click rewards are forbidden; rewarded engagement requires anti-Sybil eligibility.

## Verified cross-chain gateway at genesis
The 420-side cross-chain gateway is available at genesis. For immediate stablecoin bridging, the corresponding source-chain gateway must already be deployed and verified before 420 genesis.

Canonical path:

`external stablecoin -> source gateway -> verified proof/message -> 420 gateway -> approved bridged stablecoin -> 420/stablecoin market`

Destination minting requires verified source deposit/lock. Source release requires verified destination burn/withdrawal. Unbacked admin minting and administrative confiscation are forbidden.

The gateway is pausable under emergency rules and must enforce per-transaction, hourly, daily, per-asset, and TVL rate limits. It uses a multi-chain adapter architecture and does not automatically make the 420 validator committee the bridge committee.

The exact bridge verification primitive is deferred to a dedicated security decision. Candidate families include threshold attestations, light-client verification, zk light-client verification, or a hybrid. Long-term preference is proof-verifying whenever technically practical and never single-operator dependent.

## Approved quote asset
`ApprovedQuoteAssetRegistry` identifies the canonical gateway-backed stable settlement asset used by the native 420 market and public-distribution system.

## DEX boundary
DEX, TWAMM, batch auction, gateway interfaces and TWAP oracle execute on node420. Consensus does not implement AMM pricing. TWAP comes from the canonical 420/approved-stablecoin market, not a centralized web API.

## Genesis tooling
A deterministic Go CLI named `420-genesis` generates execution genesis, consensus genesis, manifests, summaries and checksums from canonical configuration and ceremony inputs.

## Development sequence
M1: bounded consensus skeleton, fourtwentyd + node420, explorer and faucet.
M2: governance, validator credit, verified gateway, DEX/auction/TWAP, treasury and vesting contracts.
M3: Attention economy, Cannaseur advertising, 420ID, social and marketplace applications.

Before real-value bridging, a dedicated gateway-security decision must freeze the exact verification protocol and source-chain finality assumptions.
