# BRIDGE-AUDIT-8 — Remaining Chain and Token Adapter Qualification

Base main: `e382c5e508816cb3c508a0b7c2ac11300f1b4b3b`. Locally executable reconciliation, the actual BNB adapter corrections and targeted qualification are complete. Production activation is not authorized. All existing chain/token profiles remain byte-identical and inactive; completed V12.5 implementations and original test evidence are preserved. Exact publication/main SHA is recorded in the associated PR.

## Chain identities, proof boundaries and external dependencies

The machine [reconciliation record](remaining-adapters-qualification/RECONCILIATION.json) stores exact mainnet fingerprints, internal route-chain IDs, adapter identity preimages, profile/source checksums, original qualification SHAs/case counts, retained adapter test owners and per-network trust boundaries. Internal non-EVM route IDs are not provider-assigned EVM chain IDs. The Genesis catalogue, canonical Bridge asset/route/chain registries and current verifier inventory remain authoritative; historical catalogue progress labels are not live deployment approval.

| Chain | Authenticated network/finality boundary | Base units / decimals | Remaining production dependency |
| --- | --- | --- | --- |
| BNB | Chain ID 56, approved bootstrap/committee and two linked native BLS quorum certificates; receipts/transaction execution proof | wei / 18 | Actual bootstrap/gateway deployment and live software-BLS resource qualification; existing aggregate gas cost is not erased by local admission tests |
| DOGE | Mainnet genesis `1a91e3…c355691`, magic `c0c0c0c0`, chain ID 98, Scrypt/AuxPoW ancestry/work and confirmations | koinu / 8 | Owned gateway/custody, live Scrypt/header relaying and operational confirmation/reorg evidence |
| LTC | Mainnet genesis `12a765…e04bfe2`, magic `fbc0b6db`, canonical Scrypt ancestry/work and minimum 12 confirmations | litoshi / 8 | Owned gateway/custody and operational multi-call Scrypt infrastructure |
| XRP | XRPL mainnet domain/network ID 0, trusted UNL/manifest quorum, SHA-512Half ledger/SHAMap and successful native payment metadata | drops / 6 | Current deployed validator-list/epoch authority and funded gateway/tag/domain qualification |
| TRX | Pinned mainnet genesis and `TRON/MAINNET`, authenticated SR schedule and 19 distinct active SR signatures on consecutive blocks; inclusion and successful native execution | sun / 6 | Fresh deployed SR/checkpoint authority and funded memo/domain-bound gateway/custody |
| POT | Pinned upstream mainnet identity/source; post-500 PoS native replay/UTXO/modifier/fork boundary | pot-satoshis / 8 | Genuine post-bootstrap corpus and native replay/build/authority evidence remain unavailable; full native qualification remains open |
| BOB | Mainnet genesis `6d2d7d…0159969`, magic `a0fb1783`, pinned native Scrypt/difficulty/chain-work replay, scheduled AuxPoW and 288 confirmations | base units / 8 | Native replay authority/checkpoints/service, actual gateway and custody |
| CURE | Mainnet genesis `00000ce4…b688fc`, magic `e4e8e9e5`, authoritative historical PoS/replay rules and source UTXO provenance | micro-CURE / **6** | Production replay authority/service/checkpoint and funded gateway/custody |
| ARRR | Pinned Pirate genesis/source, Equihash component and authenticated shielded-note/memo/nullifier boundary | arrrtoshi / 8 | Actual Pirate/KMD/onward-anchor dPoW/notary proof authority and owned viewing/custody service remain unqualified; full native verifier acceptance stays open |

Full unshortened hashes and historical source provenance are retained in the machine record and original native audits. POT's internal serialized genesis is byte-reversed relative to its display fingerprint; both are checked. Its main/test genesis and magic overlap, so that fingerprint alone never establishes mainnet authority. CURE is explicitly six decimals, not the eight used by the other listed UTXO profiles. No native balance is rescaled by guessing its ticker or chain family.

All nine adapters require their immutable router, approved verifier and route/asset binding. Native gateway scripts, account/tag/memo domains, shielded gateway key/program and canonical source token identities retain their existing allowlists and authenticated-verifier boundaries. The complete native verifier/primitive graphs are unchanged, including their native signature/inclusion/replay evidence and resource models. A controlled mock returning a valid-looking struct is not source finality. POT, ARRR and the reused Solana finality infrastructure retain their explicit source-authority gaps; a running destination testnet cannot manufacture those dependencies.

## BNB corrections from actual failures

A new regression reproduced acceptance of a 20-byte zero EVM recipient. BNB now rejects it before consuming its outbound nonce, consistent with the existing canonical Ethereum recipient boundary.

The affected existing BNB owner exposed a second actual failure: `testDestinationAndRouteCannotBeSubstituted` returned an accepted transfer for a different destination chain. Its retained trace shows the adapter accepting that mocked verifier result. `verifyInbound` now independently requires destination chain equal to `block.chainid`, destination router equal to its immutable gateway router, and certified route equal to the configured asset route, before replay consumption/accounting. The existing native finality/message verifier and chain-consensus implementation are unchanged. All 12 BNB adapter cases pass after correction, including the original unchanged substitution assertion; no assertion was weakened.

Two concrete BNB execution tests initially failed because the shared isolated qualification runner did not copy the existing BNB fixture directory. The runner now copies those fixtures; only those two failed cases reran and passed without recompilation. Controlled native gateway composition/replay/domain checks and actual historical transaction/receipt inclusion rejection are qualified; no expensive BLS/history corpus suite was repeated.

## Outbound and authorization qualification

Eleven new multi-chain cases verify exact request-ID serialization, sender/route/asset/nonce and amount binding, supported recipients, wrong route/asset/recipient rejection, direct inbound/outbound router bypass and unauthorized verifier rotation across all nine adapters. A separate zero-address BNB case completes the new twelve-case coverage. The outbound fixture's empty verifier stub cannot authenticate a deposit and is used only for encoding and authorization checks.

| Family | Supported outbound recipient/message boundary |
| --- | --- |
| BNB | Nonzero packed 20-byte EVM address; native wei amount, route/source-asset/sender/nonce/extra bound in the existing ID |
| DOGE / BOB | 20-byte hash160 and one-byte P2PKH/P2SH type; exact native base-unit amount and nonce |
| LTC | P2PKH/P2SH/P2WPKH use 20-byte programs; P2WSH/P2TR use 32 bytes; all five script kinds tested |
| POT / CURE | 20-byte hash160, P2PKH/P2SH type and chain-specific address version committed to the request |
| XRP | 20-byte account, one-byte tag-presence flag and four-byte big-endian destination tag; absent-tag canonical zero and present-tag cases tested |
| TRX | 21 bytes with mainnet `0x41` prefix plus 20-byte payload; wrong prefix rejected |
| ARRR | Canonical checksummed Sapling `zs` or Ironwood `pirate` address and matching shielded-pool marker; transparent/wrong-pool behavior retains existing rejection evidence |

These outbound functions construct bound requests; their event/ID is not a signed native transaction or delivery acknowledgement. They do not authorize independent custody release, minting or settlement completion. Production custody/withdrawal execution remains a deployed qualification prerequisite; no Bitcoin signing implementation is copied into other chain families. Existing risk, route health, emergency isolation, current runtime/configuration qualification and persistent replay checks remain enforced by the canonical router/registries. Unsupported source families, unqualified adapters and inactive routes cannot use these request boundaries to authorize production settlement.

## Token extensions

| Token | Source network | Canonical source contract/mint bytes | Decimals |
| --- | --- | --- | --- |
| AAVE | ETHEREUM | `0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9` | 18 |
| AUDIO | ETHEREUM | `0x18aaa7115705e8be94bffebde57af9bfc265b998` | 18 |
| EURC | ETHEREUM | `0x1abaea1f7c830bd89acc67ec4af516284b1bc33c` | 6 |
| EURC | SOLANA | `0xfc931a2b58cd23db2d91d296d96505a06f80942083f841e8a887f138ac030437` | 6 |
| LINK | ETHEREUM | `0x514910771af9ca656af840dff83e8264ecf986ca` | 18 |
| QCAD | ETHEREUM | `0x3fa142dd3f384414e05e71ad0939274edc82ec0a` | 6 |
| RAY | SOLANA | `0x37998ccbf2d0458b615cbcc6b1a367c4749e9fef7306622e1b1b58910120bc9a` | 6 |
| UNI | ETHEREUM | `0x1f9840a85d5af5bf1d1762f925bdaddc4201f984` | 18 |
| USDT | ETHEREUM | `0xdac17f958d2ee523a2206206994597c13d831ec7` | 6 |

These are nine routes for eight symbols: EURC is independently qualified on Ethereum and Solana. They reuse the qualified Ethereum/Solana verifier and adapter, rather than introducing token consensus implementations. Exact approved source token/mint, gateway/program, route, local destination representation and decimals are bound by `BridgeAssetRegistry`/`SupportedTokenRoutes420`. Duplicate source/destination substitution, disabled routes, precision dust/overflow, incompatible transfer fees/rebases, legacy addresses, Token-2022 and unauthorized token mappings retain their source-pinned unit/integration/fuzz evidence. SPL amounts retain the uint64 wire limit; Solana recipients retain all 32 bytes. No unknown BEP-20 token is admitted from a mapping alone.

`verify-token-routes.py` passes the existing nine profile/source-decimal/mint observation checks, independent catalogue fixture, issuer-route separation and dependency identity checks. Historical RPC mint/decimals observations identify configuration inputs only; they cannot authorize a gateway transfer. Destination token/precision bindings remain unassigned until the actual canonical representation is deployed/registered and qualified. CCTP USDC and issuer LayerZero CADC remain separate provider paths; neither can enter through the generic token adapter.

## Actual evidence and closure

[RESULTS.json](remaining-adapters-qualification/RESULTS.json) qualifies **26 distinct cases**: twelve new encoding/authorization/recipient cases and fourteen affected existing BNB adapter/execution cases. There are 37 recorded pass observations because the earlier eleven BNB passes were superseded by the corrected 12-case owner; those duplicates are explicitly excluded from the distinct count. Original failure logs, exact intermediate/current source manifests and source snapshots remain intact. The later BNB change affects inbound domain checks only; byte-identical outbound function bodies preserve the already passing outbound cases. The qualification checker validates this source relationship and each resolved failed case, including passing cases from a batch with unrelated fixture failures.

No new fuzz/invariant or expensive native consensus replay was needed: those passing source graphs and original evidence were preserved. All twelve native verifier graphs remain byte-identical, nine additional chain profiles and nine generic token profiles are unchanged, and production approvals remain empty. Runtime-size checks remain below EIP-170. CI run IDs for this step: none; new local logs are not claimed as GitHub Actions runs. Original SHAs/run IDs in the source inventory are retained.

Reproduce with commands in each `.inputs.json`; run `python3 scripts/verify-remaining-adapters.py`, `python3 scripts/verify-token-routes.py` and `python3 scripts/verify-final-verifier-inventory.py`. The step's `SHA256SUMS` binds implementation, runner correction, manifests, logs and documentation. The associated PR records the qualified SHA and verifies its exact tree on main.

The [existing testnet work roadmap](420BRIDGE-TESTNET-WORK-ROADMAP.md) owns actual deployed trust roots, gateway/custody, registered destination assets and funded source-network qualification. Existing full-source gaps for POT, ARRR and Solana remain explicit and fail closed. No unsupported verifier family is promoted and no production route is activated. The next available canonical action is the existing per-network testnet qualification/handoff; no new numbered roadmap step is invented or started.
