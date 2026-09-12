---
title: Stake, Governance, Treasury and Grants
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Stake, Governance, Treasury and Grants

DOC-7.4 documents the protocols that connect validator economics, public governance, governed treasury budgets, and grant programs without collapsing those domains into one authority.

The architecture deliberately separates **consensus eligibility/economics**, **public decision-making**, **budget/disbursement control**, **asset custody**, and **grant workflow state**. A validator bond does not automatically become governance weight. A passed Civic proposal does not directly move Treasury assets. Treasury does not create a second custody system beside 420Vault. Grants can authorize program and milestone state, but they cannot bypass Treasury caps, disbursement timing, capability checks, or Vault release evidence.

## Authority map

| Protocol | Canonical authority | Explicit non-authority |
| --- | --- | --- |
| 420 Stake / `Stake420` | read-oriented access to canonical validator lifecycle, bond composition, committee targets and accrued rewards | public delegation, stake-weighted governance, independent validator admission, reward minting |
| Validator economics | `ValidatorRegistry`, `CommunityValidatorReserve`, `RewardController` | dApp-controlled committee selection, arbitrary issuance, converting protocol credit into user-owned voting or withdrawal value |
| 420 Civic | proposal rules, electorate snapshots, ballots/tallies, result finalization, timelocked committed action batches | validator consensus, wallet signing, direct Treasury/Vault custody |
| 420 Treasury | governed budgets, reserved/executed budget accounting, disbursement identity/state, policy and capability gates | independent asset custody or arbitrary transfer authority |
| 420Vault treasury vault | canonical custody/release boundary for governed Treasury assets | budget creation, Civic voting, grant selection |
| 420 Grants | program/application/award/milestone lifecycle and binding of approved milestones to Treasury disbursements | Treasury custody, bypassing Civic authorization, direct asset transfer, clawback of already-paid funds without a new authorized Treasury/Civic action |

## 420 Stake

`Stake420` is a read-oriented genesis facade over the canonical validator-economic system. It exposes validator state without creating a separate staking economy.

Genesis constants exposed by the facade include:

- effective validator bond: **42,000 `$420`**;
- maximum protocol credit: **21,000 `$420`**;
- minimum participant-owned bond: **21,000 `$420`**;
- activation delay: **17,640 blocks**;
- voluntary-exit notice: **1 rotation**;
- normal cooldown: **3 rotations**;
- withdrawal delay: **105,840 blocks**.

The facade explicitly reports that public delegation is disabled and stake-weighted voting is disabled at genesis.

### Canonical economic authority

Validator authority remains in the underlying system contracts:

- `ValidatorRegistry` owns canonical validator lifecycle and collateral accounting;
- `CommunityValidatorReserve` supplies and recovers protocol-owned matched credit;
- `RewardController` records consensus-issued rewards delivered through the native consensus system-call path.

`Stake420` does not admit validators, modify collateral, choose committees, slash balances, or mint rewards.

`RewardController` also does not calculate issuance policy locally. Reward arithmetic is computed by `fourtwentyd`, and only the bound native consensus-system path may apply proposer, participant, Attention, and Development issuance accounting.

### No stake-weighted governance

Validator collateral and Civic governance remain separate domains. Holding a larger validator bond does not multiply proposer weight and does not create stake-weighted public voting authority through `Stake420`.

If the validator house participates in a Civic proposal, its voting weight comes from the proposal's frozen Civic electorate source, not from an ad hoc reading of current wallet balance or `Stake420` stake.

## 420 Civic governance

420 Civic separates constitutional policy, electorate sourcing, ballots, proposal lifecycle, and execution.

The principal contracts are:

- `CivicConstitution420`;
- `CivicProposalRegistry420`;
- `CivicElectorateRegistry420`;
- `CivicVoting420`;
- `CivicGovernor420`;
- `GovernanceTimelock`.

### Proposal-class rules

`CivicConstitution420` stores explicit rule sets per proposal class. A rule contains:

- voting-period blocks;
- timelock delay;
- community quorum and approval thresholds;
- validator quorum and approval thresholds;
- whether a dual-house result is required;
- revision number.

Approval thresholds must remain strict majorities where required, quorum cannot be zero for the community house, and dual-house proposals require valid validator quorum/approval thresholds.

The minimum timelock floors are:

| Proposal class | Minimum delay |
| --- | ---: |
| G1 | 7 days |
| G2 | 14 days |
| G3 | 14 days |
| other / highest class | 42 days |

A governance update may raise or revise rules, but it cannot configure a delay below the class floor.

### Frozen proposal rules

When `CivicGovernor420` creates a proposal, it freezes the relevant constitutional rule revision into that proposal. A later constitutional update therefore applies prospectively and does not rewrite the quorum, approval, dual-house, or delay semantics of an already-created proposal.

The proposal also commits to an `actionsHash`. A batch queued for execution must hash to that exact commitment.

### Electorate snapshots

`CivicElectorateRegistry420` stores governed electorate sources for the community and validator houses. Source replacements are prospective.

Each proposal freezes:

- snapshot block;
- source contract;
- source type;
- source revision;
- electorate root;
- total voting weight;
- whether the house is required.

Voting weight is then resolved against that immutable proposal snapshot. Current balances, validator status changes, later source revisions, or UI/indexer state cannot retroactively alter the proposal electorate.

### Voting

`CivicVoting420` permits one immutable ballot per voter per required house for an active proposal during the configured voting window. A ballot carries `FOR`, `AGAINST`, or `ABSTAIN` plus the snapshot-derived weight.

Duplicate ballots are rejected. Zero-weight voters are rejected. The validator house cannot vote when the proposal does not require that house.

Quorum is calculated from total participation, including abstentions. Approval is calculated from decisive `FOR + AGAINST` votes. For dual-house proposals, both required houses must pass.

### Queue and execution

A passed proposal is not immediately executable.

`CivicGovernor420` must:

1. verify the exact committed action batch;
2. queue the proposal through the active `GovernanceTimelock` authority;
3. apply the frozen proposal-class delay;
4. execute the same committed action batch atomically after the timelock permits it.

The Governor cannot replace the committed targets, values, or calldata at execution time. If any action in the batch fails, the atomic batch fails.

## 420 Treasury

420 Treasury is a **budget and disbursement control plane**, not an independent asset vault. Canonical treasury assets remain in the designated 420Vault treasury custody domain.

The Treasury suite contains:

- `TreasuryAuthorization420`;
- `TreasuryPolicyRegistry420`;
- `TreasuryBudgetRegistry420`;
- `TreasuryDisbursementRegistry420`;
- `TreasuryRouter420`.

### Budgets

A Treasury budget binds:

- a treasury `vaultId`;
- category;
- asset;
- spending ceiling;
- committed amount;
- executed amount;
- validity window;
- Civic action hash;
- metadata commitment.

Budget creation is governance-controlled and requires a nonzero Civic action commitment and bounded validity window. The configured asset must also be permitted by Treasury policy.

A budget cannot reserve more than its ceiling. Reservations increase `committed`; successful execution increases `executed`; cancellation can release only the still-unexecuted commitment.

### Disbursement identity

Treasury disbursements use the domain-separated canonical identity:

`420/TREASURY/DISBURSEMENT/V1`

The identifier commits to budget, recipient, amount, timing window, Civic action hash, and purpose hash.

Scheduling requires:

- an effective parent budget;
- exact match to the budget's Civic action hash;
- permitted asset/amount under Treasury policy;
- valid `notBefore` and expiry window;
- previously unused canonical disbursement identity.

Scheduling reserves the amount against the parent budget.

### Execution authorization and policy caps

Execution is default-deny. The executor must hold the capability required for the **exact disbursement ID and amount**.

A scheduled disbursement cannot execute before `notBefore` or after expiry. Asset policy also enforces per-disbursement and per-epoch limits.

The Treasury registry marks a disbursement executed only after it receives a nonzero `vaultReleaseHash`. That commitment is the audit link to the actual Vault release path; the Treasury registry itself does not become custody.

Cancellation of a still-scheduled disbursement releases the unexecuted budget commitment and moves the disbursement to a terminal cancelled state.

## 420 Grants

420 Grants builds a governed grant lifecycle on top of Civic, Treasury, Vault, and scoped capabilities. It does not introduce a grant-specific treasury wallet.

The grant suite contains:

- `GrantAuthorization420`;
- `GrantProgramRegistry420`;
- `GrantApplicationRegistry420`;
- `GrantAwardRegistry420`;
- `GrantMilestoneRegistry420`;
- `GrantRouter420`.

### Programs

A grant program binds to exactly one Treasury budget and one Civic action commitment. It also freezes:

- program type;
- total program cap;
- maximum individual award;
- application window;
- metadata commitment.

Program award accounting cannot exceed either the per-award cap or aggregate program cap.

### Applications and awards

Applications use canonical domain-separated identities and are immutable after submission. Submission must come from the applicant or an explicitly scoped capability path.

An award can target only the applicant recorded by the accepted application. Aggregate awards remain bounded by the program cap.

### Milestones

Milestones use the domain-separated identity:

`420/GRANTS/MILESTONE/V1`

The milestone set for an award cannot have aggregate face value above the award amount.

A milestone claim can be submitted by the award recipient or by a narrowly authorized capability holder. Claim submission does not itself authorize payment.

Governance may approve a claimed milestone only by binding it to an existing **SCHEDULED** Treasury disbursement whose:

- budget matches the grant program's Treasury budget;
- recipient matches the award recipient;
- amount matches the milestone amount;
- Civic action hash matches the program commitment;
- purpose hash matches the milestone purpose.

The milestone becomes `PAID` only after the bound Treasury disbursement is `EXECUTED` and contains a nonzero Vault release commitment.

This means Grants records grant entitlement/workflow state, Treasury enforces governed spending policy, and Vault remains the custody/release authority.

### Cancellation and recovery

Cancelling an unpaid grant object stops that grant path but does not claw back funds that were already paid.

Recovery of previously released assets requires a separate, newly authorized Treasury/Civic action. Grant cancellation cannot manufacture unilateral asset-recovery authority.

## End-to-end governed-funds flow

A representative governed grant payment follows this authority chain:

1. Civic proposal commits the governed action set.
2. Required electorates are snapshotted and vote under frozen rules.
3. A passed proposal waits through its frozen timelock and executes the committed action batch.
4. Treasury creates/uses a budget bound to the Civic action commitment.
5. A grant program binds to that budget and Civic commitment.
6. An application is submitted and an award is approved within program caps.
7. A milestone is created and claimed.
8. Treasury schedules a canonical disbursement matching budget, recipient, amount, Civic action and purpose.
9. Grants binds the milestone to that scheduled disbursement.
10. A capability-qualified Treasury executor triggers the approved Vault release path.
11. Treasury records execution with a nonzero Vault release commitment.
12. Grants can then finalize the milestone as paid.

No earlier stage is allowed to skip the validation owned by a later stage.

## Failure and recovery behavior

### Validator/stake UI disagrees with consensus state

Treat `ValidatorRegistry`/consensus-derived lifecycle state as authoritative. `Stake420`, Indexer, Explorer, and Wallet are read/presentation layers and must be rebuilt or refreshed rather than rewriting validator state.

### Governance rules change during a vote

The existing proposal continues under its frozen constitutional revision and frozen electorate snapshot. New rules apply prospectively.

### Electorate source changes

Existing proposal snapshots retain the old source and revision. The replacement affects later snapshots only.

### Proposal action batch does not match the commitment

Queue or execution fails closed. Operators must not substitute a different batch merely because the proposal outcome passed.

### Treasury budget or policy no longer permits payment

The disbursement must not execute. Grants cannot override Treasury policy, caps, timing, capability checks, or budget state.

### Grant milestone is approved but Treasury payment never executes

The milestone remains unpaid. A Grants status update cannot fabricate a Vault release.

### Derived services disagree

Recover from canonical chain state outward: Civic → Treasury/Vault → Grants → Indexer/Explorer/Wallet/UI. Derived services never get to declare a vote, budget, disbursement, or milestone paid when canonical state says otherwise.

## DOC-7.4 invariants

- **GOVF-001** — `Stake420` is a read-oriented facade and cannot replace canonical validator lifecycle, collateral, committee, slash, or reward authority.
- **GOVF-002** — genesis exposes no public delegation and no stake-weighted governance through 420 Stake.
- **GOVF-003** — consensus reward arithmetic is produced by consensus and can reach `RewardController` only through the bound native consensus-system path.
- **GOVF-004** — every Civic proposal freezes the constitutional rule revision and electorate snapshot used to judge it.
- **GOVF-005** — later constitutional or electorate-source changes are prospective and cannot rewrite an existing proposal's voting semantics.
- **GOVF-006** — each voter may cast at most one ballot per required house for a proposal, with weight resolved only from the frozen electorate source.
- **GOVF-007** — a passed Civic proposal must still execute the exact committed action batch through the applicable timelock delay.
- **GOVF-008** — Treasury controls budgets and disbursement authorization but does not create a parallel custody path around 420Vault.
- **GOVF-009** — Treasury budgets require a bounded validity window, permitted asset, spending ceiling, and explicit Civic action commitment.
- **GOVF-010** — scheduled Treasury disbursements bind canonically to budget, recipient, amount, timing, Civic action and purpose and cannot exceed budget/policy caps.
- **GOVF-011** — Treasury execution is default-deny and capability-scoped to the exact disbursement and amount.
- **GOVF-012** — Treasury execution must produce a nonzero Vault release commitment before the disbursement can be recorded as executed.
- **GOVF-013** — a grant program binds to one Treasury budget and Civic action commitment and cannot exceed its total or per-award caps.
- **GOVF-014** — grant milestone approval requires an exact match to an existing scheduled Treasury disbursement for budget, recipient, amount, Civic action and purpose.
- **GOVF-015** — a grant milestone becomes paid only after the bound Treasury disbursement is executed with Vault release evidence.
- **GOVF-016** — cancelling or administratively changing a grant cannot claw back already-released assets without a separately authorized Treasury/Civic recovery action.

## Related documentation

- [Core protocol architecture](index.md)
- [Protocol integration model](protocol-integration-model.md)
- [Validator lifecycle](../consensus/validator-lifecycle.md)
- [Rewards and issuance](../consensus/rewards-and-issuance.md)
- [Trust-boundary model](../trust-boundary-model.md)
- [Wallet permissions and sessions](../../users/wallet/permissions-and-sessions.md)
