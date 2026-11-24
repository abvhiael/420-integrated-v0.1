# DEVCOMP-06 application revenue inventory

This inventory covers the checked-in catalogue records and the production Solidity calls to the compensation vault. Catalogue classifications describe release authority. Route classifications describe the economics of a specific implementation.

A review-required entry remains open until its receipts, obligations and retained basis have been reconciled with source and policy. Run the validator with `--require-closed` to reject open entries.

## Production and excluded routes

| Application | Route | Classification | Receipt and settlement | Evidence |
| --- | --- | --- | --- | --- |
| 420Exchange | Retained execution fee | eligible | Atomic execution settles actual output, checks user minimum after the fee, and sends only the retained fee to the five-way router. The router forwards the declared developer share using the trade reference and canonical policy. A revert rolls back the trade and fee. Launch remains gated under Decision 2. | [ExchangeAtomicRouter420.sol](../../contracts/src/exchange/ExchangeAtomicRouter420.sol), [ExchangeFeeRouter420.sol](../../contracts/src/exchange/ExchangeFeeRouter420.sol), [ExchangeFeePolicy420.sol](../../contracts/src/exchange/ExchangeFeePolicy420.sol), [ExchangeFeeSettlement420.t.sol](../../contracts/test/ExchangeFeeSettlement420.t.sol), [qualify-compensation-receipts.mjs](../../420-indexer/scripts/qualify-compensation-receipts.mjs) |
| 420Bet | Daily contest | policy-exception | Entry funding remains escrowed until dispute finality. Canceled entries refund, prize credits remain payable, and the finalized pool reserves a separate three-percent charge. The vault forwards the per-pool charge and emits incremental basis while preserving cumulative rounding. | [FantasyContestEngine420.sol](../../contracts/src/bet/fantasy/FantasyContestEngine420.sol), [DevelopmentCompensationVault420.sol](../../contracts/src/revenue/DevelopmentCompensationVault420.sol), [420bet-fantasy-approved-level2.yml](../../.github/workflows/420bet-fantasy-approved-level2.yml) |
| 420Bet | Peer and house-backed formats | policy-exception | Peer pools reserve fees on qualified entries. House cards settle per entry, reserve prizes and refunds, and queue the cumulative fee when the bankroll becomes releasable. The vault forwards the per-pool charge and emits incremental basis while preserving cumulative rounding. | [FantasyFormatEscrow420.sol](../../contracts/src/bet/fantasy/FantasyFormatEscrow420.sol), [DevelopmentCompensationVault420.sol](../../contracts/src/revenue/DevelopmentCompensationVault420.sol), [420bet-fantasy-approved-level2.yml](../../.github/workflows/420bet-fantasy-approved-level2.yml) |
| 420Bet | Season escrow | policy-exception | Entry fees remain escrowed through weekly disputes and final ranking. Cancellation returns refundable balances. Final settlement queues the pool charge. The vault forwards the per-pool charge and emits incremental basis while preserving cumulative rounding. | [FantasySeasonEscrow420.sol](../../contracts/src/bet/fantasy/FantasySeasonEscrow420.sol), [DevelopmentCompensationVault420.sol](../../contracts/src/revenue/DevelopmentCompensationVault420.sol), [420bet-fantasy-approved-level2.yml](../../.github/workflows/420bet-fantasy-approved-level2.yml) |
| 420Bet | Casino-wide retained profit | review-required | Reconcile bankroll, poker, sportsbook and shared pools against finalized eligible net profit. Account for separately forwarded Fantasy compensation once. | [420bet-capitalization-profit-waterfall-v1.json](../../contracts/config/420bet-capitalization-profit-waterfall-v1.json) |
| 420 Pay | Payment and refund settlement | excluded | The current payment router requires zero protocol fee. Merchant settlement and refundable funds do not accrue compensation on this path. | [PaymentRouter420.sol](../../contracts/src/pay/PaymentRouter420.sol), [RefundManager420.sol](../../contracts/src/pay/RefundManager420.sol) |
| 420 Swap | Canonical pool LP fee | excluded | The constant-product fee is retained in the pool reserves and belongs to liquidity accounting. The separate Exchange execution fee has its own route. | [CanonicalConstantProductPool420.sol](../../contracts/src/swap/CanonicalConstantProductPool420.sol), [ExchangeAtomicRouter420.sol](../../contracts/src/exchange/ExchangeAtomicRouter420.sol) |
| 420 Token | Token creation | policy-exception | Successful deployment deposits the entire 42 native 420 fee to the immutable community revenue vault. A failed deposit reverts deployment. | [TokenFactory420.sol](../../contracts/src/token/TokenFactory420.sol), [420token-genesis.json](../../contracts/config/420token-genesis.json) |
| 420 Stake | Bond and validator accrual | excluded | Owned collateral, protocol credit and validator rewards follow staking custody and reward accounting. | [Stake420.sol](../../contracts/src/apps/Stake420.sol), [application-revenue-policy-v1.json](../../contracts/config/application-revenue-policy-v1.json) |
| 420 Names | Registration and renewal | excluded | Commit, register and renew are nonpayable in the current canonical contract. | [Names420.sol](../../contracts/src/apps/Names420.sol) |
| 420 Identity | Profiles and credentials | excluded | The current profile and credential registry holds identity records without an independent payment path. | [Identity420.sol](../../contracts/src/apps/Identity420.sol) |
| 420 Registry | Service and component registration | excluded | Registry publication and resolution establish application authority without collecting commercial receipts. | [ProtocolRegistry.sol](../../contracts/src/apps/ProtocolRegistry.sol) |
| 420 Treasury | Compensation forwarding | shared | The vault is an authenticated forwarding boundary for application receipts. Splitter credits and founder claims do not create additional application revenue. | [DevelopmentCompensationVault420.sol](../../contracts/src/revenue/DevelopmentCompensationVault420.sol), [FoundingDeveloperCompensationSplitter420.sol](../../contracts/src/revenue/FoundingDeveloperCompensationSplitter420.sol) |
| 420 Explorer | Indexer read model | shared | Explorer reads the Indexer API. It does not originate the indexed settlements. | [420explorer-genesis.json](../../contracts/config/420explorer-genesis.json), [client.go](../../explorer/indexerclient/client.go) |
| 420 Analytics | Indexer read model | shared | Analytics derives metrics from Indexer snapshots. Indexed economic activity is attributed to its originating applications. | [service.go](../../analytics/runtime/service.go), [client.go](../../analytics/indexerclient/client.go) |
| 420 Faucet | Testnet distribution | release-disabled | The canonical launch catalogue confines the faucet to testnet. | [genesis-applications.json](../../config/genesis-applications.json) |
| 420Pay | Canonical payment service alias | shared | The Decision 2 entry points to the canonical 420 Pay protocol. Its current payment router requires zero protocol fee. | [genesis-application-decision-2.json](../../config/genesis-application-decision-2.json), [PaymentRouter420.sol](../../contracts/src/pay/PaymentRouter420.sol) |
| 420 AppStore | Curated application catalogue | shared | The catalogue publishes listings and derives application provenance from 420Registry. The canonical service defines no listing or purchase settlement. | [genesis-dapp-contract-map.json](../../contracts/config/genesis-dapp-contract-map.json), [420appstore-genesis.json](../../contracts/config/420appstore-genesis.json) |
| 420 Notifications | Opt-in alerts | shared | The service derives notifications from registered sources and has no independent custody or settlement. | [genesis-dapp-contract-map.json](../../contracts/config/genesis-dapp-contract-map.json), [420notifications-genesis.json](../../contracts/config/420notifications-genesis.json) |
| 420 Search | Discovery index | shared | Search presents indexed discovery information. The underlying services own their transactions and associated receipts. | [genesis-dapp-contract-map.json](../../contracts/config/genesis-dapp-contract-map.json), [420search-genesis.json](../../contracts/config/420search-genesis.json) |
| 420 Status | Operational status feeds | shared | The status service reads operational health. Its availability and incident records create no payment obligations. | [genesis-dapp-contract-map.json](../../contracts/config/genesis-dapp-contract-map.json), [420status-genesis.json](../../contracts/config/420status-genesis.json) |
| 420 Verify | Build verification | shared | The service verifies source-to-bytecode correspondence. Its canonical profile has no settlement contract. | [genesis-dapp-contract-map.json](../../contracts/config/genesis-dapp-contract-map.json), [420verify-genesis.json](../../contracts/config/420verify-genesis.json) |
| 420 Wallet | Client transaction orchestration | shared | Wallet coordinates account and application transactions. Fees and custody are attributable to the canonical account, network or application that settles each transaction. | [genesis-dapp-contract-map.json](../../contracts/config/genesis-dapp-contract-map.json), [420wallet-genesis.json](../../contracts/config/420wallet-genesis.json) |

## Catalogue coverage

| Catalogue | Entry | Disposition |
| --- | --- | --- |
| Genesis launch | 420 AI | review-required |
| Genesis launch | 420 Analytics | shared |
| Genesis launch | 420 AppStore | shared |
| Genesis launch | 420 Arbitration | review-required |
| Genesis launch | 420 Attention | review-required |
| Genesis launch | 420 Bridge | review-required |
| Genesis launch | 420 Explorer | shared |
| Genesis launch | 420 Faucet | release-disabled |
| Genesis launch | 420 Gaming Protocol | review-required |
| Genesis launch | 420 Governance | review-required |
| Genesis launch | 420 Identity | excluded |
| Genesis launch | 420 Names | excluded |
| Genesis launch | 420 Notifications | shared |
| Genesis launch | 420 Pay | excluded |
| Genesis launch | 420 Registry | excluded |
| Genesis launch | 420 Search | shared |
| Genesis launch | 420 Stake | excluded |
| Genesis launch | 420 Status | shared |
| Genesis launch | 420 Swap | excluded |
| Genesis launch | 420 Token | policy-exception |
| Genesis launch | 420 Verify | shared |
| Genesis launch | 420 Wallet | shared |
| Decision 2 | 420Bet | release-disabled |
| Decision 2 | 420BnB | release-disabled |
| Decision 2 | 420Calendar | release-disabled |
| Decision 2 | 420Classifieds | release-disabled |
| Decision 2 | 420Events | release-disabled |
| Decision 2 | 420Exchange | release-disabled |
| Decision 2 | 420Freelance | release-disabled |
| Decision 2 | 420Grants | release-disabled |
| Decision 2 | 420Grow | release-disabled |
| Decision 2 | 420Hz | release-disabled |
| Decision 2 | 420Launchpad | release-disabled |
| Decision 2 | 420Learn | release-disabled |
| Decision 2 | 420Location | release-disabled |
| Decision 2 | 420Mail | release-disabled |
| Decision 2 | 420Media | release-disabled |
| Decision 2 | 420Pay | release-disabled |
| Decision 2 | 420Reputation | release-disabled |
| Decision 2 | 420Rights | release-disabled |
| Decision 2 | 420Travel | release-disabled |
| Decision 2 | 420Treasury | release-disabled |
| Decision 2 | 420University | release-disabled |
| Decision 2 | BongGoggles | release-disabled |
| Decision 2 | DOOBr | release-disabled |
| Decision 2 | DoobTube | release-disabled |
| Decision 2 | HighStreetMarket | release-disabled |
| Decision 2 | LIFTd | release-disabled |
| Decision 2 | PuffBuddies | release-disabled |
| Decision 2 | ReeferReview | release-disabled |
| Decision 2 | TownSquare | release-disabled |
| Contract ownership | 420 AI | review-required |
| Contract ownership | 420 Analytics | shared |
| Contract ownership | 420 AppStore | shared |
| Contract ownership | 420 Arbitration | review-required |
| Contract ownership | 420 Attention | review-required |
| Contract ownership | 420 Bridge | review-required |
| Contract ownership | 420 Civic | review-required |
| Contract ownership | 420 Commons | review-required |
| Contract ownership | 420 ComputeMarket | review-required |
| Contract ownership | 420 Explorer | shared |
| Contract ownership | 420 Faucet | release-disabled |
| Contract ownership | 420 Gaming Protocol | review-required |
| Contract ownership | 420 Grants | review-required |
| Contract ownership | 420 Identity | excluded |
| Contract ownership | 420 Launchpad | review-required |
| Contract ownership | 420 Market | review-required |
| Contract ownership | 420 Messenger | review-required |
| Contract ownership | 420 Names | excluded |
| Contract ownership | 420 Notifications | shared |
| Contract ownership | 420 Oracle | review-required |
| Contract ownership | 420 Pay | excluded |
| Contract ownership | 420 Pulse | review-required |
| Contract ownership | 420 Random | review-required |
| Contract ownership | 420 Registry | excluded |
| Contract ownership | 420 Resource Protocol | review-required |
| Contract ownership | 420 Rights | review-required |
| Contract ownership | 420 Search | shared |
| Contract ownership | 420 Smart Accounts | review-required |
| Contract ownership | 420 Stake | excluded |
| Contract ownership | 420 Status | shared |
| Contract ownership | 420 Swap | excluded |
| Contract ownership | 420 Token | policy-exception |
| Contract ownership | 420 Treasury | shared |
| Contract ownership | 420 Trust | review-required |
| Contract ownership | 420 Vault | review-required |
| Contract ownership | 420 Verify | shared |
| Contract ownership | 420 Wallet | shared |
| Contract ownership | 420-IS | review-required |
| Consumer services | 420Calendar | review-required |
| Consumer services | 420Classifieds | review-required |
| Consumer services | 420Events | review-required |
| Consumer services | 420Freelance | review-required |
| Consumer services | 420Launchpad Crowdfunding | review-required |
| Consumer services | 420Learn + 420Knowledge | review-required |
| Consumer services | 420Location | review-required |
| Consumer services | 420Mail | review-required |
| Consumer services | 420Media | review-required |
| Consumer services | 420Reputation | review-required |
| Consumer services | 420Town Community Boards | review-required |
| Consumer services | 420Travel | review-required |
| Consumer services | 420University | review-required |
| Consumer services | Reefer Review Publishing | review-required |
