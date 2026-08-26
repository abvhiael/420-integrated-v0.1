# 420 Validator Lifecycle and Slashing — v1

Status: **FROZEN FOR TESTNET**

This specification defines the bonded-validator lifecycle and constitutional slash ceilings for the bounded-validator genesis phase. `fourtwentyd` remains authoritative for duty performance, committee membership, safety-fault proofs and slash adjudication. The EVM `ValidatorRegistry` validates and mirrors finalized outcomes.

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

## 3. Availability faults

Ordinary availability failures are not principal-slashing offenses at genesis.

- isolated missed proposal: scheduled proposer reward is not issued;
- missed participation/attestation: that validator's participation share is not issued;
- prolonged downtime may cause suspension/ejection under consensus readiness rules, but principal is not confiscated merely for being offline.

This separates accidental operational failure from cryptographically provable safety violations.

## 4. Slashable safety offenses

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

## 5. Owned stake and protocol-credit ordering

For ordinary percentage slashes, participant-owned stake and protocol-owned validator credit absorb the penalty **proportionally to their current collateral composition**. This prevents either the participant or the protocol reserve from being artificially senior to the other for ordinary safety faults.

For conflicting finalized history/finality equivocation:

1. all remaining participant-owned validator collateral is slashed;
2. all remaining protocol validator credit is revoked/consumed;
3. the validator is suspended/ejected;
4. the validator cannot become withdrawable merely because an exit was already pending.

Protocol credit never becomes liquid property of the validator.

## 6. Evidence and replay requirements

Every principal slash must reference a non-zero cryptographic evidence hash committed by finalized consensus state. The consensus specification must prevent the same offense evidence from being charged twice. The execution registry records the evidence hash and validates offense category, correlation tier, collateral composition and constitutional maximum.

## 7. Consensus-system authority

`ValidatorRegistry` and `RewardController` use a one-time genesis binding to a native consensus-system caller.

- Before binding, consensus-write entrypoints fail closed.
- Governance may perform the one-time binding during genesis/predeploy initialization.
- The binding cannot be changed afterward.
- After binding, ordinary governance cannot call validator-state, rotation-snapshot, slash, bond-composition or reward-application entrypoints.
- Governance remains separate from consensus and cannot appoint itself a validator, fabricate a slash, fabricate a reward, or rewrite a finalized committee outcome through these contracts.

The exact native caller address/predeploy mechanism remains a genesis deployment detail and must be frozen together with the execution/consensus system-call specification.

## 8. Genesis non-delegation rule

420Stake has no public delegator pool and no stake-weighted governance at genesis. The bounded validator bond exists to secure validator duties; it does not create transferable governance power or allow a delegated/session key to acquire validator authority.
