# BRIDGE-AUDIT-3.V.7 — Solana (SOL and SPL)

**Status: local implementation qualified; entire roadmap step NOT qualified. Routes remain inactive.** Base main bb4bd6374d561bcba65345a1dbc86c0c70d53272. No production gateway deployment, trusted epoch root or real validator certificate is claimed.

## Original requirements and evidence

| Requirement | Implemented and tested | Remaining qualification |
|---|---|---|
| Authenticated finality mechanism | SolanaValidatorQuorum420 checks actual Ed25519 signatures and >2/3 effective stake against immutable governance-installed epoch roots | Genuine authorized validator certificates and authenticated stake snapshot unavailable |
| Trusted validator and stake dependencies | Epoch root, snapshot hash, total stake, vote account and authorized voter membership; unknown/disabled epochs fail closed | Public RPC candidate with 699 accounts is explicitly untrusted; no production root installed |
| Finalized slots and cluster | Canonical mainnet genesis, slot/epoch binding, domain-separated claim, irreversible per-slot certified bank hash | Historical native consensus finality not authenticated |
| Transaction signatures and execution | All required signatures; canonical legacy/v0/v1 parsing; execution hash binds bank, code, LUT resolution and selected instruction | Real independently replayed committed-execution attestations unavailable |
| Gateway programs and instructions | Actual source gateway compiled to SBF v1; direct and CPI invocations, code hash/program/vault/PDA/route/destination bindings | Approved deployed program and finalized deposit evidence unavailable |
| SOL/SPL mint bindings | Lamports, canonical RAY/EURC mint addresses, classic Tokenkeg TransferChecked, six decimals, exact balance deltas and sequential nonce | Live deposits remain unqualified |
| Historical evidence | 1,053 genuine transactions independently signature-checked; all decoded and signature-checked in Solidity | They are not real gateway deposits and carry no trusted finality/committed-execution certificate |
| Reject RPC-only assertions | Default deny, certificate required, negative tests and offline tool refuse uncertified input | None locally |

## Trust boundary

This is an explicit stake-weighted validator attestation **oracle**, permitted by the existing governance-approved verifier interface. It is not a native Alpenglow/Tower light client, and its >2/3 bridge quorum must not be equated to native consensus voting rules or inherited slashing guarantees. Signers must independently validate finalized bank and committed deposit effects, then sign the exact bridge-specific digest. Ordinary votes, BLS certificate JSON, RPC `finalized`, or transaction `err:null` cannot be converted into an accepted certificate.

Governance must authenticate the snapshot independently, including eligible effective stake and authorized voters from the same epoch bank. Installing a false root grants false authority. Roots are immutable, disabled epochs cannot reactivate, and unknown epochs fail closed. Approval of a program code hash applies to the deployed executable at the claimed bank; program upgrades require an explicit new approved hash. Governance approval and external signer correctness are material trust assumptions, not properties proved by this implementation.

The certificate binds canonical mainnet genesis, destination chain, exact quorum address, epoch root/snapshot/total stake, source slot/bank, full transaction SHA-256 and execution record SHA-256. Per-vote membership, strict Ed25519 verification, duplicate vote rejection and cumulative threshold prevent unsigned substitution. A conflicting bank cannot replace an accepted slot. Epoch changes require independently authenticated new manifests; RPC stake observations cannot bootstrap one.

For v0 lookup tables, addresses are authenticated execution witnesses, not facts derivable from the signed packet alone. For CPI, the selected inner instruction, trace position and committed effects are authenticated by that same certificate. Execution.success means the selected deposit committed; successful outer transactions can contain caught/rolled-back inner failures and must not be certified for them. CPI permits PDA owners; a direct deposit owner must be a required transaction signer. Source gateway enforces signer or invoke_signed authority. The verifier does not independently execute the SVM.

Full 64-byte primary signature SHA-256 identifies the transaction. Source owner remains all 32 bytes in adapter storage. A canonical deposit message ID binds owner, asset, nonce, amount, recipient, program and destination route. Existing shared transfer replay protection remains authoritative. Permissionless signature precomputation caches only equations already checked against all bytes; it grants no finality authority. Preparing twelve signatures separately permits maximum 4,096-byte v1 proofs within measured per-call budgets.

## Source gateway and wire profile

contracts/solana/gateway is a real native program, not a mock. It escrows native SOL and the two canonical classic SPL routes already configured in the repository. Initialization creates per-asset PDA ["420-state", asset]; prefunding cannot prevent initialization. Deposits enforce canonical ATA/mint/token ownership, sufficient balance, exact post-transfer delta and sequential asset nonce. Failed or frozen-token CPI leaves funds and nonce unchanged. Direct and invoke_signed CPI deposits are covered by SVM tests executing the compiled gateway and observed Tokenkeg executable. Outbound release is outside this step's supplied inbound finality requirements; existing routes remain inactive.

Deposit instruction: 160 bytes, `420SOLV1 || amount:u64LE || asset:32 || recipient:20 || destinationChain:u256BE || destinationRouter:20 || route:32 || nonce:u64LE`. Native accounts: owner, asset-state vault, System. SPL: owner, token vault ATA, mint, source token account, Tokenkeg, asset-state PDA. No Token-2022 route is configured by the authoritative RAY/EURC profiles.

## Actual local qualification

53 unique Solidity tests passed, including 2,500 fuzz cases; six SBF execution tests passed; four Python SDK tests passed. Solidity counts: adapter 26, verifier rotation 4, RFC8032 2, crypto qualification 4, selected historical 2, remaining historical corpus 1, trust boundary 2, finality proof 12. Historical corpus comprises six selected transactions plus 1,047 other block transactions. No broad suite or unrelated chain qualification was rerun. No GitHub Actions run was launched; publication uses [skip ci].

The initial adapter regression had 23 passes and one failure: its SPL mock used a route different from the now-enforced bound route. Correcting that helper and running only the affected test plus two new tests produced three passes; passing evidence was retained. CPI schema changes invalidated only proof/SDK/gateway evidence, which was rerun. Logs in solana-qualification retain actual results. Earlier exploratory failures are not passing evidence. Rust prefunded-init duplicate transaction caching was corrected with a fresh blockhash, not an assertion change. Token execution uses actual SBF bytes rather than a stand-in processor.

Toolchains: Foundry 1.9.0 (6056…), Solidity 0.8.24 Cancun, viaIR, optimize 200. Isolated test import closure is copied unchanged. Test-only aggregate gas/code-size limits permit loops and test deployment; production size limits are independently asserted. Current runtime sizes: adapter 4,454; verifier 11,532; quorum 4,526; Ed25519 3,040; SHA-512 4,254 bytes. All init code is below 49,152 and runtime below 24,576 bytes. Individual signature/precompute calls and prepared max-v1 verification are asserted below 30M gas.

Source gateway: cargo-build-sbf 4.5.0, platform-tools v1.57 (Rust 1.95.0), arch v1; host SVM Rust 1.91.1, locked dependencies solana-program 2.3.0, solana-program-test 2.3.13 and spl-token 8.0.0. Cargo.lock is committed. SHA-512 vendored unchanged from mel-project/ed25519-sol commit 3b36ec8c361c8fe29e6eff10019521454f888ff5 under Apache-2.0; see adjacent LICENSE. Native format cross-check: anza-xyz/agave commit 4f43262c22b0dfe7a80bbc4dc426dc61fc4c5bf0 and SIMD-0385 https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md. This is not an external security audit claim.

Reproduction: scripts/qualify-solana.py selects exact test owners; scripts/verify-solana-bytecode.py checks production sizes. scripts/solana/requirements.txt pins Python dependencies. Fixture README documents offline regeneration and checksums. scripts/solana_bridge420.py accepts an already signed bundle plus independently approved root/snapshot/total/quorum and expected bundle hash, verifies the certificate and emits submitVote/verify calldata. It neither signs nor establishes trust in a manifest. Wire types are its E/C/V/P constants, matching Solidity ABI exactly.

## Unavailable historical authority and next step

The public endpoint returned a native Alpenglow genesis certificate, but no authenticated historical validator/stake mapping. getVatActiveSetRankMap returned -32601; the public certificate index reset upstream. The old archived SP1/Geyser prototype did not supply a current qualified historical proof. No real authorized validators signed this bridge domain and no deployed approved gateway was available. Those facts prevent the full historical finality and transfer exit criteria from passing. Routes must stay inactive; controlled certificates must never be represented as genuine validator evidence.

Main and the previous BTC/ETH/LTC/DOGE/BNB evidence were preserved. No merge is claimed. The next numbered step is BRIDGE-AUDIT-3.V.8; its canonical title was not found in the authoritative repository, so no title or additional work is invented and it has not begun.
