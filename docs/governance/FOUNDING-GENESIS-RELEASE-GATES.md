# 420Integrated founding Genesis release integration

**Status:** PRE-GENESIS CONTRACT CANDIDATES. Mainnet/testnet genesis allocation **not approved**. This record does not replace the signed Genesis network distribution or freeze new runtime code hashes.

## Canonical chain authorities and founder control

- `contracts/config/system-addresses.json` remains a frozen *contract* address table. **No human keys use 0x041f–0x04ff**. The founder role slots there and in `genesis-canonical-addresses.json` reference `founder-wallet-reservations.json` and carry currently unpopulated public addresses.
- Founder-created wallet public addresses, independently confirmed `personal_sign` pre-Genesis signatures, and chain-specific plan commitment are the mandatory identity-input path; no user recovery credentials or private keys are stored. `FoundingWalletClaims420` must be deployed with those same addresses and that exact plan commitment. Once the chain starts, each actual founder calls `claimFounderWallet()`. Only a *claimed* founder address can then exercise founding Treasury controls or authorize a full validator sponsorship.
- `FoundingDeveloperCompensationSplitter420` must be deployed with those same three addresses, and the first-party `DevelopmentCompensationVault420` must be deployed with the immutable `beneficiary = splitter` binding. Funds accumulate until each founder calls `claimNative()` or `claimToken(token)`. Shares are immutable 50/25/25, independent of the amended **three** FounderVestingRegistry Genesis grants.
- The Operations/Contingency candidate allocations **4,200,000/840,000** are non-additive suballocations of the original **8,600,000 $420 ProtocolReserve at 0x0424**, leaving 3,560,000 unearmarked. Neither budget is a separate minted Genesis allocation or a live funded Vault. Two actual funded Treasury Vaults and a distinct `VAULT_COMMUNITY` destination must be registered; funding, free balance, route grants, actual address provenance, proper Timelock/Civic authorization and delivery receipts must be proven.

## Community reward settlement

`RewardController` now records the actual 90/10 split for sponsored validator gross rewards. It also implements an additional, separate **backing** step `fundCommunityRewardBacking()` (native payable system-call-only) and a physically backed `settleCommunityRewards(amount)` method that transfers verified native $420 exclusively to the immutable 0x0426 CommunityRewardReserve.

**This is NOT fully operational consensus settlement.** The current frozen `ConsensusSystemCall420` protocol and Geth patch use zero-value system calls. Without a qualified consensus/native issuance backing transaction, `fundCommunityRewardBacking()` cannot be invoked with value in production. The settlement method intentionally fails closed rather than printing fake issued funds. Future consensus/economic changes must preserve gross issuance equality; replay resistance; block-finality, reorg, supply and Account/Indexer reconciliation; operator 90% + reserve 10% conservation; and predeploy exact-runtime proof.

Do not replace the authenticated system-call requirement with a founder-controlled mint, a discretionary Treasury transfer, a public deposit and a claim of protocol issuance, or a unverified internal balance counter.

## Retirement and unspent funds

- `FoundingCommitteeMembership420` accepts opt-in nominations and controls membership; ordinary community voting is independent of committee appointments, and founding seats are not unilaterally dismissible.
- `ValidatorRegistry` records continuous eligible status sourced from authenticated consensus lifecycle, plus uninterrupted pool >=60; the `FoundingRetirementVerifier420` checks >=60 independently witnessed validator owner IDs, >=15 Committee members stable for >=30 days, a genuine executed dual-house Civic action and canonical Civic Timelock handoff. Independent identities still require real witness attestation, not mere wallet count.
- `FoundingTreasuryAuthority420.retire()` removes founding financial powers irreversibly when the verifier is satisfied. The post-retirement `FoundingCommunityRetirementSweep420.sweep()` executes **real native Vault withdrawals** only from the two founding Vaults to a separately registered community Vault, subject to the exact-scoped preapproved Vault route grant and unencumbered balances. `custodyHandoffComplete()` is true only when *both source vaults* have zero remaining assets or obligations. The governor does not waive any Vault capability to speed retirement.

## Genesis deployment and strict gates

Canonical contract source, ABI, constructor args, storage layouts, post-init bindings, genesis account allocations and release-manifest signatures must be regenerated and retested against the exact code head. The locked `0x04xx` addresses remain unchanged; only authorized runtime/storage updates can be materialized there. Existing frozen Stake and GOV-REC-6 materialization is **invalidated** by changed ValidatorRegistry/RewardController/Governance contracts; old qualification cannot be relabeled.

The `contracts/config/founding-genesis-integration-v1.json` file is explicit release wiring with unknown addresses stored as null. The structural checker `python3 scripts/verify-founding-genesis-integration.py` must pass now. The `--require-release` check MUST fail with the real missing wallet signatures, unmaterialized Genesis assets, Governance post-Genesis electorate enrollment, native reward backing, and real end-to-end audit.

**Post-Genesis electorate bootstrap remains a separate contract revision.** The existing `Governance420` requires nonzero initial Community and Validator electorate roots to be committed at Genesis, so the founding Committee module does not by itself solve a zero-community initial launch. Do not claim that first-testnet Governance can be activated later without this revision, or imply a second testnet is required solely because this candidate records empty role placeholders. This is a pre-Genesis deployment gate.

No founder addresses, actual wallet claims, token mint, real mainnet/testnet receipts, or external review have been invented.

## Three-founder Genesis allocation amendment

The 10x100,000 model is superseded by 500,000/250,000/250,000 in `config/genesis-allocations.json` and `contracts/config/founder-wallet-reservations.json`. The existing `FounderVestingRegistry` at `0x0427` receives only the locked 500,000 $420; three separately verified personal wallets receive the liquid 500,000 at Genesis. These are distinct from the 50/25/25 *application revenue* compensation splitter. Frozen V3 Genesis configuration hash no longer authenticates this revised canonical working ledger. A signed new commitment and source-bound runtime/storage regeneration are hard release gates.
