# BRIDGE-AUDIT-3.V.6 — BNB Smart Chain local qualification

Baseline: `main` at `bb4bd6374d561bcba65345a1dbc86c0c70d53272`. Local implementation and qualification complete; source deployment and route activation are not represented by this result. Canonical BNB configuration stays inactive. No other open verifier branch was merged or rewritten.

| Assigned requirement | Implementation and evidence |
| --- | --- |
| BNB-specific finality | `BnbConsensusLightClient420`: two linked BSC vote certificates finalize the first target. Raw execution headers bind every hash and root. RPC finality labels have no authority. |
| Validator sets and signatures | Mainnet-domain Parlia secp256k1 seals; canonical vote RLP; address-sorted paired voting keys; `ceil(2*N/3)` quorum; exact target-parent snapshot selection; actual BLS12-381 POP signature computation. |
| Validator transitions | Epoch announcement finalized by its old committee before authentication; activation derived from the preceding roster and turn length. Unknown epoch activation cannot extend the old committee indefinitely. Historical different rosters switch at 116,664,087. |
| Execution and receipt inclusion | Exact finalized block number/hash/receipts root, header transaction root, transaction identity and receipt at the same MPT index. Success status and the canonical deposit event are mandatory. |
| Ethereum reuse | Exact `EthereumRLP420` and `EthereumMPT420` from independently qualified ETH SHA `2d766cb0421cdfb3b28a1cd5dc14991b03c16cc3` (PR #1157, 93 preserved passing tests). Included directly without depending on that PR being merged. |
| Network and gateway bindings | Mainnet chain ID 56 in header seals, snapshot commitment and deposit message domain. Gateway allowlist, token/asset mapping, destination chain/router and route binding enforced before replay consumption. Source escrow supports native BNB and explicitly enabled exact-amount BEP-20 transfers. |
| Historical qualification | 97 genuine header hashes and seals; four genuine 20-of-21 BLS certificates; finalized targets 116,664,000 and 116,664,090; all 81 transactions and receipts of block 116,663,999 reproduce both trie roots. Native and token inclusion vectors retained. |

## Cryptographic backend and trust

The repository targets Cancun. BLS verification therefore uses **software BLS12-381**, not an assumed EIP-2537 precompile, relayer assertion, fabricated oracle or RPC response. Only existing SHA-256 and modular-exponentiation precompiles are required. A permissionless job advances deterministic subgroup multiplication, cofactor clearing, Miller steps and final exponentiation. Supplied square-root witnesses are checked against the exact decompression/SWU equations and canonical signs. Neither alleged intermediate states nor an alleged pairing result can be submitted.

Keys and signatures are checked for canonical compressed representation, non-infinity, curve membership and prime subgroup membership. The hash-to-curve matches independent py_ecc output. A different-message signature fails the full pairing equation; the on-curve order-three point `(0,2)` fails subgroup validation. Completed accepted job identifiers bind the exact selected keys, VoteData hash and signature. Validator registration's POP trust comes from the authenticated native BSC validator roster; no unauthenticated key registration is provided by this client.

Bootstrap is a trusted commitment to **all three** checkpoint/current-epoch/previous-epoch header hashes and chain ID 56. A checkpoint hash alone is not misrepresented as authenticating an arbitrary supplied roster. Bootstrap selection and freshness belong to deployment configuration. The implemented profile is mainnet Maxwell and later (epoch length 1,000, Bohr-family epoch records), including the historical Fermi-era evidence. This is a finality-certificate light client, not an EVM replay engine or a complete PoSA non-finalized fork-choice implementation. It relies on the native consensus assumption that an authenticated validator quorum signs valid blocks. Finalized ancestry cannot be replaced; intervening headers are hash-linked to the immutable existing finalized checkpoint.

## Qualification

**29 targeted Solidity tests passed**, including **2,500 field-arithmetic fuzz cases**. Actual stdout and bytecode sizes are in `contracts/test/fixtures/bnb/qualification/`. There is no CI run ID: no GitHub Actions run was launched; the coherent qualification commit uses the repository's existing `[skip ci]` convention. The BNB workflow is path-scoped for future relevant changes. Unrelated docs and contract-hardening paths exclude this independently qualified closure. Existing ETH/LTC/DOGE SHA/run evidence is preserved.

An actual failing test found a 51,611,876-gas Miller progress call. The operation was split into deterministic substeps; the affected historical signature/finality test passed afterward with every progress call below 30 million gas. A separate transaction-budget test found 68,142,432 gas for uncached 89-header ancestry. Permissionless canonical-header parsing by computed hash now allows that ancestry to be prepared in separate calls; cached data grants no finality or committee authority. The affected finality and cache-authority tests pass, and the prepared finalization fits below 30 million gas. No assertion was weakened. Unchanged hash-to-curve and bootstrap evidence was retained, rather than rerun merely because unrelated Miller-loop code changed.

Software BLS has substantial operational cost: roughly **41–45 billion gas and thousands of transactions per certificate**. The complete four-certificate historical transition test consumed **170,186,425,858 aggregate test gas**, over **203.74 seconds** locally. This proves correctness and bounded progress, not economical live deployment. All runtime and initcode sizes satisfy EIP-170/EIP-3860. The qualification harness's large aggregate gas allowance and test-only code-size allowance do not constitute production deployment allowances.

Historical ordinary transactions qualify inclusion and execution success; they are correctly rejected as 420 gateway deposits. Controlled local source escrow executions qualify the exact gateway event, recipient/amount and destination bindings. No historical production 420 gateway deposit, source-deployed address, live custody or source withdrawal service is claimed. Existing deployment/activation requirements remain in the canonical configuration; they are not new roadmap steps.

Reproduce the independent offline oracle:

```sh
python3 -m pip install -r contracts/test/fixtures/bnb/requirements.txt
python3 contracts/test/fixtures/bnb/verify.py
```

Reproduce each targeted owner once (the adversarial contract inherits historical helpers/tests, so exclude the inherited historical tests there):

```sh
python3 scripts/qualify-bnb.py --match BnbConsensus420.t.sol
python3 scripts/qualify-bnb.py --match BnbBlsSoftware420.t.sol
python3 scripts/qualify-bnb.py --match BnbAdversarial420.t.sol --exclude-test testHistorical
python3 scripts/qualify-bnb.py --match BnbExecution420.t.sol
python3 scripts/qualify-bnb.py --match BnbBridgeAdapter420.t.sol
python3 scripts/qualify-bnb.py --match BnbSubgroup420.t.sol
python3 scripts/qualify-bnb.py --match BnbCallGas420.t.sol --match-test testHistoricalFinalizationFitsSingleTransaction
BNB_SOLC=solc python3 scripts/verify-bnb-bytecode.py
```

Source archive, pinned protocol/formula references, fixture checksums, independent derived outputs and exact source closure fingerprints are stored beside these commands. All acquisition is reproducible from the named JSON-RPC methods; offline verification needs no source RPC or archive subscription. The unavailable bulk receipt endpoint was bypassed with individual receipts, then independently checked against the genuine receipt root.

Next numbered assignment: **BRIDGE-AUDIT-3.V.7**, not started. Its canonical title is absent from the checked-in roadmap and matching repository issues; no chain or task title is invented here.
