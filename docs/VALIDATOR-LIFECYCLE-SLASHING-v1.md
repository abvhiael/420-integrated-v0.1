# 420 Validator Lifecycle and Slashing — v1

Status: **FROZEN FOR TESTNET**

This specification defines the bonded-validator lifecycle, collateral custody, and constitutional slash ceilings for the bounded-validator genesis phase. `fourtwentyd` remains authoritative for duty performance, committee membership, safety-fault proofs and slash adjudication. The EVM `ValidatorRegistry` validates finalized outcomes and is the canonical native-420 bond vault.

## 1. Fixed lifecycle timing

- Epoch: **420 blocks**.
- Rotation: **42 epochs = 17,640 blocks**.
- Active service term: **3 rotations = 52,920 blocks**.
- Activation delay: **1 full rotation = 17,640 blocks** after validator registration/bond finalization.
- Normal cooldown: **3 rotations** after an active term.
- Voluntary-exit notice: **1 full rotation**.
- Active validators never voluntarily exit in the middle of their scheduled three-rotation term. An exit notice may be submitted while active, but withdrawal hold begins only after both the notice period and the scheduled active term are complete.
- Post-duty withdrawal/slashability hold: **6 rotations = 105,840 blocks**, approximately 14.7 days at the 12-second target interval.
- A validator remains slashable throughout the withdrawal hold.

## 2. Eligibility and activation

A wallet registration alone never counts toward the eligible validator pool. Eligibility requires the complete effective bond, valid unique BLS key, completed activation delay, readiness/operational qualification, no exclusion/suspension, no effective exit, and all other consensus eligibility checks.

The bounded-validator handoff cannot occur before block 4,200 and requires at least 60 eligible validators. Committee target changes occur only at finalized rotation boundaries and require three consecutive qualifying snapshots except for the safety reduction rule.

## 3. Native 420 collateral custody

`ValidatorRegistry` is the single canonical native-420 bond vault for the bounded-validator phase. Its `ownedBond` and `protocolCredit` balances must correspond to actual native 420 held by the registry; declared or synthetic bond balances are not valid.

### Self-funded validator

A self-funded operator registers by depositing **42,000 420** directly into `ValidatorRegistry`. The full amount is participant-owned collateral.

### Qualified matched-credit validator

A qualified early validator uses:

- **21,000 420 participant-owned collateral** deposited by the operator; and
- **21,000 420 protocol-owned credit** supplied by `CommunityValidatorReserve`.

The reserve first assigns credit to a specific validator ID and beneficiary. Assigned-but-unfunded credit is encumbered and cannot be spent through generic treasury transfers. Funding moves the actual native 420 into `ValidatorRegistry`. Registration succeeds only for the designated beneficiary and only when participant-owned collateral plus funded protocol credit equals the 42,000-420 effective bond.

Funded credit that remains pending because registration never completes may be reclaimed by `CommunityValidatorReserve`. Once registration completes, protocol credit remains locked to the validator until replacement, slash, or final withdrawal.

### Collateral invariants

At all times:

`ValidatorRegistry.balance >= totalOwnedCustody + totalProtocolCreditCustody`

Pending protocol credit is included in protocol-credit custody but tracked separately until registration consumes it.

A validator cannot enter probation, eligibility, or active service unless its effective collateral is fully restored to **42,000 420**.

## 4. Protocol-credit replacement and recycling

A validator may replace protocol credit with participant-owned collateral, including while active, provided the replacement does not increase the effective bond above 42,000 420.

For each unit replaced:

1. participant-owned bond increases by that amount;
2. validator protocol credit decreases by that amount;
3. the same amount of native 420 is returned to `CommunityValidatorReserve`;
4. the reserve reduces the validator's funded and assigned credit by the returned amount.

This permits partial or complete conversion from the matched 21k/21k structure to a fully self-funded validator without changing committee weight or effective bond.

After a non-terminal slash, the validator owner may add participant-owned collateral up to the 42,000-420 effective-bond ceiling. Re-entry remains subject to consensus lifecycle/readiness rules.

## 5. Availability faults

Ordinary availability failures are not principal-slashing offenses at genesis.

- isolated missed proposal: scheduled proposer reward is not issued;
- missed participation/attestation: that validator's participation share is not issued;
- prolonged downtime may cause suspension/ejection under consensus readiness rules, but principal is not confiscated merely for being offline.

This separates accidental operational failure from cryptographically provable safety violations.

## 6. Slashable safety offenses

Slash amounts are expressed as basis points of the validator's then-current effective collateral. The registry enforces a maximum; consensus may impose a smaller penalty when the offense rule permits it.

| Offense | Base maximum | Correlation tier 1 | Correlation tier 2 | Required safety treatment |
|---|---:|---:|---:|---|
| Inactivity | 0% principal | 0% | 0% | reward non-issuance / possible suspension |
| Invalid signed consensus message | 2.5% | 5% | 7.5% | may suspend |
| Double proposal | 5% | 10% | 15% | suspend/eject as consensus requires |
| Double vote | 10% | 20% | 30% | suspend/eject |
| Surround/conflicting vote | 10% | 20% | 30% | suspend/eject |
| Conflicting finalized history / finality equivocation | 100% | 100% | 100% | immediate suspension/ejection; all remaining collateral consumed |

### Correlation tiers

- **Tier 0:** fewer than one third of the active committee implicated in the correlated event.
- **Tier 1:** at least one third but fewer than one half of the active committee implicated.
- **Tier 2:** at least one half of the active committee implicated.

The correlation tier is a finalized consensus fact. The EVM registry does not count signatures or independently decide correlation.

## 7. Owned stake and protocol-credit slash routing

For ordinary percentage slashes, participant-owned stake and protocol-owned validator credit absorb the penalty **proportionally to their current collateral composition**.

Actual value routing is:

- slashed participant-owned collateral is transferred to the canonical `ProtocolReserve` system address `0x...0424`;
- slashed/revoked protocol credit is returned to `CommunityValidatorReserve` and becomes recyclable protocol collateral.

For conflicting finalized history/finality equivocation:

1. all remaining participant-owned validator collateral is slashed to `ProtocolReserve`;
2. all remaining protocol validator credit is revoked and returned to `CommunityValidatorReserve`;
3. the validator is suspended/ejected;
4. the validator cannot become withdrawable merely because an exit was already pending.

Protocol credit never becomes liquid property of the validator.

## 8. Final withdrawal

After consensus marks the validator `WITHDRAWABLE` following the complete six-rotation slashability hold:

1. all remaining participant-owned collateral is paid only to the validator's registered withdrawal address;
2. all remaining protocol credit is returned to `CommunityValidatorReserve`;
3. the validator becomes `EXITED`;
4. protocol credit is never paid to the validator or withdrawal address.

The validator owner's active registration slot may then be released for a later registration, while BLS-key reuse remains prohibited.

## 9. Evidence and replay requirements

Every principal slash must reference a non-zero cryptographic evidence hash committed by finalized consensus state. The consensus specification must prevent the same offense evidence from being charged twice. The execution registry records the evidence hash and validates offense category, correlation tier, collateral composition and constitutional maximum.

## 10. Consensus-system authority

`ValidatorRegistry` and `RewardController` use a one-time genesis binding to a native consensus-system caller.

- Before binding, consensus-write entrypoints fail closed.
- Governance may perform the one-time binding during genesis/predeploy initialization.
- The binding cannot be changed afterward.
- After binding, ordinary governance cannot call validator-state, rotation-snapshot, slash or reward-application entrypoints.
- Governance controls qualification and assignment of protocol-owned community validator credit, but cannot use that authority to select a committee member.
- Governance remains separate from consensus and cannot appoint itself a validator, fabricate a slash, fabricate a reward, or rewrite a finalized committee outcome through these contracts.

The exact native caller address/predeploy mechanism remains a genesis deployment detail and must be frozen together with the execution/consensus system-call specification.

## 11. Genesis non-delegation rule

420Stake has no public delegator pool and no stake-weighted governance at genesis. The bounded validator bond exists to secure validator duties; it does not create transferable governance power or allow a delegated/session key to acquire validator authority.
