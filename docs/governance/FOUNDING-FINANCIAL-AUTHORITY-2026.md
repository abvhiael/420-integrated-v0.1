# Founding financial authority and sponsored-validator policy — approved direction, pre-Genesis implementation

Status: **PROVISIONAL FINANCIAL ALLOCATION; SOURCE CHANGES NOT YET QUALIFIED OR DEPLOYED.**

The 42,000,000 $420 modeled supply is unchanged. Actual mainnet addresses, verified founder ownership, the complete Genesis split, development vesting, consensus reward routing, independent retirement membership proofs and live Vault capability grants still require approval and release qualification.

## Financial allocation / immutable founding rights
- Founding Operations: 4,200,000 $420 (10% of modeled supply); native $420 only.
- Single-founder routine ceiling: 105,000 $420 per payment **and** per-recipient conservative rolling-30-day aggregate, except coapproved transactions.
- Any two **distinct** founding wallets may approve exceptional payments over 105,000 up to 420,000 $420; 48-hour public notice. Founder-related payouts require two distinct approvals irrespective of amount.
- Operations aggregate limit: 840,000 $420 over a conservative daily-bucket window of at least 30 days. Lifetime Operations authorization never exceeds 4,200,000.
- Independent Contingency: 840,000 $420 (2% of modeled supply); each incident <=210,000 and conservative rolling-30-day aggregate <=420,000. Emergency use only for infrastructure, application rescue or security; two distinct founder approvals and 48-hour notice, except unanimous three-founder fast-track.
- Every founding disbursement has an on-chain recipient, amount, recorded evidence/purpose hash, immutable budget identity, unique ID, validity window and exact two independent Vault/Treasury executor grants. Split transactions to evade approval levels are prohibited.
- Founding Treasurer authority belongs to the three immutable, distinct addresses supplied at deployment. **No addresses have yet been supplied or enrolled.** There is no generic Treasury withdrawal function or unilateral grant-issuance authority.
- The authorization contract's one-way retirement requires both verified constitutional readiness and Civic authority activation. The independent verifier must prove >=60 **eligible** validators (not 60 simultaneously active committee members), >=15 verified Committee seats, stability for 30 consecutive days, independent ownership evidence and functioning community governance. Its implementation remains pending.
- After retirement, uncommitted/unspent Operations and Contingency assets must transfer to the community-controlled reserve through governed, auditable Vault movements; an event alone is **not** a transfer. Deployment must arrange all outstanding commitments and capability revocations before declaring custody handoff complete.

## Sponsored validators
- Permit FULL 42,000 $420 of protocol-owned validator credit on founder-approved, purpose-limited enrollment, on top of the existing 21,000/21,000 matched model. Standard validator eligibility, BLS uniqueness, activation delay, slashing and withdrawal hold remain unchanged.
- All actual sponsored principal stays in ValidatorRegistry custody until slashed, replaced dollar-for-dollar by participant-owned collateral or released from a completed exit. Returned principal must reach **CommunityValidatorReserve**, never Founding Operations.
- Fully sponsored validator rewards: 10% of each actual earned reward accrual to the Community fund, 90% to the operator. This must be enforced in the authoritative consensus reward accounting, not merely displayed in Wallet or debited after payment. Sponsor and founder must not select active consensus committee members or fabricate rewards.
- Issuing a full sponsorship must be separately constrained by verified beneficiary and validator ID, remaining reserve balance, sponsorship limits, purpose and independent anti-concentration checks. General Treasury approval does not grant that power by default.

## Founders and compensation
- Three wallets, immutable beneficiary shares: Founding Administrator 50%, Andrew 25%, Janet 25%. Addresses are required before deployment; vesting and lost-key recovery policy remain to be set.
- The three founders also share the **separate 1,000,000 $420 Genesis founder allocation** 50/25/25, with 500,000 liquid and 500,000 vested in 13 fortnightly releases. The independent 50/25/25 developer compensation revenue stream is not a second founder Genesis mint or a routine Treasury entitlement.
- Committee is representative/proposal-drafting, not a veto on general community votes. Only safety/slashing/consensus/validator-wide stake rules invoke the Validator voting house; routine budgets and community membership remain Community controlled.

## Deployment and current implementation boundaries
- `FoundingTreasuryAuthority420` proposes and schedules bounded founding payments against the existing TreasuryBudgetRegistry420 and TreasuryDisbursementRegistry420. Three one-time deployment-configurator bindings are required; the deployment must validate and freeze these. These changes require review of deployment scripts and retained compiler/ABI/registry pins.
- Treasury's normal Civic-only authority remains. The founding controller never receives a direct AssetVault420 withdrawal right. `TreasuryReleaseExecutor420` still checks exact Treasury and Vault capability grants, live active Registry identities, pre/post Vault accounting and actual exact transfer.
- The new native $420 policy installation is a restricted one-shot starting policy, not an arbitrary grant to change asset admission. The founding 30-day limits are conservative day-bucket checks; releases also remain subject to Treasury's independent native policy and expiry checks.
- The signed Genesis plan must explicitly identify both budget Vaults and actual funding and approve one-shot deployment registration. No release is qualified until comprehensive positive/negative tests, on-chain source hashes, runtime bindings, live transaction receipts and independent consent pass.
- The existing frozen GOV-REC-6 Governance bootstrapping model requires nonzero initial electorates. It **cannot** yet support the desired zero-membership, post-Genesis founder-populated startup. A separate Governance bootstrap constitutional revision is required; this draft does not claim it already exists.

## Separation from final Genesis economics
The approved-size founding budgets total 5,040,000 $420 (12% of the modeled Genesis supply) as explicit **non-additive earmarks within the existing 8,600,000 $420 ProtocolReserve at 0x0424**: 4.2M Operations, 840K Contingency and 3.56M unearmarked reserve. The full 42M Genesis ledger still counts ProtocolReserve exactly once. Validator-credit (6.3M), Community Reward (2.1M), founder (1M), public distribution (12.6M), validator bootstrap (3M), Attention (4.2M) and Development (4.2M) remain untouched. Earmarking does not fund founding Vaults or grant spending access. Actual Vault grants, approved V4 source, settlement and identities remain release blocked.

## Candidate implementation continuation
- Founding Treasury release now enforces **two layers** of rolling 30-day caps: reservation at `schedulePayment` and actual value movement at `executeApprovedRelease`. A release requires the real Disbursement registry to be marked EXECUTED with a matching Vault commitment before retaining the accounting changes.
- `CommunityValidatorReserve` and `ValidatorRegistry` candidates allow a 42,000 $420 protocol-owned effective bond with zero personally owned collateral. The dedicated `FoundingValidatorSponsorship420` entry point issues only full credit to a unique prospective beneficiary and funds it through the canonical CommunityValidatorReserve. The native Reserve's additional sponsorship authority comes solely from a **Genesis-populated storage slot**; the default zero is fail-closed.
- `RewardController` now has a candidate **10% community reward accrual** for fully credit-funded owners using the canonical 0x0423 owner registry, with 0x0426 as the declared CommunityRewardReserve beneficiary. The emission and accrual ledger are NOT, by themselves, a native-coin transfer to the reserve. Consensus account reconciliation and actual payment/claim settlement must be updated and qualified before this can be called an operational 10% fee.
- These Stake changes alter a previously frozen collateral model and canonical predeploy runtime/storage hashes. **No automatic compatibility assertion is made.** Full Genesis regeneration, simulator qualification and pre-testnet audits are required before any deploy.
- The 50/25/25 development compensation beneficiary splitter remains a required implementation item; no founder wallet addresses have been provided, and no existing compensation stream has been redirected.

- The 10% fully sponsored **origin** reward share continues while any of the original protocol-owned bond credit remains outstanding; partial self-funding does not bypass the community share. Once all sponsored credit is replaced and returned to CommunityValidatorReserve, the surcharge ends prospectively. The fully sponsored origin is recorded at registration, never selected by founder after rewards accrue.
