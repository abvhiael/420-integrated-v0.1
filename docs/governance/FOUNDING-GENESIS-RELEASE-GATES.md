# 420Integrated founding Genesis release integration

**Status:** PRE-GENESIS CONTRACT CANDIDATES. Mainnet/testnet genesis allocation **not approved**. This record does not replace the signed Genesis network distribution or freeze new runtime code hashes.

## Canonical chain authorities and founder control

- `contracts/config/system-addresses.json` remains a frozen *contract* address table. **No human keys use 0x041f–0x04ff**. The founder role slots there and in `genesis-canonical-addresses.json` reference `founder-wallet-reservations.json` and carry currently unpopulated public addresses.
- Founder-controlled public addresses must be staged in the two founder-role mirrors and three founder liquid Genesis destinations **before** approval of V4, since those files are Genesis authority inputs. Afterwards, approved V4 exact source blobs and three independently signed network-/chain-/role-/plan-bound EIP-191 proofs (or finalized code-bound EIP-1271 contract signatures on the independently approved chain) are mandatory. No private keys or user recovery credentials are stored. Owner proofs and on-chain claims are distinct: only actual finalized claim events/state can activate founding permissions. `FoundingWalletClaims420` must be deployed with those same addresses and that exact plan commitment. Once the chain starts, each actual founder calls `claimFounderWallet()`. Only a *claimed* founder address can then exercise founding Treasury controls or authorize a full validator sponsorship.
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

## GOV-PRE-02 fail-closed deployment binding

`scripts/enroll-founder-wallets.py` has distinct address-staging, approved-V4 challenge, three-proof attestation and finalized-claim receipt recording phases. The `prepare-founder-claims-deployment.py` intent binds the constructor to the exact verified founder addresses and V4 commitment, never publishes a fake address or signs a transaction. Actual network deployment, codehash confirmation, and canonical claim receipts remain required; `verify-founding-genesis-integration.py --require-release` obtains **actual finalized RPC** evidence through `FOUNDER_CLAIM_RPC_URL` rather than accepting only the JSON `allThreeOnChainClaimsVerified` assertion. The founder slots are currently null, and the old V3 commitment remains authoritative historical evidence only, not launch permission.

## GOV-PRE-03 bounded Treasury release (code candidate, testnet blocked)

Financial thresholds are fixed: Administrator routine 105K per payment and recipient rolling window, two distinct founders for exceptional Operations up to 420K with 48-hour public notice, two distinct founders for Contingency up to 210K **per incident** (maximum aggregated by stable incident/evidence hash) with 48-hour notice, except three-founders' unanimous immediate emergency approval. Cumulative Operations and Contingency rolling 30-day ceilings remain 840K and 420K, respectively; native Genesis funding remains only non-additive reserve earmarks.

The canonical Treasury and Vault Registries carry the actual budget, disbursement and transfer settlement records. A founding disbursement's unique purpose hash includes the payment ID and prevents canonical ID reuse even for identical payment terms. The founding release executor is **never founder-selectable**; it is one-shot bound by the deployment configurator to an independently reviewed, immutable deployed codehash. A founding Treasury settlement marker cannot be recorded except during the exact active founding payment release initiated through that executor. A live caller must have independently issued Treasury exact-disbursement and Vault exact-recipient/asset/amount capabilities; a forged markExecuted, expiry, over-limit release or replay reverts.

The current pre-Genesis policy file has `releaseExecutorAddress = null`, `liveVaultsFunded = false` and no real founder claims. Actual reviewed deployed executor codehash, constructor/operator/source identity, live receipt hashes and Treasury/Vault grant inventory require testnet qualification before this gate is released. On-chain transfers cannot be inferred from local simulated successful test receipts.

**Public notice evidence:** the founding controller emits indexed payment ID, incident/case evidence and immutable per-payment purpose hash plus proposal/eligibility/expiry times when the proposal is made, not at scheduling. This retains an independently reviewable 48-hour notice period; the unique purpose must match the eventual canonical Treasury disbursement.
