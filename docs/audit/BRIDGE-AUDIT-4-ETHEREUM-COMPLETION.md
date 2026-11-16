# BRIDGE-AUDIT-4 — Ethereum and ERC-20 completion

Baseline main: `6a462f59e375b6873719d09c68b13913b8df7a95`. The supplied task's doubled leading B is normalized to BRIDGE-AUDIT-4. Qualified source and merge status are reported by the associated PR; current input hashes bind the qualification without a self-referential commit hash.

## Original requirements

| Requirement | Implemented boundary / qualification |
| --- | --- |
| Ethereum adapter | Existing concrete EthereumBridgeAdapter420, qualified through actual router/route/risk/transfer components; affected adapter and token regressions retained/requalified |
| Finality oracle and message verifier | EthereumConsensusLightClient420 implements IEthereumFinalityOracle420; immutable SP1/Helios consensus proof, SSZ execution binding and finalized ancestry; EthereumGatewayMessageVerifier420 authenticates transaction and successful receipt inclusion against the same finalized header |
| Chain, block, gateway and event | Chain 1, exact header hash/receipt root, canonical log, destination EVM/router/route, token/sender/recipient/amount/nonce and reconstructed deposit message identity enforced; adapter independently allows gateways |
| Canonical tokens and representations | Seven frozen Ethereum ERC-20 source profiles; bidirectional unique mappings, exact approved destination representations and runtime/configuration qualification through BridgeAssetRegistry |
| Decimals, normalization, rounding | Onchain source decimals and canonical profiles; checked precision conversion, no truncation/dust or overflow; tests cover all approved profiles |
| Unsupported token behavior | Ingress allows only canonical supported profiles and verifies exact gateway credit and sender debit before/after transfer, including nonstandard optional return handling; fee/rebase/incorrect-transfer mutations reject |
| Outbound construction | Existing qualified digest formulas retained; typed persisted payload now exposes source chain/router/adapter, message/route/asset, sender/recipient, local and Ethereum amounts, source asset, nonce and extra data; unknown IDs reject; zero recipients reject before nonce consumption |
| Source-gateway settlement interface | IEthereumSourceGatewaySettlement420 specifies typed withdrawal input, mandatory finalized burn/escrow backing proof and authenticated delivery evidence; request transport alone cannot authorize release |
| Replay, malformed, finality and substitution | Original cryptographic/receipt corpus and adversarial evidence preserved; affected current integration checks and new payload rollback/fuzz/invariant tests recorded in ethereum-completion-qualification/RESULTS.json |

## Outbound and custody semantics

`EthereumBridgeAdapter420.outboundMessage(messageId)` returns the public, immutable request created only by the configured router. Original `EthereumOutboundRequested` event and native/token message-ID encodings remain unchanged. `EthereumOutboundPayloadStored` supplies the request ID and nonce for discovery. Auxiliary bytes are public blockchain data and must not contain credentials.

`localAmount` is the destination representation quantity; `ethereumAmount` is the exact original-token quantity after checked conversion. `ethereumAsset` is the canonical token address encoded as bytes32, or the existing native-ETH sentinel. Both quantities are committed in existing token message IDs. Native ETH retains its original equal-precision encoding. A failed outer transaction removes the request and nonce atomically.

The settlement interface is the Ethereum custody-provider integration boundary, not a newly invented source-consensus verifier. An implementation must authenticate the approved 420 chain/router/adapter, message and full payload, finalized representation burn or escrow backing, canonical Ethereum token, gateway domain, recipient/amount, and persistent replay before release. An outbound request is only SOURCE_PENDING and is not burn, backing or settlement evidence. The existing EthereumDepositGateway420 remains deposit escrow ingress. No permissionless withdrawal implementation, custody authorization, production release or live finality qualification is claimed. Those genuine deployment/authority dependencies remain on the existing testnet roadmap. Canonical router completion still rejects proof-only adapters without authenticated delivery evidence.

## Evidence preservation

Ethereum's original 93-case qualification at `2d766cb0421cdfb3b28a1cd5dc14991b03c16cc3` retains its genuine consensus proofs, 221 transaction/receipt tries, reference checks and source hashes. Twelve source-consensus component graphs, including the Ethereum finality/message verifier implementations, remain unchanged. V.16 precision and behavior evidence and V.22 integration evidence remain attributed to their original sources. No historical proof, native BLS/consensus or fork suite is rerun merely for this transport addition.

Only the Ethereum adapter's outbound behavior and two positive token test fixtures supersede V.22 Solidity inputs. The fixture change replaces an all-zero test recipient with a valid address and updates its independently calculated digest/transfer identity; assertions are retained. Qualification extensions explicitly bind old/new hashes to current executed manifests; original manifests and logs are immutable. The final inventory validator checks both the retained evidence and each superseding qualification instead of rewriting old hashes.

Current local qualification passes **54 tests, 7,500 fuzz inputs and 128 invariant runs / 8,192 calls / zero handler reverts**. This includes nine new unit/fuzz/invariant/payload cases and 45 affected existing regressions. The Ethereum adapter runtime is **7,498 bytes**, below EIP-170. All five current input manifests match; the retained twelve consensus graphs remain unchanged.

Actual current counts, tools, commands, source input hashes and EIP-170 assertions are in `ethereum-completion-qualification/RESULTS.json` and companion logs. No new CI run ID is claimed for local runs. Existing passing evidence is preserved; publication skips redundant CI.

## Remaining external qualification

Live Ethereum synchronization/finality freshness, operational proving/bootstrap, actual approved source gateways, immutable/proxy/token identities, funded custody and finalized 420 burn/escrow-backed withdrawals require genuine deployed authority and live evidence. No production approval is added. The next available canonical work is the Ethereum live qualification already owned by the existing testnet roadmap; no subsequent audit task is invented or begun.
