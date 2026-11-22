# 420Governance GOV-PRE-02 — Founder wallet enrollment and three on-chain claims

The canonical founder seats are **Founding Administrator (50%), Andrew (25%), Janet (25%)**. These are three independently controlled, self-custodied public EVM wallets, *not* keys created or held by the protocol. Their addresses must never be assigned to reserved predeploys `0x041f–0x04ff` or the native system origin. **Do not send private keys, mnemonic phrases or wallet passwords to anyone or commit them.**

## Verified execution state

As of this GOV-PRE-02 code candidate, `contracts/config/founder-wallet-reservations.json` has **three null, unclaimed founder slots**; both address-mirror tables have null role slots; `contracts/config/genesis-config-commitment.json` remains **FROZEN_V3**, already stale relative to the three-founder amendment. No testnet has the three authentic founder claims, no live contract address or recorded claim receipt is asserted. **No founder currently gains Treasury authority from an address-placeholder file.** GOV-PRE-02's *live* exit criteria remain externally blocked pending actual participant input and approved Genesis V4.

## Exact two-stage, no-circular-hash enrollment

The frozen Genesis V4 authority includes the Git blob hashes of `contracts/config/system-addresses.json` and `config/genesis-allocations.json`. Therefore the live founder addresses MUST be staged into those two files **before** the V4 plan is committed; otherwise adding founder addresses after founder signatures changes the plan hash and invalidates those signatures.

**Phase A — stage three founder-controlled addresses, no ownership claim**

1. Each founder independently creates or chooses their own EOA / 420Wallet Smart Account; confirm the public receiving address independently against the actual wallet. The administrator cannot invent Andrew's or Janet's keys.
2. In a trusted operator directory outside the repository, create an input file containing **only public identifiers**, like this template (do not paste fictitious addresses into canonical files):

```json
{
  "target_network": "testnet",
  "chain_id": 420,
  "founders": [
    {"role": "FOUNDING_ADMINISTRATOR", "wallet_address": "0x<real-40-hex-address>"},
    {"role": "ANDREW", "wallet_address": "0x<real-40-hex-address>"},
    {"role": "JANET", "wallet_address": "0x<real-40-hex-address>"}
  ]
}
```

For a **Smart Account**, add `"method": "EIP1271_CODEBOUND"` and `"expected_runtime_code_hash": "0x<independently-verified-32-byte-codehash>"` to that founder's entry. Undeployed counterfactual Smart Accounts are **not** EOA accounts and cannot be marked cryptographically verified by an EOA recovery shortcut. A deployed-account RPC proof on the eventual target chain requires the separately approved block-zero hash.

3. Execute `python3 scripts/enroll-founder-wallets.py --stage /trusted/path/three-public-wallets.json`. Use `--dry-run` to inspect first. This updates the canonical founder reservation, its three-role mirrors in both address-authority tables, and the three *liquid* founder destinations in the 42M Genesis allocation ledger. It does not change the frozen `assignments` predeploy table, create a wallet, assert a verified signature, or grant Treasury authority.
4. Run the existing governance/Genesis allocation checks and **only then** obtain the separately approved, source-bound **FROZEN_V4** Genesis commitment. Never silently overwrite or pretend the historical V3 commitment authorized the new allocation.

**Phase B — bind each founder's cryptographic control to that exact V4**

1. After V4 approval, execute `python3 scripts/enroll-founder-wallets.py --challenges`. This verifies the actual frozen authority-input Git blobs and prints the distinct, exact UTF-8 messages for Administrator, Andrew and Janet. It does not mutate any signed input.
2. Each founder independently signs their own role/address/network/chain/Genesis challenge using `personal_sign` / EIP-191, keeping control of their keys. A contract account must provide its contract signature and verifiable runtime code hash instead; **EIP-1271 is checked by `eth_getCode` + `isValidSignature(bytes32,bytes)` at a finalized block on an RPC matching the independently approved genesis block**.
3. Supply an *attestation input* with `target_network`, `chain_id`, `genesis_plan_commitment`, and three `founders` entries. Each has `role`, `wallet_address`, `method`, `signature`, plus `expected_runtime_code_hash` for EIP-1271 accounts. Use `network_genesis_block_hash` for EIP-1271 and ensure it agrees with the independently approved value in `contracts/config/founding-genesis-integration-v1.json`.
4. Execute `python3 scripts/enroll-founder-wallets.py --attest /trusted/path/founder-signatures.json`. Add `--rpc-url https://<approved-network-rpc>` only if needed to verify contract accounts. The script cryptographically verifies all three proofs and actual source bytes **before** writing the public-proof records, derivative beneficiary storage, founding-policy addresses and Genesis integration binding. Invalid/missing/replayed/wrong-chain/wrong-plan proofs are rejected. Existing verified identity cannot be silently replaced.
5. Independently review each human founder's wallet control using a trusted verification channel; **three distinct cryptographic accounts alone do not prove three independent human owners**. Public wallet identities remain immutable once enrolled; do not introduce an administrator-controlled beneficiary-change path.

## Deploy and verify the actual three-founder claim contract

After all three real proofs pass, run:

```bash
python3 scripts/verify-founder-wallet-reservations.py --require-deployment
python3 scripts/prepare-founder-claims-deployment.py --output /trusted/path/claim-deployment-intent.json
```

The output binds `FoundingWalletClaims420` constructor args to **exactly the three verified wallet addresses and the approved plan hash**, checks the code's Git source blob, and explicitly says **NOT_BROADCAST**. It grants no spending authority.

The deployment operator, using their **own external signing wallet** on the intended network, must broadcast the actual `FoundingWalletClaims420(administrator, andrew, janet, genesisPlanCommitment)` creation transaction (for example using reviewed Foundry `forge create` tooling). Verify the resulting contract's actual runtime and immutable plan/addresses/chain ID against the intended source, and record its actual code hash and receipt. Do **not** allocate it a frozen `0x04xx` system predeploy address. It remains a Registry-resolved implementation; an independently authorized Registry publication may be required by the wider Genesis integration release.

**After the network launches, each founder must claim from their own account:**

- Each EOA executes `claimFounderWallet()` on the verified claims contract from that address.
- A Smart Account sends the call *from its own deployed contract* using its normal owner-authorized execution mechanism; a signature from its external owner is not itself an on-chain claim.
- Exactly one `FounderWalletClaimed(role, wallet, genesisPlanCommitment)` is emitted on successful claim. A different signer, a second claim or a foreign chain ID is rejected.
- An unavailable/lost founder key leaves that founder's role **unclaimed**. Neither the protocol nor another founder can reset or seize it; succession is a separate constitutional decision.

To attach actual claims to the record, the deployment operator supplies a claim receipt manifest containing network, chain ID, approved plan hash, **independently approved** target-network block-zero hash, actual claim contract address/runtime codehash, and all three role/address/transaction hash/block hash tuples. First record the independently approved `genesis.networkGenesisBlockHash` in the Genesis integration manifest. Then:

```bash
python3 scripts/enroll-founder-wallets.py --record-claims /trusted/path/three-claim-receipts.json --rpc-url https://<approved-network-rpc>
python3 scripts/verify-founder-wallet-reservations.py --require-claims --rpc-url https://<approved-network-rpc>
```

The verifier checks chain ID + block-zero identity, finalized runtime codehash, immutable roles, plan hash, chain ID, per-founder `claimed(address)` and total, finalized canonical receipt block hashes, and one exact role/address/plan `FounderWalletClaimed` event per founder. An assertion or a copied transaction hash alone is **not** evidence. `FoundingTreasuryAuthority420` and `FoundingValidatorSponsorship420` independently require the actual recorded on-chain claim from the relevant wallet before allowing founder-only operations; they have no general override.

## Genesis and security boundaries

- Founder Genesis grants remain **500,000/250,000/250,000** totaling **1M $420** (500K immediately liquid across three wallets, 500K vested at `0x0427` through 13 fortnightly releases). The separate 50/25/25 Development Compensation Splitter does not constitute another Genesis allocation.
- Neither source mirroring nor pre-Genesis cryptographic proof grants Treasury capabilities or transfers tokens. Live policy/Vault permissions require independently qualified deployment and real funding.
- Do not change `contracts/config/system-addresses.json`, Genesis liquid allocations or other signed V4 authority inputs after the V4 commitment is approved. Proofs/receipt records are excluded from the freeze authority to avoid the circular-hash trap.
- Only authentic testnet and mainnet proof records can satisfy strict checks; synthetic accounts in automated tests are never put into canonical source files.
- The live Genesis integration release validator requires finalized actual claim evidence, alongside all the independent spending, retirement, reward and governance release conditions.

## Automated qualification

- `python3 scripts/test-founder-wallet-enrollment.py` runs ephemeral in-memory EOA signing, approved V4 fixture, staged mirror/plan conservation, contract-signature RPC simulation, finalized claim/reorg negative tests and fail-closed real placeholders.
- `forge test` on `FounderWalletClaimsAndCompensation420.t.sol`, `FoundingTreasuryAuthority420.t.sol`, and `StakeValidatorGenesis420.t.sol` covers three distinct claims, wrong signer, wrong chain, duplicate, Smart Account forwarding, lost-key non-capture, and Treasury/sponsor denial before an actual claim.
- The targeted [founding wallet qualification workflow](https://github.com/abvhiael/420-integrated-v0.1/blob/main/.github/workflows/founding-wallet-qualification.yml) records exact-head source and test results; a successful fixture test is **not** genuine founder enrollment or network deployment.
