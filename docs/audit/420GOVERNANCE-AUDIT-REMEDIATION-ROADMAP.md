# 420Governance audit remediation roadmap

## Authority and delivery rule

This roadmap is the dependency-ordered continuation of the complete repository-grounded 420Governance audit dated 2026-10-01.

The public application remains **420 Governance**. The canonical implementation family remains **420 Civic**. `Governance420` at `0x0000000000000000000000000000000000000437` remains compatibility-only; `GovernanceTimelock` at `0x0000000000000000000000000000000000000429` remains the frozen execution authority.

Repository truth overrides prior conversation. No step may silently redefine governance policy merely to make qualification pass.

Each step must retain exact-head evidence. Ordinary steps use focused qualification for what changed. Broader repository/global qualification is reserved for milestone/phase closeout unless a shared change materially requires it earlier.

## Supplemental founding Genesis accounting — GOV-PRE-01

**Status: CANONICAL 42M CANDIDATE POLICY AND SUPPLY RECONCILIATION QUALIFIED, NOT LIVE GENESIS RELEASE.** [Retained GOV-PRE-01 qualification](GOV-PRE-01-QUALIFICATION.md) and [focused exact-head CI](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44971227517).

The existing 8.6M ProtocolReserve at 0x0424 remains the single on-ledger Genesis source for non-additive 4.2M Founding Operations and 840K Contingency earmarks, leaving 3.56M unearmarked. The founder, validator-credit, Community Reward, public distribution, Attention, Development and validator bootstrap allocations stay within exactly 42M supply. Dedicated Python/Go validators reject duplicate issuances and false Vault funding. No frozen predeploy address, V3 ceremony output, emission schedule or existing allocation was silently changed.

This qualification covers modeled source attribution only. Actual Treasury Vault funding, founder wallet proofs, signed Genesis V4 and on-chain release remain blocked by their distinct approvals and technical workstreams. GOV-AUDIT-9 and GOV-AUDIT-10 remain separate, unstarted release milestones; GOV-PRE-02 (founder wallet enrollment) is the next *founding* workstream, not a claim of audited deployment.

---

## Supplemental founding wallet and Treasury preparation — GOV-PRE-02 / GOV-PRE-03

**GOV-PRE-02 status:** founder-wallet enrollment, proof verification and claim infrastructure merged to `main` in PR #1317, but the real three independently controlled wallet identities, signed V4 and three finalized claims are deliberately **deferred to testnet**. These pending inputs do not grant Treasury authority.

**GOV-PRE-03 status: FINANCIAL-AUTHORITY CODE AND GENUINE LOCAL SETTLEMENT QUALIFIED; LIVE FUNDING / DEPLOYMENT REMAINS BLOCKED.** [Retained GOV-PRE-03 qualification](GOV-PRE-03-QUALIFICATION.md) and [founding Treasury exact-head run #44974695911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44974695911), **18/18 focused Foundry tests passed** on implementation source `6b38a248a61cc542754d0772af3dc493658f53d4`.

GOV-PRE-03 enforces the three approved native $420 authority levels, 48-hour public evidence notice, 105K routine amount/recipient, 420K exceptional payment, 210K aggregate case/incident, 840K Operations and 420K Contingency rolling caps. The noncustodial founding controller may select only one independently reviewed, Genesis-configurator-bound executable codehash. Both exact Treasury and Vault capability grants are required, and a founding Treasury record cannot be marked settled outside the exact active approved Vault release; genuinely executed local transfers update both registries and cannot replay. Additional audited checks reject unauthorized direct Civic budget scheduling or fragmenting one case across recipients. No frozen system addresses, emission schedule, Genesis tokens or reserved beneficiaries were modified.

The testnet acceptance requirements still include independently controlled founder wallets and on-chain claims, approved Genesis V4, deployed exact runtime and authorized payout executor, actually funded Operations/Contingency Vaults, capability grants, actual canonical destination transfers and independently reconciled receipts. No local Foundry test substitutes for these external release proofs. This preparatory step does **not** complete GOV-AUDIT-9 or GOV-AUDIT-10. The following separate founding task, **GOV-PRE-04**, is now implemented and locally qualified below; the real testnet release remains gated.

---


## GOV-PRE-04 — full-credit validator identity and native community-reward settlement

**Status: CODE-QUALIFIED LOCAL CONSENSUS / EXECUTION / INDEXER CANDIDATE; LIVE GENESIS AND TESTNET SETTLEMENT UNQUALIFIED.** [Retained GOV-PRE-04 qualification](GOV-PRE-04-QUALIFICATION.md) binds the source changes and focused proof runs. Previous accepted GOV-PRE-01 through GOV-PRE-03 financial, wallet and reserved-address policy remains unchanged, with real founder identities expressly deferred to testnet.

- ValidatorRegistry permits exactly 42K self-funded, 21K personal / 21K protocol matched, and separately authenticated 42K fully protocol-owned initial bonds. Matching and sponsorship draw one CommunityValidatorReserve 6.3M pool; the fixed 0x0425 reserve owns and recovers principal, including replacement and permitted slash/exit. No extra Genesis issuance or 2K/40K arbitrary mix is allowed.
- Full founding 42K sponsorship requires a real claimed founding Administrator wallet, canonical active 420Identity beneficiary/issuer-trusted VERIFIED economic-owner credential, one-time immutable reserve sponsorship binding, unique validator/beneficiary/economic-owner group and chain/contract/validator/beneficiary/purpose-bound 42K authorization. False aliases sharing an identity group and unsupported old three-argument sponsor selector fail closed.
- Geth's native node420 system-call processor independently validates the frozen reward schedule and consensus-endorsed, exact ABI/payload/identity/block before issuing *only the realized rewards* into RewardController. The same block immediately delivers a 90% operator / 10% 0x0426 CommunityRewardReserve share for full-sponsor-origin validators **until all remaining protocol credit is repaid**, plus actual ordinary validator, Attention and Development payouts. A separate manual funding or double-settlement route is forbidden. Existing forced native balance cannot inflate rewards or deny consensus.
- The consensus/Indexer reconciliation now requires canonical native reward payout logs and source/recipient/actual-balance equality, pinned Geth state getters, reward-supply conservation, exact validator accrual net-versus-gross and explicit community backing/settlement equality. The retained V3 ABI files and full Stake Audit-6 verifier bind exact candidate source blob identities; frozen historical V2 archives remain intact.
- **Scoped evidence:** [Founding validator #44979206601](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979206601) passed the 28-Test Solidity positive/adversarial lifecycle; [Go native accounting #44979206327](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979206327) passed certified issuance/consensus/accounting/Indexer API regressions; [Stake Audit-6 #44979206629](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979206629) passed retained source/ABI, Indexer descriptor/Explorer/SDK verification; and [node420 release gate #44982950603](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982950603) passed pinned upstream Geth, recovery and consensus build; **[real native Geth payout #44982950548](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982950548) passed actual state-backed 90% sponsored operator and 10% 0x0426 Community native payouts, exact supply increase, five native movement events and authenticated system-call archive, with pre-existing forced native balance remaining inert.**
- **Release blockers:** 3 real independently verified founder wallets/claims (deferred to testnet), independently attested real 420Identity sponsorship owner groups, approved signed Genesis V4, exact new validator/reward predeploy runtime/storage, actual collateral and native-reward funding/deployment, final canonical testnet reward receipts and supply/reorg/Indexer reconstruction, and independent security/governance qualification. Neither an all-green local suite nor a GitHub merge proves live payment or unlocks Genesis.

GOV-PRE-04 completes local code/qualification delivery **only**, not GOV-AUDIT-9 production-equivalent testnet qualification or GOV-AUDIT-10 final Genesis/production closeout. The subsequent founding workstream GOV-PRE-05 is recorded below; the existing next actual release stage remains **GOV-AUDIT-9**.

---


## GOV-PRE-05 — founder vesting and developer compensation remain distinct

**Status: LOCAL CONTRACT AND 42M GENESIS DISTRIBUTION CODE QUALIFIED; THREE REAL FOUNDER WALLETS, SIGNED V4 AND LIVE FUNDING/DEPLOYMENT NOT QUALIFIED.** [Retained GOV-PRE-05 qualification](GOV-PRE-05-QUALIFICATION.md), [27/27 exact-head Foundry lifecycle/revenue tests #44991438877](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991438877), [vesting suite #44991438933](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991438933), [canonical 42M supply #44991439028](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991439028) and [repaired existing Vault core/hardening/Slither #44991438871](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991438871) all **SUCCESS** at source head `191fc3952b2b619107b8c0dee80c02b44e9b1093`, with zero high-severity Slither findings. The independent founder wallet enrollment suite [#44991439005](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991439005) had not yet concluded when this evidence was captured. The Vault audit repaired formatting and excluded unrelated LayerZero fixture imports by byte-preserving dependency isolation, without weakening old security gates.

- **Genesis:** Exactly **1,000,000 $420** founder allocation within the existing **42,000,000** supply, with **500,000** at immutable FounderVestingRegistry predeploy **0x0427** (Administrator 250,000; Andrew 125,000; Janet 125,000), released in **13** irrevocable cumulative steps **14 days apart** over **182 days**. The other **500,000** must be liquid and funded **directly at Genesis** to those *same three verified wallets*, respectively 250,000/125,000/125,000. No added Genesis grant, owner substitution, early withdrawal, double claim, runtime third-party revenue deposit or 14th installment. The strict release checker now also requires authenticated on-chain block-zero account balances and independently verified founder signatures.
- **Ongoing application revenue (entirely separate):** The existing, capability-gated DevelopmentCompensationVault420 must be **deployed with an immutable beneficiary equal to the new FoundingDeveloperCompensationSplitter420**. A one-shot authorized deployment handshake binds the authentic Vault to the splitter, after which the three founder payees cannot be changed. Only exact authenticated native Vault revenue and atomic ERC-20 Vault transfer + real receipt acknowledgments accumulate eligible **50%/25%/25%** compensation. Pull claims are asset-isolated, cumulative and double-claim-resistant; arbitrary direct/forced native and token transfers, including misrouted Genesis funds, never become compensation.
- **Actually implemented:** `contracts/src/system/FounderVestingRegistry.sol`, `contracts/src/revenue/FoundingDeveloperCompensationSplitter420.sol`, `contracts/src/revenue/DevelopmentCompensationVault420.sol`, affected vesting, founder and Vault tests; fail-closed V4 deployment intent `scripts/prepare-founder-financial-deployment.py`, signed-Genesis/live block-zero funding verification, focused CI, and developer release documentation. No frozen system address, token supply, validator reward emission or independent Treasury authority changed.
- **Verified blockers (never bypassed):** all three founder wallet slots and signature records are still `NULL/UNCLAIMED`; the existing Genesis commitment is `FROZEN_V3`, not an approved V4; 0x0427 has no proven deployment or actual network funding; direct liquid Genesis balances are unverified; the DevelopmentCompensationVault and splitter lack actual canonical finalized deployment and bound-codehash receipts; actual native/ERC20 revenue forwarding and signed founder claims remain external testnet requirements. The test-only 500K vesting balance and Vault payment simulations do not count as Genesis/Testnet transactions.

**GOV-PRE-05 local implementation/qualification exit satisfied; live Genesis V4 and actual compensation settlement intentionally fail closed.** The next pre-existing canonical release stage is **GOV-AUDIT-9 — production-equivalent testnet deployment qualification**. Do not begin it here.

---

## GOV-PRE-06 — constitutional electorate bootstrap

**Status: LOCAL CONTRACT AND GENESIS-MATERIALIZATION CODE QUALIFIED; GENUINE POST-GENESIS TESTNET ELECTORATES, SIGNED V4 AND LIVE INITIAL CIVIC EXECUTION NOT YET QUALIFIED.** [Retained GOV-PRE-06 qualification](GOV-PRE-06-QUALIFICATION.md) records the exact source head `73c643d4e9390627577dd2ce81128d3783c77fe6`: [new verified-electorate and constitutional execution run #44995794964](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44995794964) **SUCCESS** (**6/6** Solidity adversarial and real-timelock lifecycle tests, **7/7** independent Genesis approval tests), [GOV-AUDIT-6 reproducible deployment #44995795000](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44995795000) **SUCCESS**, [full Governance audit #44995795088](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44995795088) **SUCCESS**, [GOV-AUDIT-7 integration #44995795070](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44995795070) **SUCCESS**, and affected 420Identity qualification **SUCCESS** (ID-AUDIT-3/4/5/8). The requalified Governance420 deployed runtime is **24,499 bytes**; the new membership enrollment runtime is **8,617 bytes**; both satisfy EIP-170's 24,576-byte limit.

- **Legitimate enrollment rather than fabricated founding voters:** `CivicInitialElectorateEnrollment420` admits only owner-controlled active 420Identity profiles with live VERIFIED credentials matching their house **and the exact Genesis-approved initial-electorate issuerId**. Validator electors must additionally be live, eligible ValidatorRegistry owners. No holder balance, asserted off-chain flag, alternate trusted issuer or arbitrary account can create a valid electorate. Enrollment is self-service with duplicate, wrong-house, wrong-chain, expired, revoked and ineligible-owner rejection; invalid records can be independently proven and pruned before the one-way close, without allowing censorship of valid voters.
- **Genesis-root/authority reconciliation:** The frozen compatibility Governance420 state has **seven** one-time Genesis-materialized approval fields. Legacy mode retains its old exact five-field plan hash and 19 Timelock operations. Alternative post-Genesis mode requires zero initial roots and totals for *both* houses and independently approved nonzero enrollment/helper and constitutional authority, bound by a distinct, actual-chain-specific plan hash committing seven Civic addresses/codehashes, approved authority, enrollment codehash and real Identity420/ValidatorRegistry codehashes. Any default, mixed, partial, fabricated or unauthorized approval fails closed; no runtime approval setter is introduced.
- **No circular eligibility dependency:** One fixed, previously approved G1 Timelock operation **19** configures only the constitutional VERIFIED Identity420 credential issuer before the first voters exist. After eligible real users enroll, **only** the approved authority can seal the verified initial Merkle trees and schedule the original checkpoint operations **17/18** with their own G1 delays. Commitment leaves, sorted-pair proofs, one-member/one-vote weights, G1–G4 majority/quorum rules and prospective snapshot semantics remain unchanged. Activation validates the actual matured Community and Validator checkpoints and rechecks member eligibility, then irreversibly hands the real Timelock scheduler to CivicGovernor420. No arbitrary root injection, alternative scheduler, repeat seal or reopened bootstrap is available.
- **Proved constitutional lifecycle:** Local execution uses the real 420Identity issuer-onboarding and credential flow, validates distinct Community and Validator Merkle ballots, denies duplicate/cross-house votes, finalizes a dual-house G3 proposal, and executes the committed action only through the proper matured Timelock. Wrong-chain replay, wrong-issuer but otherwise VERIFIED credentials, incomplete or duplicate seal and revoked validator/identity conditions fail closed. The local system can initialize its *first genuine* testnet electorate without replacing the chain or prepopulating invented Genesis memberships.
- **Release blockers remain external and unwaived:** Actual approved chain/plan hash, independently claimed real constitutional authority, authentic enrolled users and selectable validators, real approved member credentials, new signed V4 Genesis materialization, actual on-chain G1 issuer/checkpoint receipts and first live dual-house proposal/execution, plus production-equivalent security and Indexer receipts are not supplied or claimed by these local tests. The repository's all-zero default remains a **nonactivatable candidate**. Historical V3, 42M native supply, Treasury allocation, validator reward policy, constitutional G1–G4 rules and previously qualified work remain unchanged.

**GOV-PRE-06 local implementation/qualification exit satisfied; live constitutional activation and Genesis release remain fail closed.** The next existing canonical release stage remains **GOV-AUDIT-9 — production-equivalent testnet deployment qualification**. Do not begin it here.

---

## GOV-PRE-07 — retirement verification and community transfer

**Status: GOV-PRE-07 LOCAL EXECUTION, EIP-1153 REENTRANCY HARDENING, RETAINED GOVERNANCE, TREASURY AND ZERO-UNRESOLVED-HIGH SECURITY QUALIFIED; LIVE RETIREMENT AND FUNDED COMMUNITY TRANSFER NOT AUTHORIZED OR EXECUTED.** Final exact-source head `e3280e96cd11fec96d0cb002ce12d802cd03f35e`; [retained GOV-PRE-07 evidence](GOV-PRE-07-QUALIFICATION.md); [founding retirement verifier #45044291961](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45044291961) **SUCCESS (8/8)**, [native+ERC-20 founding Vault sweep #45044291761](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45044291761) **SUCCESS (7/7)**, [founding Treasury #45044291684](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45044291684) **SUCCESS (16/16 authorization and 3/3 settlement)**, [GOV-AUDIT-6 canonical artifacts + lifecycle #45044291659](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45044291659) **SUCCESS**, [full Governance audit #45044291635](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45044291635) **SUCCESS**, [GOV-AUDIT-7 cross-protocol integration #45044291661](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45044291661) **SUCCESS**.

- **All constitutional readiness conditions are enforced:** 60 continuously eligible unique validator owners individually bound to consensus-backed ValidatorRegistry records and separate independent-review commitments; 15 actual opted-in Committee members with distinct additional verified review evidence and unchanged personal nominations; stable pool, individual owner, Committee membership and both witness sets for at least 30 days. Each witness roster is approved only via the actual Civic Timelock, and retirement checks that the canonical Timelock scheduler was permanently handed to the live CivicGovernor. An asserted wallet count, stale witness, transferred Validator ownership or forged executive key is not sufficient.
- **Actual voted retirement action, not a historical pass:** `FoundingTreasuryAuthority420.retire()` executes only when **its exact target and `retire()` calldata** match the action currently being executed in a mature, genuinely voted dual-house Civic proposal, forwarded from the real GovernanceTimelock. An earlier unrelated G3, a current unrelated G3 callback, a single-house G1, an externally forged Timelock call or proposal replay cannot retire founders. The Governor's appended action commitment is effective only for its authentic QUEUED proposal, while the Timelock's Cancun EIP-1153 **transaction-local** context and lock reject unrelated mature G1 operations nested inside a G3/G4 callback; neither opens a second authority. Both historical Timelock storage slots 2 and 3 remain reserved, and the original public getter ABI is preserved. If the batch fails, retirement reverts atomically. Once retired, founding proposal/approval, payout, executor-binding and Committee-admin paths remain permanently closed; there is no reopening setter.
- **Protect real obligations before financial retirement:** The Treasury Budget Registry's **actual open unexecuted reservations**, rather than cumulative history counters, must all settle or be authentically canceled first. Legitimate cancellations release pending obligations without accidentally deadlocking retirement; historical accounting persists for audit. The Operations and Contingency Vault sweep then moves **only real free native $420 or recorded ERC-20 balances** to the separately registered Community Vault, with distinct existing exact-route authorization grants and atomic pre-/post-state checks. Reserved and claimable beneficiary amounts remain untouched. `custodyHandoffComplete()` requires no founding open reservations, both source Vaults `canClose()` with zero recorded assets and obligations, and both actual native balances equal zero. Unknown ERC-20 holdings cannot be enumerated by EVM: require independently reconciled asset inventory before live final custody signoff.
- **Verified real local execution:** In the retained Foundation/Civic tests, a genuine G3 dual-house Timelock action publishes both independently witnessed rosters; a 30-day maturity is enforced; single-house/direct retirement attempts fail; a second real dual-house, timed, committed action `retire()` succeeds and is irreversibly unreplayable. Separate real AssetVault tests exercise exact native and ERC-20 recipient custody, ledger conservation, protection of obligations, missing grants and forced native dust. The newly materialized Governor runtime is **8,714 bytes** (`0xee4db13090e785e2c08533690be5b86fe9350c8d5501db325a2607e861257ee0`); Timelock is **4,338 bytes** (`0x9f3b61e71f625ee8bc36d62ccfd261aa7d6998bd073e784c1141cb619f777ed4`). Both meet EIP-170. Genesis Cancun activates at time 0; historical storage slots remain reserved.
- **External testnet and Genesis blockers remain:** Independent on-chain custody/owner proof references, ≥60 real consensus-eligible owners, 15 actual distinct Committee members/credentials and full 30-day continuous evidence, signed approved V4 Genesis, three verified founder claims, deployed exact Guardian/Governance/Treasury addresses and codehashes, actual funded Ops/Contingency and Community Vaults with approved capabilities, live executed dual-house retirement, finalized funds movements and beneficiary claim discharges remain **unverified**. None is inferred from local fixture addresses, hashes or CI. The repository still deliberately fails live Genesis/release gates; historical frozen supply, budget earmarks and constitutional G1–G4 rules have not been altered.

**GOV-PRE-07 local implementation and required qualification exit satisfied. No live retirement, financial custody handoff or mainnet/testnet Genesis approval is claimed.** The existing next roadmap stage remains **GOV-AUDIT-9 — production-equivalent testnet deployment qualification**, not started.

- **Final exact-source passed qualifications:** [Founding retirement #45046769105](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769105), [Vault sweep #45046769083](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769083), [Founding Treasury #45046769055](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769055), [GOV-AUDIT-6 #45046769229](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769229), [Governance audit #45046769021](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769021), [GOV-AUDIT-7 #45046769156](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769156), [Treasury REC-5 #45046769018](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769018), [Treasury REC-9 #45046769202](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45046769202) **all SUCCESS** on the same approved-source candidate; REC-9 included six real security tests, 524,288 invariant calls with zero reverts and the non-suppressed Slither high-severity gate. Earlier SHA `1aa34fe05e4d8d4fdd1e45150a69edeced871e88` and older runs listed above remain historical provenance only.

---

## GOV-PRE-08 — Genesis integration: pre-testnet work and testnet handoff

**Status: PARTIALLY IMPLEMENTED; PRE-TESTNET EXIT NOT SATISFIED; NO LIVE V4 APPROVAL.** The original GOV-PRE-08 deliverables and acceptance are unchanged. [Retained implementation/qualification evidence](GOV-PRE-08-QUALIFICATION.md) plus [merged Step 1 PR #1335](https://github.com/abvhiael/420-integrated-v0.1/pull/1335) and [draft Step 2 PR #1337](https://github.com/abvhiael/420-integrated-v0.1/pull/1337) show a source-bound **unsigned** V4 candidate, real source compilation (14 modules), **26 focused tests**, synthetic 42m Genesis funding verified against local RPC, and reproducible local constructor/runtime/storage for **FounderVestingRegistry at 0x0427 only**. The subsequent Step 1 / Step 2 qualification below **does satisfy the complete *local* deployment and native funding acceptance**, but **not** signed network deployment, approved V4, cross-protocol integration or the remaining GOV-PRE-08 pre-testnet gates.

### GOV-PRE-08 Step 1 — completed local deployment graph (2026-11-22)

**Status: LOCAL CONTRACT DEPLOYMENT AND AUTHORITY BINDINGS QUALIFIED; FULL GOV-PRE-08 REMAINS OPEN.** At exact qualified executable source `32729091d09cf055f05a242259e961b216a87c19`, [focused Actions #45062812203](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45062812203) **SUCCESS**, [retained evidence](GOV-PRE-08-QUALIFICATION.md#gov-pre-08-pre-testnet-step-1--complete-local-contract-deployment-qualified): all fourteen founder/Treasury/sponsor/compensation/retirement real Solidity constructors deployed on two independently isolated Foundry EVMs; three local Vaults and their policies registered; real one-time permissions/identity/dependency handshakes verified; all fourteen components published on local real ProtocolRegistry with verified runtime codehash; canonical Treasury/Vault/DevelopmentCompensation service IDs resolved; unauthorized mutations and retirement rejected. **4/4 focused tests per run, 8/8 across both runs**, identical deployment-runtime graph digest `0xc337ffd4adc5d87f314979917db1b7c1eb5537e08c0bd0eee9dc9e1691c35dd4`. Testnet, real owner signatures and actual funded Vault balances are not implied; the component IDs generated for this isolated local test are *fixture-only*, and do not establish production component namespace authority.

**The next pre-testnet work is item 3: V4 source/materialization and local cross-protocol integration.** Steps 1–2 are locally qualified; items 3–4 remain open. The overall GOV-PRE-08 milestone and later GOV-AUDIT-9/10 gates have **not** been marked complete.

### GOV-PRE-08 Step 2 — completed local V4-shaped Genesis funding (2026-11-22)

**Status: FULL LOCAL NATIVE GENESIS FUNDING, VAULT CUSTODY AND RECONCILIATION QUALIFIED; NO SIGNED V4 OR LIVE CHAIN.** Exact executable source **`4d2dfb966e23e94a0699a26e549e46402192edab`**, [Step 2 Actions #45064496811](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45064496811) **SUCCESS**, and [GOV-PRE-08 integration #45064496862](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45064496862) **SUCCESS**. [Retained actual receipts and evidence](GOV-PRE-08-QUALIFICATION.md#gov-pre-08-pre-testnet-step-2--funded-local-v4-shaped-genesis-and-reconciliation-qualified); draft implementation [PR #1337](https://github.com/abvhiael/420-integrated-v0.1/pull/1337), unmerged. Each of two independently initialized Anvil chains (ID 31337, only the deliberately unowned local Genesis fixture) mined **18 successful transactions**, including real Timelock-context ProtocolReserve predeploy transfers of **4.2m $420 Operations** and **840k $420 Contingency** into registered active Vaults. All three Vault IDs, source/custody balances and VaultAccounting deposit events reconciled at block receipt granularity; **3.56m** remains in 0x0424 ProtocolReserve, **zero** in the initially unfunded Community Vault, and original+Vault native balances total exactly **42m**, not 47.04m. Two independent Foundry EVMs also passed **10/10 real Solidity integration/security tests per run**, including actual 100 $420 Treasury disbursement with two independent permissions, exact ERC20 deposits/withdrawals/fee rollback, protocol-funded validator credit and the **10% fully-sponsored reward share** physically paid to CommunityRewardReserve 0x0426 in a *separate, explicitly simulated* 100 $420 reward-credit scenario. Exact funded custody hash `0x360057be262941b4d726b307c33027de3d09d47f4ffefd0023d9322365926079` matched both isolated EVM runs.

**No source-level frozen V3 authority, real beneficiary wallet reservation, production component ID or cryptographic owner proof was changed.** Anvil-only predeploy code and pseudo-Timelock transaction authorization, synthetic founder grants, and simulated native reward backing are **not** release evidence. The subsequent item 3 must integrate approved/runtime-aware consumers, and item 4 must obtain genuine founder signatures and an independently authorized V4 freeze before any network activation. This step's local exit is satisfied without requiring an active testnet.

### Pre-testnet implementation scope and status (preserved acceptance criteria)

1. **COMPLETE LOCALLY — Complete the local contract/authority graph.** Deploy and initialize **all** founder claims/committee, Treasury control plane and Vault routing, validator sponsorship, 50/25/25 compensation splitter/Vault, retirement verifier and community sweep contracts on a clean local EVM. Materialize actual constructor storage, immutables, runtime bytecode, ABIs and dependency bindings; register the exact Registry-resolved identities. Preserve frozen Timelock `0x0429` / Registry `0x0434` / vesting `0x0427` and fail closed on absent, duplicate or unauthorized components. **Exit:** two independent local deployments reproduce the complete graph and state, not merely fourteen artifact templates and one materialized contract.

2. **COMPLETE LOCALLY — Build and fund the exact local V4-shaped Genesis.** Reconcile 42m total, one million split into 500k three-founder locked vesting and 500k three-founder liquid accounts, appropriate reserve balances, and the **non-additive** 4.2m Operations plus 840k Contingency within the existing 8.6m ProtocolReserve. Actually create/register local Vault IDs and execute authorized **local** transfer/permission/settlement flows, including the 10% fully-sponsored validator Community Reward routing. No mock transfer may count as funded custody. **Exit:** native and applicable ERC20 account/Vault balances, permissions and discharge/sweep constraints reconcile to real local receipts, with no duplicate issuance.

3. **IN PROGRESS — Finish V4 source/materialization and cross-protocol integration.**

**Step 3 executable pre-testnet engineering:** [PR #1338](https://github.com/abvhiael/420-integrated-v0.1/pull/1338) carries passing exact-head local V4-shaped Anvil/Wallet/Registry/Treasury/PostgreSQL/Go Explorer and a separate authenticated patched-node420/fourtwentyd native settlement/recovery suite at `48aa642e0aede9750136ac2ad23f022087851dfd` — [combined workflow #45072161557](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45072161557) **SUCCESS in both jobs**. Those fixtures are not yet the **same** canonical local execution history. **Remaining Step 3 engineering:** integrate patched node420 + certified fourtwentyd + Stake/Registry/Treasury/Governance contracts + running Wallet + durable PostgreSQL Indexer + Go Explorer on one local chain; run signed simulated-local transactions, deterministic native rewards/settlement, authorization and application flows, cross-network isolation, canonical reorg/finality, cold start and coordinated process recovery. Retain exact-head runtime/code/ABI/storage/deployment/restart manifests; never promote synthetic founder keys or test-only adapter to production. **Exit is open until this unified local network is qualified.** Genuine founder ownership proofs, independent signed V4 release authorization, production migration and actual finalized live-network claims/receipts are **not Step 3 engineering exit conditions**; all applicable live-network acceptance, roles and evidence are tracked solely in [the existing GOV-AUDIT-9 testnet work roadmap](420GOVERNANCE-TESTNET-WORK-ROADMAP.md). Actual founder addresses and independent V4 approval remain required *before* launching an immutable Genesis, and are external ceremony inputs rather than code tasks.

4. **OPEN — Close the pre-testnet authority and qualification boundary.** Collect the three authentic off-system founder wallet addresses and independent cryptographic ownership proofs; bind the actual proposed chain/Genesis identity and beneficiary addresses before obtaining authorized **V4 pre-Genesis signoff**. EOA EIP-191 wallet ownership proofs and external V4 approval are **not dependent on the testnet being active**; real EIP-1271 contract-wallet verification, if chosen, requires authenticated deployed target-chain code and must stay fail-closed until that code is available. Where genuine owner credentials or approvals are unavailable, mark a *specific external authorization blocker* rather than deferring executable local work. Rebuild/verify the exact V4 hash **after** final authority inputs, freeze the authorized release candidate, preserve exact-head build/test evidence and update this step only when all pre-testnet exits pass. **Exit:** pretestnet-ready signed, reproducible candidate, not a claim that any live network has started.

### Deferred existing testnet work — GOV-AUDIT-9

See the [420Governance testnet work roadmap](420GOVERNANCE-TESTNET-WORK-ROADMAP.md), under existing GOV-AUDIT-9 and [Step 5 Testnet Launch](../STEP-5-TESTNET-LAUNCH.md), for **real-network** Genesis code/storage attestation, finalized deployed/registered contract addresses and founder claim transactions, authorized live Operations/Contingency/Community Vault funding/receipts, Wallet/Registry/Indexer/Stake/Treasury/Explorer/Governance running-chain qualification, live canonical restart/reorg/finality, and independently authorized Civic activation/constitutional retirement when its 60/15/30-day preconditions are actually met.

**Neither running a testnet nor authentic founder signatures are prerequisites for finishing the local engineering in items 1–3.** Conversely, do not postpone the approved V4 Genesis manifest until after launching the network: the approved manifest is required to start it. The existing GOV-AUDIT-9 / GOV-AUDIT-10 release and closeout acceptance remain unaltered.

---

## Current audit repairs already staged

The complete audit branch contains two narrow repairs that do not require a new governance decision:

1. `CivicGovernor420` now fails closed unless Constitution, Proposal Registry and Electorate Registry share one GovernanceTimelock and `CivicVoting420` is bound to the exact Proposal/Electorate registries supplied to the Governor.
2. 420Indexer now classifies the five canonical Civic modules under `420Governance`, with a regression test.

These repairs are retained as foundational work for GOV-AUDIT-2 and GOV-AUDIT-4 below. They do not close the later deployment, Wallet, testnet or Genesis gates.

---

## GOV-AUDIT-1 — canonical authority, dependency and cancellation decision

**Status: COMPLETE — implementation SHA `fde6b37d02db1a180a8635aeb037efd7db0d2cc6`; retained exact-head qualification re-established at `28f32c3c090f2b7b1020dafa2ed8a4bb5ee308c7` by 420Governance audit qualification run `36914171425`; evidence: `docs/audit/GOV-AUDIT-1-QUALIFICATION.md`.**

### Purpose
Freeze one internally consistent 420 Governance authority model before further implementation.

### Required work
- Reconcile the generic `420Governance` row in `contracts/config/interfaces/dependency-matrix.json` against the actual Civic runtime dependency graph.
- Classify each shared Genesis interface as direct runtime dependency, indirect deployment dependency, consumer-layer dependency, optional integration, local mechanism, or not applicable.
- Preserve `GovernanceTimelock` as the sole execution/governance mutation authority where current architecture requires it.
- Preserve `Governance420` as compatibility-only.
- Record an ADR for proposal cancellation covering:
  - whether ACTIVE, PASSED and/or QUEUED proposals are cancellable;
  - who may request cancellation;
  - whether cancellation requires a separate Civic proposal, emergency authority, proposer right, constitutional class, or is intentionally unsupported;
  - how `GovernanceTimelock.cancel` and Proposal Registry state remain atomic/consistent;
  - required events and Indexer semantics.
- Do not invent emergency power absent an explicit canonical decision.

### Qualification
- dependency-model verifier;
- authority graph tests;
- negative tests proving no compatibility/alternate authority;
- docs/reference consistency checks.

### Exit
A machine-readable dependency model and architecture decision define one canonical authority/cancellation model with no contradictory execution path.

---

## GOV-AUDIT-2 — Civic contract hardening and lifecycle completion

**Status: COMPLETE — qualified at implementation SHA `28f32c3c090f2b7b1020dafa2ed8a4bb5ee308c7`; evidence: `docs/audit/GOV-AUDIT-2-QUALIFICATION.md`.**

### Purpose
Make the canonical Civic contract family internally complete under the GOV-AUDIT-1 authority model.

### Required work
- Retain the module-graph constructor hardening introduced by the complete audit.
- Implement the GOV-AUDIT-1 cancellation decision if cancellation is supported.
- Ensure cancellation cannot desynchronize `CivicProposalRegistry420` from `GovernanceTimelock`.
- Reject invalid/mixed module graphs, zero/foreign authorities and inconsistent constructor dependencies.
- Verify all legal and illegal proposal state transitions.
- Harden threshold, block/timestamp, value-sum and action-batch boundary behavior.
- Verify one-time authority bindings cannot be replaced.
- Review external-call and reentrancy behavior around atomic execution without adding an undocumented global lock.
- Explicitly document accepted risks of governance-authorized arbitrary target calls.

### Qualification
- focused Foundry build;
- Civic/Governance unit and integration suites;
- negative/adversarial tests;
- fuzz/property tests for quorum/approval arithmetic and lifecycle transitions;
- targeted static/security analysis;
- forbidden primitive scan.

### Exit
Every canonical Civic state transition and authority boundary is implemented and independently tested.

---

## GOV-AUDIT-3 — adversarial, invariant and failure-path qualification

**Status: COMPLETE — qualified at implementation SHA `c2546d382f9296ea72141299693be542fc5d47c2`; evidence: `docs/audit/GOV-AUDIT-3-QUALIFICATION.md`.**

### Purpose
Prove the contract core under hostile and boundary conditions rather than only ordinary paths.

### Required work
Cover at minimum:
- quorum exact-boundary, one-below and full-participation cases;
- approval exact-boundary and decisive-vote edge cases;
- abstain-only/no-decisive-vote behavior;
- dual-house independent pass/fail permutations;
- maximum/large electorate weights and arithmetic overflow resistance;
- duplicate ballot and cross-house behavior;
- source replacement after snapshot;
- malicious/reverting/malformed electorate adapters;
- voting-window boundaries;
- repeated finalization/queue/execution/cancellation attempts;
- action-batch substitution/reordering;
- total-value mismatch;
- one failed action rolling back the complete batch;
- reentrant target behavior and replay resistance;
- timelock timestamp overflow/early execution;
- unauthorized authority activation/scheduling/cancellation;
- legacy `Governance420` selector retirement.

### Qualification
Retain named tests and fuzz/property evidence tied to exact head.

### Exit
No unresolved high-severity contract-core finding remains within the defined Governance scope.

---

## GOV-AUDIT-4 — Indexer, ABI and event-model reconciliation

**Status: COMPLETE — qualified at implementation SHA `4d859e2f0f9f8371aaf2ee7259e414daf17720a2`; evidence: `docs/audit/GOV-AUDIT-4-QUALIFICATION.md`.**

### Purpose
Make canonical Civic activity reconstructable as non-authoritative `420Governance` projection state.

### Required work
- Retain the Civic contract-to-`420Governance` ABI mapping introduced by the complete audit.
- Generate descriptors from the exact qualified Civic artifacts.
- Reconcile lifecycle reducer event names with real emitted Civic events.
- If cancellation is supported, add its canonical event and projection behavior.
- Define proposal object keys and current-state reconstruction.
- Verify reorg rollback/replay and idempotent re-indexing.
- Ensure Indexer never becomes voting/outcome/execution authority.
- Reconcile public API/search/event-subscription schemas.

### Qualification
- Indexer build;
- descriptor/ABI tests;
- lifecycle reducer tests;
- reorg/replay tests;
- query/API tests;
- negative tests for unknown/stale/mismatched artifacts.

### Exit
Canonical Civic events can be deterministically decoded and rebuilt from qualified artifacts and chain history.

---

## GOV-AUDIT-5 — 420 Wallet Governance user application

**Status: COMPLETE — qualified at implementation SHA `2ea64dded4b2ea600adcc8989b6efbfc872a2ae1`; evidence: `docs/audit/GOV-AUDIT-5-QUALIFICATION.md`.**

### Purpose
Satisfy the frozen classification of 420 Governance as a **Genesis protocol and user app**.

### Required work
Implement a Wallet-integrated Governance surface with:
- proposal list and proposal detail;
- proposal class and frozen constitutional revision;
- voting window and current state;
- frozen community/validator electorate information;
- quorum/approval thresholds and live non-authoritative tallies;
- exact committed actions hash;
- decoded action-batch review where ABI metadata permits;
- explicit warning/fail-closed behavior when an action cannot be decoded or does not match the commitment;
- FOR / AGAINST / ABSTAIN vote submission;
- required-house awareness;
- connected-account eligibility/weight preflight;
- chain ID and deployed-code validation;
- canonical Governance/Civic discovery rather than hard-coded invented addresses;
- transaction simulation/gas estimation where supported;
- submitted/confirmed/failed/replaced transaction state;
- account/network-change invalidation;
- safe retry semantics;
- loading, empty and error states;
- accessibility basics and responsive behavior.

Proposal creation/queue/execution controls must be exposed only if the canonical policy says ordinary Wallet users should invoke them; presentation must not manufacture protocol authority.

### Qualification
- Wallet unit/integration tests;
- mocked hostile RPC/chain/account changes;
- ABI/address/version failures;
- transaction recovery tests;
- accessibility/static checks.

### Exit
A user can inspect and vote on canonical Governance state through 420 Wallet without trusting Wallet as governance authority.

---

## GOV-AUDIT-6 — deployment, artifacts, discovery and initialization

**Status: COMPLETE — qualified at implementation SHA `ce294990581aac97fc005ed3400be077eb8bc7a0`; evidence: `docs/audit/GOV-AUDIT-6-QUALIFICATION.md`.**

### Purpose
Turn the source-complete Civic family into a reproducible deployable Genesis candidate.

### Required work
- Pin compiler, optimizer, EVM target and exact source inputs.
- Produce reproducible compiler/runtime artifacts and runtime code hashes for:
  - GovernanceTimelock;
  - Governance420 compatibility surface;
  - CivicConstitution420;
  - CivicProposalRegistry420;
  - CivicElectorateRegistry420;
  - CivicVoting420;
  - CivicGovernor420.
- Define whether each Civic module is fixed-predeploy or Registry-resolved; do not assign a reserved address by implication.
- Define canonical Registry service/component IDs and publication profiles for Registry-resolved modules.
- Define deterministic deployment/initialization order including:
  - Timelock materialization/deployment;
  - Constitution/Proposal/Electorate/Voting/Governor wiring;
  - electorate-source configuration;
  - initial constitutional rules;
  - Proposal/Snapshot authority bindings;
  - `Governance420.bindCivicGovernor`;
  - `GovernanceTimelock.activateCivicAuthority`;
  - Registry publication/discovery.
- Prove bootstrap authority is retired at the intended point.
- Generate storage/init manifests and verify all immutable references.
- Add deployment smoke verification and rollback/recovery instructions.

### Qualification
- artifact reproducibility;
- runtime-code-hash verification;
- deterministic deployment simulation;
- exact constructor/immutable/state verification;
- Registry resolution tests;
- bootstrap-to-Civic authority handoff tests.

### Exit
The complete canonical Governance stack can be reproduced and deployed from a clean checkout with no guessed address, authority or initialization value.

---

## GOV-AUDIT-7 — cross-protocol integration qualification

**Status: COMPLETE — qualified at implementation SHA `f3a46c4ccb51a777b3ac0a6966851aa8a42b0142`; evidence: `docs/audit/GOV-AUDIT-7-QUALIFICATION.md`.**

### Purpose
Verify Governance as one bounded authority inside 420Integrated.

### Required work
Qualify applicable integration with:
- 420Registry discovery/publication;
- 420Stake separation from voting weight;
- 420Treasury/Vault governed-action commitments and custody separation;
- 420Wallet;
- 420Indexer/Search/Explorer;
- 420Notifications where governance events are surfaced;
- other Genesis residents that call GovernanceAuthority or GovernanceTimelock.

Verify:
- canonical IDs/addresses;
- interface compatibility;
- permissions;
- event schemas;
- no circular authority;
- no deprecated compatibility path used as canonical Civic state;
- derived services cannot alter governance outcomes.

### Qualification
Focused cross-component integration and negative tests, including stale/mismatched Registry and projection state.

### Exit
Every required Governance dependency and consumer has a tested, documented authority boundary.

---

## GOV-AUDIT-8 — documentation, operator, threat-model and phase closeout

**Status: COMPLETE — qualified at implementation/closeout SHA `330388bbd0c819e2ac331f060da856de5bf12e80`; final repository Level 3 phase-closeout evidence: `docs/audit/GOV-AUDIT-8-QUALIFICATION.md`.**

### Purpose
Make the repository sufficient for a new developer/operator to build, test, deploy, operate and recover Governance.

### Required work
Complete/reconcile:
- app README/index;
- architecture/component map;
- contract/API/event/state-machine documentation;
- roles and permissions;
- canonical Registry IDs and addresses;
- configuration/environment reference;
- build/test instructions;
- deployment/initialization instructions;
- upgrade/migration policy;
- operator runbook;
- troubleshooting/recovery;
- integration guide;
- user guide;
- security assumptions and threat model;
- known limitations;
- qualification/evidence ledger.

Perform Level-2/phase closeout qualification against the exact reconciled head.

### Exit
Documentation and evidence describe the implementation that actually exists at the qualified SHA.

---

## GOV-AUDIT-9 — production-equivalent testnet deployment qualification

### Purpose
Collect live evidence that repository-qualified Governance works on the approved testnet candidate.

### Required work
Retain durable evidence for:
- chain ID/network/genesis identity;
- exact deployed code and runtime hashes;
- constructor/immutable/storage bindings;
- GovernanceTimelock authority state;
- Civic module graph;
- Registry discovery;
- compatibility `Governance420` pointer;
- bootstrap retirement/Civic activation;
- initial rules and electorate sources;
- Wallet proposal/vote workflow;
- Indexer/Search reconstruction;
- proposal create/vote/finalize/queue/execute lifecycle on testnet;
- cancellation lifecycle if supported;
- restart/replay/reorg behavior for derived services.

### Exit
All production-equivalent testnet checks pass against the exact deployed release candidate. Repository-only simulation cannot satisfy this step.

---

## GOV-AUDIT-10 — Genesis candidate and production closeout

### Purpose
Make the final release-stage decision without conflating code completeness, testnet readiness, Genesis readiness and production readiness.

### Required work
- reconcile GOV-AUDIT-1 through GOV-AUDIT-9 evidence;
- run the broader final application-phase qualification once on the exact candidate SHA;
- verify no uncommitted/generated drift;
- bind all evidence to exact source/artifact/deployment SHAs;
- confirm production configuration, monitoring, incident response and recovery;
- publish explicit remaining blockers or release acceptance.

### Exit
The final closeout reports independently:
- CODE COMPLETE;
- BUILD COMPLETE;
- CONTRACT COMPLETE;
- TEST COMPLETE;
- DOCUMENTATION COMPLETE;
- INTEGRATION COMPLETE;
- SECURITY QUALIFIED;
- TESTNET READY;
- GENESIS READY;
- PRODUCTION READY.

No state is inferred from another.
