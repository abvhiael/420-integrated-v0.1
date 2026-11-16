# BRIDGE-AUDIT-3.V.16 — Supported Token Route Qualification

Base: authoritative `main` `97413f2eea862d5f2ec3117313cd3beb15a634f4`. This implements the original supported-token qualification scope. It adds no chain-consensus algorithm, production address, issuer approval, risk limit, branch restriction or new roadmap phase. **Local route implementation and qualification are complete; deployment-dependent production acceptance remains open and every declared route remains inactive.**

## Authoritative route reconciliation

The launch catalogue, all nine generic token profiles, frozen issuer route risk declarations, actual `BridgeAssetRegistry` and Registry-resolved canonical asset/route/chain dependencies are reconciled in `contracts/config/bridge/supported-token-routes-v1.json`. The JSON is an inventory and reproducible qualification ledger; it cannot activate a route or replace deployed registry state.

| Source chain / path | Independently qualified generic routes | Source units |
| --- | --- | --- |
| Ethereum / existing Ethereum verifier | AUDIO, UNI, LINK, AAVE | 18 decimals |
| Ethereum / existing Ethereum verifier | USDT, trust-era QCAD, EURC | 6 decimals |
| Solana / existing Solana verifier | EURC, RAY | 6 decimals, classic SPL Token, uint64 amounts |

Seven Ethereum contracts and two Solana mint addresses are pinned from the authoritative profiles, with an independently generated Solidity catalogue fixture. Legacy QCAD, unknown contracts/mints, wrong-chain representations, native-asset substitution and Token-2022 cannot satisfy these profiles. ERC-677 LINK uses its ERC-20 transfer interface; it does not grant callback spending authority. USDT's empty successful return is supported, while false, reverting or malformed returns fail closed.

Eight issuer route declarations are accounted for separately: three configured CCTP source domains (Ethereum, Base, Arbitrum) and five frozen CADC source declarations (Ethereum, Base, Polygon, Solana, paused Arbitrum). These are not nine more generic ERC-20/SPL routes. CCTP and CADC source identifiers, decimals, status and unresolved destination asset IDs are retained from their exact qualified PR snapshots under `token-route-dependencies/`; no new native issuer asset identifier is assigned. Current main still has reverting issuer adapters and legacy CADC data. PR #1168 (`0a677dc9c7eedc2f56c5b35141ae770a2e13e679`) and PR #1169 (`6ca38ccba5fbec26dced66ee21d08ddecd5a5b16`) are explicit unmerged dependencies, not silently treated as integrated or active. CADC Arbitrum remains paused. No unsupported CCTP domain is inferred merely from a historical message fixture.

## Runtime policy and precision

`BridgeAssetRegistry.TokenRoute` records the approved source asset, adapter and verifier identities, gateway, verifier dependency snapshot, destination decimals, qualification evidence hash and enabled flag. Only existing Genesis governance can configure it. The adapter's configured policy must expose the Bridge asset-registry component identity; real activation must resolve to the actual canonical deployment. Generic source mappings and ticker/metadata alone no longer qualify a token route.

Each token admission checks the canonical compiled source profile, the exact authorized adapter caller, current verifier and dependency runtime identities, exact approved gateway, active Bridge asset, usable canonical asset-registry mapping, deployed destination token and its current decimals. The live route must match the source contract/mint, compact canonical source-chain ID, local destination chain, destination token, adapter, pinned verifier snapshot, direction and current chain identities. Changes to a verifier or its oracle/message-verifier/quorum identity invalidate the snapshot. Legitimate chain-consensus state progression remains governed and verified by the underlying verifier rather than duplicated in a token module.

Raw source amounts are converted to registry-approved destination units before router risk/accounting/lifecycle admission. Conversion is exact: no rounding, zero amounts, exponent overflow or multiplication overflow. Outbound conversion reverses the same mapping; dust is rejected. SPL source or requested destination amounts must fit its actual uint64 wire field. Registry token suspension, destination replacement/decimal drift, source/mint substitution and stale route/verifier configuration fail closed. Replay stores remain in the underlying adapters, including across configuration changes.

All nine routes are checked independently, including both EURC sources sharing one authorized local destination representation. Actual common-router tests show normalized risk usage, `VERIFIED` inbound state and rollback of adapter replay/source context when admission fails. Source-side escrow already committed on another chain cannot be rolled back by a destination rejection; it remains subject to existing recovery and custody arrangements.

Outbound adapter requests retain the original intent-only lifecycle: `SOURCE_PENDING` does not assert token custody, source withdrawal execution or destination delivery. The request commits local and converted source units for token paths; the existing outbound event amount is the converted remote/source-unit amount, while the transfer registry and risk manager retain local units. Native ETH/SOL/BNB request digests are preserved. No local mint authority, new withdrawal custodian or fabricated source settlement is introduced. The existing approved withdrawal-custody/deployment requirement must be fulfilled before production activation.

## Gateway execution and verifier reuse

The qualified Ethereum source implementation is reused from PR #1157, SHA `2d766cb0421cdfb3b28a1cd5dc14991b03c16cc3`. Thirteen production dependency files are byte-for-byte unchanged, including the consensus light client, SP1/Groth16 verifier, SSZ, execution header, RLP/MPT, finality composition and gateway receipt verifier. Their original chain-consensus and historical-proof evidence remains at its original SHA; it was not rerun. Only its Ethereum adapter and escrow gateway receive token-route changes. The existing gateway/finality interfaces retain the qualified destination/router/route bindings.

The Ethereum gateway now admits only the seven canonical token profiles, validates source decimals both before and after transfer, accepts standard or empty successful returns, and requires the exact sender debit and escrow credit. Transfer fees, sender surcharges, rebasing deltas, failed/malformed calls and decimal drift revert atomically before any deposit nonce/event survives. Real gateway execution logs for every Ethereum token pass the existing canonical receipt/MPT verifier and actual adapter/Bridge registry policy. Their finality oracle and token deployments are explicitly controlled test dependencies, not historical live gateway deposits or a substitute consensus implementation.

Solana reuses the V.7 verifier and source gateway without changing its consensus or SBF logic. The existing source gateway already checks canonical mint, classic Token program, six decimals, exact source/vault balance deltas, actual checked transfer, PDA state and nonce. Its six passing native/SBF tests and 1,053 historical-transaction observations remain attributed to their original implementation SHAs. Only the affected RAY/EURC adapter-admission regression was requalified. The missing `solana/vendor/Sha512.sol` dependency was restored verbatim from the already pinned mel-project/ed25519-sol commit `3b36ec8c361c8fe29e6eff10019521454f888ff5`; its SHA-256 exactly matches the original retained qualification (`96a74497a31f38c57bbf989e66575ae72338bbce950cbbf9bc202cb52cd91eb8`). Apache-2.0 license is retained. This repairs checkout reproducibility rather than introducing another cryptographic implementation.

BNB's native behavior is preserved. No supported BEP-20 profile exists in the authoritative catalogue; a mapping and route alone can no longer turn an arbitrary BEP-20 into a qualified token. The corresponding legacy test now asserts rejection. No BNB consensus implementation or passing consensus suite is duplicated.

## Actual evidence and limitations

`source-observations.json` retains all seven Ethereum `decimals()` calls at historical block 26411202 and both finalized Solana mint-account responses. They match the declared contract/mint, decimals and classic SPL owner. The checker explicitly treats RPC responses as token-state observations; they are never proof inputs or runtime finality authority. Genuine authenticated Ethereum account/code proofs and finality evidence remain in the original PR #1157 qualification; Solana's authenticated epoch/stake/gateway historical end-to-end blockers remain on its existing testnet roadmap.

Original audit labels and mock-boundary test passes are not production activation evidence. Legacy adapter tests use explicitly named controlled policy/verifier doubles solely to preserve their original boundary assertions. The new route, gateway and common-router qualification uses the actual Bridge asset registry and policy; old permissive doubles never qualify a production route.

Actual logs, per-owner passing evidence, resolved fixture failures, toolchain/source checksums and bytecode sizes are retained in `token-route-qualification/RESULTS.json`. A resolved router fixture reused reconciliation evidence across assets and then attempted a stale second observation for the shared EURC destination. The fix retains unique evidence and one initial reconciliation per destination asset; assertions and production accounting guards were preserved. Only that affected test was rerun. Canonical source-decimal and SPL width changes requalified only affected token owners. Unchanged consensus, native SBF, issuer and unrelated suites were not rerun.

## Remaining original deployment prerequisites

- Real local token deployments, approved decimals and authoritative Bridge/canonical asset/route/chain entries, funded risk/accounting and approved gateway/withdrawal-custody configuration are not present in the repository. No placeholder address or controlled test token may satisfy them.
- Ethereum requires the deployed qualified verifier, authenticated bootstrap and approved gateway. Solana retains the existing authenticated validator/stake snapshot, actual authorized execution certificates and deployed gateway requirements; the current RPC observations cannot satisfy them.
- USDC and CADC retain their issuer authorization, supported 420 endpoint/domain/native deployment and live end-to-end prerequisites from V.14/V.15. Their separate unmerged PRs and evidence are preserved.
- Final production qualification must bind those exact deployments to funded genuine deposits/withdrawals and final receipts. A running testnet alone does not establish external chain or issuer authority.

These are the existing original activation requirements, not new roadmap phases or approval rules. No merge or activation is performed by this task. Current authoritative main defines no numbered bridge step after V.16; none is invented or begun.

## Reproduction

Use Foundry v1.9.0, Solidity 0.8.24, Cancun, optimizer 200, via IR, and Python 3.12. The isolated runner copies unmodified source import closures, selects explicit test owners and rejects zero-test results. Consensus evidence stays at its original SHA.

```sh
python scripts/verify-token-routes.py
python scripts/qualify-token-routes.py
python scripts/qualify-token-routes.py --match TokenGatewaySemantics420.t.sol --match-test '^testGateway'
python scripts/qualify-token-routes.py --match TokenGatewayRouterIntegration420.t.sol --match-test '^testRouter'
python scripts/qualify-token-routes.py --match SolanaFinalityProof420.t.sol --match-test '^testControlledCanonicalRayAndEurcMintRoutes' --fixture contracts/test/fixtures/solana
python scripts/verify-token-route-bytecode.py --solc /path/to/solc-0.8.24
```

The exact 17 legacy regression owners are recorded in the dedicated workflow and results. Targeted workflow ownership and a single `[skip ci]` publication preserve local passing evidence without redundant CI or new branch restrictions.
