# DEVCOMP-06 application revenue inventory

This inventory covers the checked-in catalogue records and the production Solidity calls to the compensation vault. Catalogue classifications describe release authority. Route classifications describe the economics of a specific implementation.

A review-required entry remains open until its receipts, obligations and retained basis have been reconciled with source and policy. Run the validator with `--require-closed` to reject open entries.

## Production and excluded routes

| Application | Route | Classification | Receipt and settlement | Evidence |
| --- | --- | --- | --- | --- |
| 420Exchange | Retained execution fee | eligible | Atomic execution settles actual output, checks user minimum after the fee, and sends only the retained fee to the five-way router. The router forwards the declared developer share using the trade reference and canonical policy. A revert rolls back the trade and fee. Launch remains gated under Decision 2. | [ExchangeAtomicRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/exchange/ExchangeAtomicRouter420.sol), [ExchangeFeeRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/exchange/ExchangeFeeRouter420.sol), [ExchangeFeePolicy420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/exchange/ExchangeFeePolicy420.sol), [ExchangeFeeSettlement420.t.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/test/ExchangeFeeSettlement420.t.sol), [qualify-compensation-receipts.mjs](https://github.com/abvhiael/420-integrated-v0.1/blob/main/420-indexer/scripts/qualify-compensation-receipts.mjs) |
| 420Bet | Daily contest | policy-exception | Entry funding remains escrowed until dispute finality. Canceled entries refund, prize credits remain payable, and the finalized pool reserves a separate three-percent charge. The vault forwards the per-pool charge and emits incremental basis while preserving cumulative rounding. | [FantasyContestEngine420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bet/fantasy/FantasyContestEngine420.sol), [DevelopmentCompensationVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/revenue/DevelopmentCompensationVault420.sol), [420bet-fantasy-approved-level2.yml](https://github.com/abvhiael/420-integrated-v0.1/blob/main/.github/workflows/420bet-fantasy-approved-level2.yml) |
| 420Bet | Peer and house-backed formats | policy-exception | Peer pools reserve fees on qualified entries. House cards settle per entry, reserve prizes and refunds, and queue the cumulative fee when the bankroll becomes releasable. The vault forwards the per-pool charge and emits incremental basis while preserving cumulative rounding. | [FantasyFormatEscrow420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bet/fantasy/FantasyFormatEscrow420.sol), [DevelopmentCompensationVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/revenue/DevelopmentCompensationVault420.sol), [420bet-fantasy-approved-level2.yml](https://github.com/abvhiael/420-integrated-v0.1/blob/main/.github/workflows/420bet-fantasy-approved-level2.yml) |
| 420Bet | Season escrow | policy-exception | Entry fees remain escrowed through weekly disputes and final ranking. Cancellation returns refundable balances. Final settlement queues the pool charge. The vault forwards the per-pool charge and emits incremental basis while preserving cumulative rounding. | [FantasySeasonEscrow420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bet/fantasy/FantasySeasonEscrow420.sol), [DevelopmentCompensationVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/revenue/DevelopmentCompensationVault420.sol), [420bet-fantasy-approved-level2.yml](https://github.com/abvhiael/420-integrated-v0.1/blob/main/.github/workflows/420bet-fantasy-approved-level2.yml) |
| 420Bet | Casino-wide retained profit | review-required | Reconcile bankroll, poker, sportsbook and shared pools against finalized eligible net profit. Account for separately forwarded Fantasy compensation once. | [420bet-capitalization-profit-waterfall-v1.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420bet-capitalization-profit-waterfall-v1.json) |
| 420 Pay | Payment and refund settlement | excluded | The current payment router requires zero protocol fee. Merchant settlement and refundable funds do not accrue compensation on this path. | [PaymentRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/pay/PaymentRouter420.sol), [RefundManager420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/pay/RefundManager420.sol) |
| 420 Swap | Canonical pool LP fee | excluded | The constant-product fee is retained in the pool reserves and belongs to liquidity accounting. The separate Exchange execution fee has its own route. | [CanonicalConstantProductPool420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/swap/CanonicalConstantProductPool420.sol), [ExchangeAtomicRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/exchange/ExchangeAtomicRouter420.sol) |
| 420 Token | Token creation | policy-exception | Successful deployment deposits the entire 42 native 420 fee to the immutable community revenue vault. A failed deposit reverts deployment. | [TokenFactory420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/token/TokenFactory420.sol), [420token-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420token-genesis.json) |
| 420 Stake | Bond and validator accrual | excluded | Owned collateral, protocol credit and validator rewards follow staking custody and reward accounting. | [Stake420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/apps/Stake420.sol), [application-revenue-policy-v1.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/application-revenue-policy-v1.json) |
| 420 Names | Registration and renewal | excluded | Commit, register and renew are nonpayable in the current canonical contract. | [Names420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/apps/Names420.sol) |
| 420 Identity | Profiles and credentials | excluded | The current profile and credential registry holds identity records without an independent payment path. | [Identity420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/apps/Identity420.sol) |
| 420 Registry | Service and component registration | excluded | Registry publication and resolution establish application authority without collecting commercial receipts. | [ProtocolRegistry.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/apps/ProtocolRegistry.sol) |
| 420 Treasury | Compensation forwarding | shared | The vault is an authenticated forwarding boundary for application receipts. Splitter credits and founder claims do not create additional application revenue. | [DevelopmentCompensationVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/revenue/DevelopmentCompensationVault420.sol), [FoundingDeveloperCompensationSplitter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/revenue/FoundingDeveloperCompensationSplitter420.sol) |
| 420 Explorer | Indexer read model | shared | Explorer reads the Indexer API. It does not originate the indexed settlements. | [420explorer-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420explorer-genesis.json), [client.go](https://github.com/abvhiael/420-integrated-v0.1/blob/main/explorer/indexerclient/client.go) |
| 420 Analytics | Indexer read model | shared | Analytics derives metrics from Indexer snapshots. Indexed economic activity is attributed to its originating applications. | [service.go](https://github.com/abvhiael/420-integrated-v0.1/blob/main/analytics/runtime/service.go), [client.go](https://github.com/abvhiael/420-integrated-v0.1/blob/main/analytics/indexerclient/client.go) |
| 420 Faucet | Testnet distribution | release-disabled | The canonical launch catalogue confines the faucet to testnet. | [genesis-applications.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-applications.json) |
| 420Pay | Canonical payment service alias | shared | The Decision 2 entry points to the canonical 420 Pay protocol. Its current payment router requires zero protocol fee. | [genesis-application-decision-2.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-application-decision-2.json), [PaymentRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/pay/PaymentRouter420.sol) |
| 420 AppStore | Curated application catalogue | shared | The catalogue publishes listings and derives application provenance from 420Registry. The canonical service defines no listing or purchase settlement. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [420appstore-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420appstore-genesis.json) |
| 420 Notifications | Opt-in alerts | shared | The service derives notifications from registered sources and has no independent custody or settlement. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [420notifications-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420notifications-genesis.json) |
| 420 Search | Discovery index | shared | Search presents indexed discovery information. The underlying services own their transactions and associated receipts. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [420search-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420search-genesis.json) |
| 420 Status | Operational status feeds | shared | The status service reads operational health. Its availability and incident records create no payment obligations. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [420status-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420status-genesis.json) |
| 420 Verify | Build verification | shared | The service verifies source-to-bytecode correspondence. Its canonical profile has no settlement contract. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [420verify-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420verify-genesis.json) |
| 420 Wallet | Client transaction orchestration | shared | Wallet coordinates account and application transactions. Fees and custody are attributable to the canonical account, network or application that settles each transaction. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [420wallet-genesis.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/420wallet-genesis.json) |
| 420 Smart Accounts | Account funding and wallet execution | shared | Account balances are held for the account owner. Authorized execution spends that account balance and any application receipts belong to the service called. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [SmartAccount420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/accounts/SmartAccount420.sol) |
| 420-IS | Namespace and checkpoint routing | shared | The router resolves interoperable identities and checkpoint authority without collecting a settlement fee. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [InteropRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/interop/InteropRouter420.sol) |
| 420 Random | Randomness requests and fulfillment | shared | The canonical router authenticates requests, provider fulfillment and result delivery without holding a request or provider payment. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [RandomnessRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/randomness/RandomnessRouter420.sol) |
| 420 Trust | Trust aggregation | shared | The aggregator combines registered signals for downstream consumers without collecting settlement amounts. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [TrustAggregator420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/trust/TrustAggregator420.sol) |
| 420 Commons | Community permissions | shared | Space, channel and membership operations set community permissions without a commercial settlement call. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [CommonsRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/commons/CommonsRouter420.sol) |
| 420 Pulse | Publications and interactions | shared | The router registers publications and interactions without custodial or paid settlement. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [PulseRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/pulse/PulseRouter420.sol) |
| 420 Messenger | Message envelopes and receipts | shared | Delivery receipts attest to message state and are unrelated to any monetary receipt. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [MessengerRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/messenger/MessengerRouter420.sol) |
| 420 Arbitration | Case and ruling coordination | shared | The case and ruling paths authenticate arbitration transitions. The calling application remains responsible for asset custody and enforcing the ruling. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [ArbitrationRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/arbitration/ArbitrationRouter420.sol) |
| 420 Oracle | Feed and oracle evidence | shared | Feed lifecycle and report submissions authenticate data. The router defines no independent revenue collection. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [OracleRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/oracle/OracleRouter420.sol) |
| 420 Gaming Protocol | Game registry and entitlement authority | shared | The registry and associated claim and entitlement records authenticate game state. Funded play and settlement belong to the game application. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [GameRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/gaming/GameRegistry420.sol) |
| 420 Civic | Governance execution | shared | Governor execution may carry proposal-supplied funds to the timelock for the authorized target calls. Such execution value is budgeted expenditure rather than a charge to a customer. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [CivicGovernor420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/governance/CivicGovernor420.sol) |
| 420 Governance | Canonical governance authority | shared | The governance service authorizes proposal execution and associated timelock operations. It defines no independently retained service receipt. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [Governance420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/governance/Governance420.sol) |
| 420 Vault | Governed asset custody | excluded | Deposits create vault accounting balances and withdrawals retire custody amounts. The deposited principal is excluded under the application revenue policy. | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/genesis-dapp-contract-map.json), [AssetVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/vault/AssetVault420.sol) |
| 420Town Community Boards | Community boards | shared | The Genesis profile covers community posts, threads, votes and moderation. Supporting identity, storage and search supply the underlying services. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Travel | Travel discovery | shared | The Genesis MVP covers maps, places, events, reviews and discovery. The separate Decision 2 entry keeps production release disabled. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Reputation | Derived reputation | shared | The canonical profile derives reputation for verified interactions from identity, verification and arbitration. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Events | Event objects and discovery | shared | The Genesis service profile specifies event objects, discovery and scheduling dependencies. Ticket or sale settlement is outside this profile. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Location | Place discovery | shared | The Genesis profile supplies a place registry and geospatial lookup with provider abstraction. It defines no independent settlement. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Learn + 420Knowledge | Learning and credentials | shared | The Genesis profile covers courses, lessons, progress, questions and credentials. It defines no tuition or provider settlement. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420University | Navigation and schema | shared | The Genesis profile limits the umbrella shell to navigation and a shared schema. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Mail | Identity-addressed inbox | shared | The shared inbox delegates messaging, storage and notifications to the corresponding services. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Calendar | Scheduling and reminders | shared | The shared scheduling profile covers RSVPs and reminders using identity and notification services. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json) |
| 420Freelance | Deferred freelance commerce | release-disabled | The Genesis scope supplies interfaces for gigs and milestone escrow. The user-facing application is classified post-Genesis and release disabled. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json), [genesis-application-decision-2.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-application-decision-2.json) |
| 420 AI | Compute job settlement | shared | Direct AI funding is disabled. The AI adapter binds Compute provider entitlement and already-executed payer refund evidence, so those receipts belong to the Compute settlement. | [AIJobEscrow.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/ai/AIJobEscrow.sol), [AIComputeAdapter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/ai/AIComputeAdapter420.sol) |
| 420 Attention | Campaign funding and reward delivery | excluded | Campaign balances fund beneficiary rewards. Authorized releases satisfy the recorded campaign obligations and do not create retained protocol revenue. | [AttentionTreasury.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/system/AttentionTreasury.sol), [AttentionRewardRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/attention/AttentionRewardRegistry420.sol) |
| 420 Bridge | Backing custody and external network fees | excluded | Bridge custody transfers backing assets. Bitcoin miner fees, CCTP fees and LayerZero message fees compensate their external systems. | [BridgeValueCustody420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bridge/BridgeValueCustody420.sol), [BitcoinCustody420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bridge/bitcoin/BitcoinCustody420.sol), [USDCCCTPAdapter.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bridge/adapters/USDCCCTPAdapter.sol), [CADCLayerZeroAdapter.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bridge/adapters/CADCLayerZeroAdapter.sol) |
| 420 ComputeMarket | Fixed-price provider work and residual refunds | excluded | Payer funding is reserved with payer-safety obligations. Verified work allocates provider payment and payer residual claims. Terminal failure and dispute refunds remain obligations. | [ComputeEscrowFunding420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/compute/ComputeEscrowFunding420.sol), [ComputeVerifiedEntitlement420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/compute/ComputeVerifiedEntitlement420.sol) |
| 420 Grants | Grant obligations | excluded | The grant router exposes program and award state, and the award registry records recipient funding obligations rather than commercial charges. | [GrantRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/grants/GrantRouter420.sol), [GrantAwardRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/grants/GrantAwardRegistry420.sol) |
| 420 Launchpad | Crowdfunding payment and refund reconciliation | shared | Crowdfunding records canonical 420 Pay settlement references and confirms actual refund delivery before attaching evidence. Project receipts and refunds remain attributed to the Pay path. | [LaunchpadCrowdfundingIntegration420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/launchpad/LaunchpadCrowdfundingIntegration420.sol), [PaymentRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/pay/PaymentRouter420.sol) |
| 420 Market | Order and settlement evidence | shared | The order registry reserves inventory and records reporter-authenticated payment and refund references. The settlement adapter, rather than the order record, owns the asset path. | [OrderRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/market/OrderRegistry420.sol), [MarketPolicyRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/market/MarketPolicyRegistry420.sol) |
| 420 Resource Protocol | Resource and storage settlement records | shared | Resource receipts and storage settlement status provide registered evidence for provider obligations. The registries do not custody user payment or retain a protocol fee. | [ResourceReceiptRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/resource/ResourceReceiptRegistry420.sol), [StorageSettlementRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/resource/StorageSettlementRegistry420.sol) |
| 420 Rights | License and effective-use resolution | shared | The rights router resolves effective use from canonical rights and license records. Any separate commercial payment path would require its own revenue attribution. | [RightsRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/rights/RightsRouter420.sol), [RightsLicenseRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/rights/RightsLicenseRegistry420.sol) |
| 420Classifieds | Marketplace MVP | release-disabled | The launch amendment disables production release. The consumer profile delegates planned settlement to Pay and disputes to Arbitration. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json), [genesis-application-decision-2.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-application-decision-2.json) |
| 420Launchpad Crowdfunding | Project funding via canonical Pay | shared | This consumer profile uses contract-backed settlement. The crowdfunding integration binds canonical Pay payment and delivered refund references, sharing the Launchpad route. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json), [LaunchpadCrowdfundingIntegration420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/launchpad/LaunchpadCrowdfundingIntegration420.sol) |
| 420Media | Media publishing and livestreaming | release-disabled | The consumer profile names Pay as a dependency, and the launch amendment disables production release. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json), [genesis-application-decision-2.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-application-decision-2.json) |
| Reefer Review Publishing | Editorial and publishing service | shared | The Genesis publishing profile covers editorial and publishing tools using Rights, Storage and Search. The related ReeferReview application remains release-disabled. | [genesis-consumer-services.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json), [genesis-application-decision-2.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-application-decision-2.json) |
| 420Bet | Paid poker tournament purchase fee | policy-exception | The approved policy places the whole buy-in in prize escrow and separately charges a rounded-down 3% fee. Before tournament finality the fee remains refundable. The prize module credits the development recipient at final prize allocation. Route qualification requires authenticated vault forwarding and founder claim evidence, and the fee must be excluded from the general waterfall basis. | [BET-AUDIT-5C.1-TOURNAMENT-DECISIONS.md](https://github.com/abvhiael/420-integrated-v0.1/blob/main/docs/bet/BET-AUDIT-5C.1-TOURNAMENT-DECISIONS.md), [BET-AUDIT-5C.1-TOURNAMENT-POLICY.md](https://github.com/abvhiael/420-integrated-v0.1/blob/main/docs/bet/BET-AUDIT-5C.1-TOURNAMENT-POLICY.md), [PokerTournamentPrizeModule420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bet/tournament/settlement/PokerTournamentPrizeModule420.sol), [PokerTournamentPrizeEscrow420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/src/bet/tournament/settlement/PokerTournamentPrizeEscrow420.sol) |

## Catalogue coverage

| Catalogue | Entry | Disposition |
| --- | --- | --- |
| Genesis launch | 420 AI | shared |
| Genesis launch | 420 Analytics | shared |
| Genesis launch | 420 AppStore | shared |
| Genesis launch | 420 Arbitration | shared |
| Genesis launch | 420 Attention | excluded |
| Genesis launch | 420 Bridge | excluded |
| Genesis launch | 420 Explorer | shared |
| Genesis launch | 420 Faucet | release-disabled |
| Genesis launch | 420 Gaming Protocol | shared |
| Genesis launch | 420 Governance | shared |
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
| Contract ownership | 420 AI | shared |
| Contract ownership | 420 Analytics | shared |
| Contract ownership | 420 AppStore | shared |
| Contract ownership | 420 Arbitration | shared |
| Contract ownership | 420 Attention | excluded |
| Contract ownership | 420 Bridge | excluded |
| Contract ownership | 420 Civic | shared |
| Contract ownership | 420 Commons | shared |
| Contract ownership | 420 ComputeMarket | excluded |
| Contract ownership | 420 Explorer | shared |
| Contract ownership | 420 Faucet | release-disabled |
| Contract ownership | 420 Gaming Protocol | shared |
| Contract ownership | 420 Grants | excluded |
| Contract ownership | 420 Identity | excluded |
| Contract ownership | 420 Launchpad | shared |
| Contract ownership | 420 Market | shared |
| Contract ownership | 420 Messenger | shared |
| Contract ownership | 420 Names | excluded |
| Contract ownership | 420 Notifications | shared |
| Contract ownership | 420 Oracle | shared |
| Contract ownership | 420 Pay | excluded |
| Contract ownership | 420 Pulse | shared |
| Contract ownership | 420 Random | shared |
| Contract ownership | 420 Registry | excluded |
| Contract ownership | 420 Resource Protocol | shared |
| Contract ownership | 420 Rights | shared |
| Contract ownership | 420 Search | shared |
| Contract ownership | 420 Smart Accounts | shared |
| Contract ownership | 420 Stake | excluded |
| Contract ownership | 420 Status | shared |
| Contract ownership | 420 Swap | excluded |
| Contract ownership | 420 Token | policy-exception |
| Contract ownership | 420 Treasury | shared |
| Contract ownership | 420 Trust | shared |
| Contract ownership | 420 Vault | excluded |
| Contract ownership | 420 Verify | shared |
| Contract ownership | 420 Wallet | shared |
| Contract ownership | 420-IS | shared |
| Consumer services | 420Calendar | shared |
| Consumer services | 420Classifieds | release-disabled |
| Consumer services | 420Events | shared |
| Consumer services | 420Freelance | release-disabled |
| Consumer services | 420Launchpad Crowdfunding | shared |
| Consumer services | 420Learn + 420Knowledge | shared |
| Consumer services | 420Location | shared |
| Consumer services | 420Mail | shared |
| Consumer services | 420Media | release-disabled |
| Consumer services | 420Reputation | shared |
| Consumer services | 420Town Community Boards | shared |
| Consumer services | 420Travel | shared |
| Consumer services | 420University | shared |
| Consumer services | Reefer Review Publishing | shared |
