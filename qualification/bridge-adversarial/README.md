# BRIDGE-AUDIT-3.V.18 — reproducible adversarial qualification

Baseline main: `97413f2eea862d5f2ec3117313cd3beb15a634f4`. The source lock uses the latest inspected qualified audit PR heads for implemented verifiers absent from main. These pins do not imply those PRs have merged. The underlying Ethereum verifier files in the token-route qualification revision match the Ethereum qualified source; token-route tests/evidence are retained separately, without another chain verifier implementation.

## Qualification result

113 Foundry passes: 80 new adversarial tests/invariants plus 33 affected CADC adapter/router regressions. The runs include 42,500 fuzz inputs and 122,880 stateful invariant calls, with zero handler reverts. All fourteen verifier families have fresh malicious-envelope unit/fuzz/invariant evidence. An additional BNB stateful owner verifies that conflicting header-cache entries and uncomputed finality claims cannot replace the finalized prefix or authorize a committee. 182 original log files preserve 1,012 passing-case records (including repeated records and previously diagnosed failures; these are not 1,012 newly executed or necessarily unique tests).

The [attack matrix](../../docs/audit/adversarial-qualification/coverage-matrix.json) has 196 family/category entries: 182 applicable implemented-boundary entries with concrete retained/new passing references, and 14 explicit entries not implemented at that layer. PoW has no validator quorum; stake/BFT does not use cumulative PoW chain work; Circle/LayerZero source consensus/inclusion is delegated to their authenticated issuer/DVN path. Those native authorization and finality-policy boundaries are tested. A pattern match nominates case references; it is not itself evidence of cryptographic correctness. Valid-context consensus, inclusion, gateway and redemption attacks use the retained concrete verifier qualifications. Adapter mocks alone are not consensus evidence.

| Family | Qualified original source | New passes | Affected regression passes |
|---|---|---:|---:|
| bitcoin | `97413f2eea862d5f2ec3117313cd3beb15a634f4` | 5 | 0 |
| ethereum | `2d766cb0421cdfb3b28a1cd5dc14991b03c16cc3` | 5 | 0 |
| litecoin | `5741522429732437b92b3a9e0d0f659d6b781b1f` | 5 | 0 |
| dogecoin | `cfafb347a3f4c1f8401df47488a78c30922af3b8` | 5 | 0 |
| bnb | `f28a454008450d5ad5d95e6d07cf1841bf7d1bc5` | 7 | 0 |
| solana | `97413f2eea862d5f2ec3117313cd3beb15a634f4` | 7 | 0 |
| tron | `97b1323b27d8208dba3843734cf2275b63e47bfd` | 5 | 0 |
| xrpl | `d37d35a18668d68cc960aae6be19441f241a7e2a` | 5 | 0 |
| potcoin | `e2f1230095f7261a29610f786b1eb48e0b6d0623` | 5 | 0 |
| curecoin | `30dcfe4d990bb5b65add04fcc8214b3aff91ea1f` | 5 | 0 |
| dobbscoin | `97ba7bcbfe9a28e4fc1709248015d5a9b7d25a04` | 5 | 0 |
| pirate | `02c96466f03b203a682c548cb1a6e591848aa4af` | 7 | 0 |
| cctp | `0a677dc9c7eedc2f56c5b35141ae770a2e13e679` | 5 | 0 |
| cadc | `6ca38ccba5fbec26dced66ee21d08ddecd5a5b16` | 9 | 33 |

## Corrections

**CADC canonical envelope and bounded decoding.** The existing EndpointV2/ULN/OFT fixture reproduced native delivery from a valid authenticated packet wrapped with trailing bytes. The original GUID/DVN checks still applied; the defect was acceptance of alternate proof serialization and the absence of an early bound before decoding. The production adapter now requires the already supported simple 40-byte OFT message's exact 192-byte ABI envelope and canonical re-encoding. Trailing data, dirty padding and relocated dynamic tails cannot deliver, mint or consume replay keys. A canonical positive control succeeds. 31 affected adapter tests and both inbound router delivery/atomic-risk-rollback tests pass. Unchanged outbound and genuine historical fork evidence retains its original source revision and results.

Main contained a CADC stub. This change integrates the qualified CADC adapter and its required interface from PR #1169, with the envelope correction above. Its complete production import closure matches the tested closure. The compiled deployed-code template is 12,332 bytes, within EIP-170; no live endpoint, issuer role or production route is configured by this repository change.

**Solana dependency restoration.** Main imported `solana/vendor/Sha512.sol` but did not contain it. The exact original bytes are restored with their license from the XRPL qualified revision. SHA-256 `96a74497a31f38c57bbf989e66575ae72338bbce950cbbf9bc202cb52cd91eb8` matches the earlier Solana qualification's published source checksum. This repairs reproducibility without changing the qualified SHA-512 algorithm or rerunning its prior passing vectors. The new Solana envelope suite, seven independently calculated integer-format vectors and 2,500 dirty-high-bit rejection inputs pass.

**Explicit integer limits.** New Pirate tests authenticate controlled native records around the retained genuine header, then reject note positions above uint32 and native amounts above the source money limit, including uint64 extremes. These are controlled boundary tests, not owned shielded deposits or newly established dPoW evidence.

## Reproduce only affected qualifications

Requirements: Git source objects for the locked commits, Python 3.10+, Foundry 1.9.0 and solc 0.8.24. If necessary, fetch each exact locked source commit from the authoritative origin. Tests live outside default Foundry discovery because unmerged verifier dependencies are compiled from their exact pinned Git closures. The runner copies unmodified source bytes, the explicit corrected/restored files and selected tests into an isolated project; it does not replace verifiers with mocks or rewrite compiler inputs.

```sh
python3 scripts/qualify-bridge-adversarial.py --family bitcoin   --workspace /tmp/bridge-v18-bitcoin --forge forge --solc /path/to/solc-0.8.24   --inputs /tmp/bitcoin-inputs.json --log /tmp/bitcoin.log
```

Select another locked family for its new suite. Additional owner and test selectors used for integer/affected integration checks are recorded exactly in the corresponding `*-inputs.json` files under [qualification records](../../docs/audit/adversarial-qualification/). `--original` reproduces the original CADC behavior with the negative trailing-envelope test; its expected failure is retained separately. The runner rejects zero passing tests and nonzero Forge exits. It reuses build cache but executes only selected owners/functions. No old consensus suite is automatically rerun.

```sh
python3 scripts/report-bridge-adversarial.py
```

The report checks every retained log against its pinned Git bytes, every executed Solidity/fixture input against recorded hashes, the recovered SHA-512 pin, and the seven Python `struct.pack('<Q')` / SHA-256 golden instruction vectors. It then rebuilds the machine-readable result and reviewed attack-reference map. Reproduction commands/temporary paths in original input records are historical execution metadata; code/fixture hashes identify the tested inputs.

## Precise limits

The fresh envelope invariants exercise untrusted relayers without authorized deposits / installed finality profiles. They supplement retained authenticated-context forgery, chain-selection, wrong-domain, gateway, token and replay tests; they do not independently prove those deeper properties. Each hostile call forwards 500,000 gas and must finish below 450,000, excluding caller payload construction and transaction calldata gas. Maximum-sized payload construction can cost far more than a deployable block; these tests do not claim otherwise. Existing bounded-progress/valid-proof cost qualifications remain unchanged, including BNB software BLS's billions-of-gas, multi-transaction cost.

Independent reference evidence remains under its original revision: native Bitcoin-family hashes/difficulty/work/Merkle oracles, Ethereum consensus/BLS/MPT proofs, BNB py-ecc vectors, Solana RFC/SDK/signature/SBF tests, Tron native wire/signature history, XRPL SHA-512Half/SHAMap/validator history, PoS native kernel/replay checks, Dobbscoin native AuxPoW/reorg checks, Pirate native Equihash/shielded worker checks, and actual pinned Circle and LayerZero native protocol execution. No claim upgrades RPC observations, controlled authorities or unrelated payments to authenticated gateway finality.

Existing source-chain authority, genuine historical gateway, PotCoin corpus, Pirate native shielded/dPoW, and 420 issuer/deployment limitations remain exactly those recorded by the earlier audits. No production acceptance is inferred. Local V.18 checks are complete; these pre-existing deployment/evidence dependencies remain open. No merge was requested. The repository does not define the next canonical task after V.18; none is invented or begun.
