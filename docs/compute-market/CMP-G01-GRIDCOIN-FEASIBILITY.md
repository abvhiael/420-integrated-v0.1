# G-01 — Gridcoin chain and bridge feasibility (GO/NO-GO)

**Decision: NO-GO to implementation, issuance, custody, market listing or transfer activation.** This is a conditional feasibility assessment, not a rejection of Gridcoin itself. As G-01 explicitly requires independent live nodes and a demonstrated credible two-way verification and settlement path, the complete canonical exit is **PENDING**.

## Independent primary-source findings, as of 2026-10-08
- Gridcoin upstream release index: https://github.com/gridcoin-community/Gridcoin-Research/releases. The April 2026 5.5.0.0 mandatory release announced block v13/v14 rules, Bitcoin-style script support (CLTV/CSV) and HTLC create/claim/refund RPCs; it also reports BOINC v3 beacon cryptographic ownership proofs. A programmable HTLC on Gridcoin does **not** imply an Ethereum-compatible verifier or an atomic GRC↔420 route.
- Upstream August 2026 `5.5.1.7-testnet` release documents continued security hardening and altered `-rpcallowip` CIDR behavior, and states **no new consensus rules activated** in that testnet release. Source: https://github.com/gridcoin-community/Gridcoin-Research/releases.
- `5.5.1.5-testnet` release says proposed v15 features (e.g. P2P PSGT pool) remained unactivated and reports wallet node/GUI separation and RPC updates. Source as above. This means bridge design must bind to **actually active consensus versions**, never dormant planned code.
- Gridcoin is a distinct native chain and GRC is distinct from BOINC credit. G-01 cannot inherit Curecoin's chain/genesis, confirmations, signing model, finality or verifier.

## Evidence inventory and unverified decisions
| G-01 requirement | Findings / missing authoritative evidence |
|---|---|
| Network genesis and identity | Specific mainnet/testnet genesis hash, current accepted network magic, canonical chain identification and independently queried nodes **NOT VERIFIED**. Never hardcode guessed constants. |
| Address encoding | Exact supported mainnet/testnet prefixes, base58/bech32 restrictions and script compatibility require matching independent node/official source checks. |
| Transaction model | Bitcoin-derived UTXO/script/HTLC features are evidenced upstream; exact bridgeable output script, proof format and spent-outpoint verification remain unproved. |
| Consensus/finality | PoS rules and active fork/version dependence require actual consensus analysis; no invented deterministic finality or fixed confirmation count. |
| RPC/indexer availability | Maintained RPC code and testnet releases exist; independent geographically separated main/test nodes, resilient RPC/indexing, secure allowlist/authentication and chain history have not been exercised. |
| Signing/custody | Current PSGT/multisig capabilities need active-version verification; whether safe permissionless redemption exists is UNVERIFIED. Federated custody cannot be called trust-minimized. |
| Confirmations/reorg | No approved minimum confirmations, deep reorg simulation, fork choice or contingency reserve policy. |
| Maintenance/licenses | Upstream code/release activity supported; exact license commitments, gateway provider permission, custodial obligations and compatibility review pending. |
| Denomination | Native GRC supply precision/token decimal representation, rounding, output dust and bridge accounting constraints must be verified in official current parameters and real nodes. |
| Bridge policy | Approved governance, sanctions/legal/custodial considerations, caps, emergency redemption and proof of reserves absent. |
| On-chain verification | No demonstrated Gridcoin header/SPV/PoS finality verifier on 420 Integrated. HTLC RPC capability is insufficient. |
| Two-way settlement | No funded tested inbound lock/mint and outbound burn/release with replay, independent finality and redeemability. |
| Liquidity/risk | Market-maker depth, real GRC/$420 price discovery, oracle feeds, liquidity locks and treasury risk approval absent. |

## Architecture recommendation
Current disposition: **research a federated/custodial gateway only as a separately risk-governed candidate**; do not authorize it. Trust-minimized SPV proof validation may require a chain-specific PoS verifier with authenticated checkpoints/fork-choice, approved confirmations and material security testing; feasibility is unproven. A dual-chain atomic HTLC path can be evaluated but is not automatically production-worthy given different execution environments, timelocks, relayer incentives and failure modes.

Before G-02 implementation, require authoritative, pinned version/source commit and independent Gridcoin mainnet/testnet node reports, documented chain identity and asset decimals, confirmations/reorg model, signed custody and permissions assessment, provider/route operator commitments, quantified liquidity/reserve and insolvency risk, independently reviewed viable two-way settlement design and formal governance approval. If credible verified redeemability cannot be shown, **stop**. No Gridcoin bridge, wrapped GRC or Exchange market is deployed, listed, funded or granted authority by G-01.

**Level 1**: G-01 fail-closed assessment tests and retained app suite. **Level 2**: actual bridge route integration only when architecture and independent testnet evidence exist. **Level 3**: accumulated merge-candidate closure only, avoiding duplicate full Foundry and Genesis inventories. **Next canonical step: G-02 — Bridge threat model and route architecture**, conditional on G-01 GO; until then G-02 is research-only.
