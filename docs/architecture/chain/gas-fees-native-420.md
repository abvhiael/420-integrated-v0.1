---
title: Gas, fees, and native $420
component: chain
audience:
  - developer
  - operator
  - architect
category: architecture
status: development
version: current
---

# Gas, fees, and native `$420`

This page documents execution gas, transaction fees, and the native `$420` currency at the chain layer.

420 Integrated uses the EVM gas model implemented by the pinned go-ethereum execution baseline. London fee mechanics are active from genesis, while protocol-owned consensus system calls use a separate native system-call gas path and do not purchase gas like user transactions.

## Scope

This page covers:

- EVM gas accounting;
- transaction gas limits;
- block gas limits;
- base-fee and priority-fee concepts;
- fee exposure and effective fee settlement;
- failed-transaction gas consumption;
- native `$420` account balances and value transfer;
- the distinction between native `$420` and contract-managed assets;
- consensus system-call gas behavior;
- fee-related failure and safety rules.

Validator reward calculation, proposer selection, epoch rewards, slashing economics, and consensus reward distribution belong to DOC-4.

## Native `$420`

`$420` is the native execution currency of 420 Integrated.

At the EVM account layer, native `$420` is represented directly in the account balance field. It is used for native value movement and ordinary EVM transaction fee settlement.

Native `$420` is distinct from:

- ERC-style token balances;
- bridged assets;
- wrapped assets;
- NFTs;
- application currencies;
- protocol accounting units represented only in contract storage.

Those assets are contract-managed state. Native `$420` is execution-account state.

## Smallest unit

Native `$420` follows Ethereum-compatible integer denomination semantics at the execution layer.

Execution stores balances as integer smallest units. User interfaces may display human-readable decimal values, but contracts, RPC responses, transaction value fields, and fee calculations must use exact integer quantities.

Applications must not use floating-point arithmetic for canonical value or fee calculations.

## Gas

Gas measures execution resource consumption.

EVM operations consume gas according to the active execution rules. A transaction therefore has both:

- a **gas limit** — the maximum gas the sender permits the transaction to consume;
- **gas used** — the amount actually consumed during execution.

Unused gas is not treated as consumed execution work.

Gas is an execution metering unit. It is not itself `$420`.

The amount of native `$420` charged for execution is derived from gas consumed and the transaction's effective gas price under the active fee rules.

## Intrinsic gas

Before EVM execution begins, a transaction must satisfy intrinsic-gas requirements associated with the transaction envelope and payload.

A transaction whose gas limit is below the required intrinsic gas is invalid and cannot execute successfully merely because the target contract would otherwise be cheap to call.

## Transaction gas limit

The sender-selected gas limit caps the amount of execution work the transaction may consume.

If execution exhausts the available gas:

- the transaction fails;
- state changes from the failed execution are reverted according to EVM rules;
- the sender nonce remains consumed for an included EOA transaction;
- consumed gas remains chargeable;
- the receipt records failure.

A high gas limit does not mean the full limit is automatically charged. Fee settlement is based on the execution rules and actual gas consumed, subject to the transaction envelope.

## Block gas limit

Each execution block has a gas limit restricting aggregate user-transaction execution work.

The current execution genesis defines:

- `gasLimit = 0x1c9c380`
- decimal gas limit = **30,000,000**

The block gas limit is a protocol/configuration property, not a per-application quota.

Applications should not assume that a transaction fitting within its own gas limit is guaranteed immediate inclusion; a proposer must also fit selected transactions within the block's available gas budget and other validity constraints.

## London fee model

420 Integrated activates London rules from genesis.

Ordinary compatible transactions therefore operate with EIP-1559-style concepts including:

- a block **base fee**;
- a sender-defined maximum fee exposure;
- an optional priority component subject to transaction rules;
- an effective gas price determined at execution according to the active fee mechanism.

The execution genesis starts with:

- `baseFeePerGas = 0x3b9aca00`
- initial base fee = **1,000,000,000 wei-equivalent units per gas**, or **1 gwei** in Ethereum-compatible denomination language.

The base fee changes over time according to the active EVM fee rules and block utilization. Applications must query current chain state rather than permanently assuming the genesis value.

## Fee fields

For EIP-1559-style transactions, client software commonly reasons about:

- `maxFeePerGas` — the maximum total gas price the sender permits;
- `maxPriorityFeePerGas` — the maximum priority component the sender permits;
- current block/base-fee conditions;
- estimated gas usage.

A transaction must satisfy the active fee relationships to be valid or locally admissible.

Wallets should present fee estimates as estimates, not guarantees of inclusion time.

## Effective gas price

The effective gas price is determined by the active transaction and block fee rules.

The economic effect of an ordinary included transaction can be reasoned about as:

```text
execution fee = gas used × effective gas price
```

This is conceptual documentation; client implementations must use the exact integer arithmetic and fee fields defined by the active execution rules.

The amount a sender must be able to cover before execution may be greater than the eventual fee actually charged because validity checks consider the transaction's maximum permitted exposure together with transferred value.

## Balance sufficiency

An ordinary value-bearing transaction must have sufficient native `$420` balance for the applicable execution requirements.

Conceptually, the sender must be able to cover:

- native `value` being transferred; plus
- the transaction's required maximum fee exposure under the active rules.

Insufficient balance causes validation/admission failure rather than creating a negative balance.

Contract-managed token balances cannot be substituted for native `$420` gas obligations unless an explicitly supported smart-account/paymaster/sponsorship mechanism pays the native execution cost through its defined protocol path.

## Fee settlement and value movement

Native balance changes may arise from several distinct causes:

1. transaction fee settlement;
2. explicit transaction `value`;
3. internal contract calls transferring native value;
4. contract creation with value;
5. protocol-authorized native balance transitions;
6. genesis allocation;
7. consensus/protocol reward or penalty mechanisms where explicitly defined.

These causes must not be conflated in accounting or user interfaces.

A transaction can transfer zero native value while still paying execution fees. Likewise, a token transfer may change contract token balances while also charging native `$420` gas.

## Base fee and priority fee

The base fee and priority component serve different roles in the London transaction model.

At the chain-documentation level:

- the base fee is protocol-determined from block conditions;
- the user does not directly choose the block base fee;
- the user's fee envelope constrains how much they are willing to pay;
- an eligible priority component may contribute to transaction ordering/inclusion incentives under the execution/client rules;
- exact consensus reward accounting and any additional 420-specific reward distribution are documented separately in DOC-4.

Applications must not label the entire effective gas payment as a validator reward.

## Failed transactions still consume gas

A canonically included transaction that reverts is still charged for gas consumed.

This is important for Wallet and application UX:

- a revert does not restore the spent execution gas;
- a failed contract call can therefore reduce the sender's native `$420` balance;
- a retry is a new execution attempt and may incur additional gas;
- applications should surface the revert reason or failure evidence when available before suggesting another attempt.

## Estimation

Gas estimation is predictive, not authoritative.

An estimate may become stale because:

- contract state changes;
- another transaction changes a prerequisite;
- base fee changes;
- calldata changes;
- authorization or allowance changes;
- the transaction is executed in a different block context;
- an oracle or external dependency used by the contract changes.

Wallets and SDKs should include safety margin where appropriate, but must not silently increase user-approved fee ceilings beyond the account policy or signing boundary.

## Replacement transactions and fees

Pending EOA transactions can generally be replaced by another transaction with the same nonce when transaction-pool replacement conditions are satisfied.

Replacement often requires a sufficiently increased fee offer under local client policy.

Transaction-pool replacement policy is not itself canonical chain state. Once a transaction is included, canonical execution determines the nonce and fee outcome.

## Sponsored and smart-account execution

Smart-account systems may support sponsored execution, paymasters, relayers, session policies, or other abstractions.

These features may change **who ultimately pays** the native execution cost, but they do not abolish EVM resource accounting.

A sponsorship layer must define:

- which account or protocol bears native `$420` cost;
- the maximum sponsored exposure;
- replay and authorization controls;
- settlement/refund behavior;
- failure behavior when sponsorship is unavailable or exhausted.

A dApp must not imply “gasless” means the chain performed zero-cost execution. It means the end user may not be the party directly funding the execution fee.

## Consensus system-call gas

420 Integrated's consensus-to-execution system calls do **not** use the ordinary user transaction fee path.

The frozen system-call mechanism specifies:

- caller = Geth `params.SystemAddress`;
- destination = `ConsensusSystemCall420`;
- value = `0`;
- no user gas purchase;
- no priority fee;
- deterministic protocol gas ceiling;
- resulting state included in the execution state root.

These calls are executed after ordinary transactions and the applicable Geth post-execution queues, before final state-root assembly.

System calls are also bounded before EVM execution by protocol limits including:

- maximum 64 system calls per execution block;
- maximum 262,144 aggregate payload bytes per batch.

These bounds prevent authenticated protocol work from becoming an unbounded execution resource.

A consensus system call must never be represented to users as a zero-fee ordinary transaction. It is a different protocol path with different authority and accounting rules.

## Consensus rewards and native `$420`

The consensus system-call specification includes a bounded reward action routed through `RewardController`, but DOC-3 does not define reward policy.

DOC-4 is authoritative for:

- how rewards are calculated;
- which validator/proposer/cohort is entitled to them;
- epoch/reward timing;
- slashing interactions;
- reward distribution policy.

DOC-3.5 only establishes that any resulting native balance transition must become canonical execution state through the authorized protocol path.

## Native `$420` versus wrapped `$420`

Native `$420` is the chain's account-level currency.

If a wrapped representation exists for application or cross-chain compatibility, it is a contract-managed asset and must not be confused with the native balance field.

Wrapping and unwrapping must preserve explicit accounting between the native asset and the contract representation. User interfaces should label the two distinctly.

## Derived fee views

Explorer, Indexer, Analytics, Wallet, and application services may calculate and display:

- gas used;
- effective gas price;
- estimated/actual fee;
- fee history;
- average fee metrics;
- account spending summaries.

Those are derived views of execution data. If a derived calculation disagrees with canonical transaction/receipt/block/account state, the canonical execution data controls.

## Failure behavior

### Fee too low for current conditions

The transaction may remain pending, be rejected by local policy, or become non-competitive for inclusion. Clients should refresh fee conditions before replacement.

### Insufficient native balance

The transaction must not execute by overdrawing the account. The user must reduce value/fee exposure or fund the paying account through a legitimate path.

### Out of gas

Execution fails, state changes revert according to EVM rules, and consumed gas remains chargeable.

### Estimation succeeds but execution later reverts

The estimate was not a guarantee. Clients should inspect current state and failure evidence before retrying.

### Derived fee display disagrees with receipt

Use canonical receipt/block/account data and repair/rebuild the derived projection.

### Consensus system call exceeds protocol bounds or fails

The candidate payload is invalidated according to the consensus system-call mechanism; it must not be converted into a fee-paying user transaction as a fallback.

## Gas and fee invariants

- **FEE-001** — gas is an execution metering unit; native `$420` is the asset used for ordinary fee settlement.
- **FEE-002** — canonical native `$420` balances are execution state, not Wallet/Explorer/Indexer accounting.
- **FEE-003** — fee arithmetic must use exact integer quantities; canonical accounting must not depend on floating-point values.
- **FEE-004** — RPC fee estimates and gas estimates are advisory and must not override canonical execution results.
- **FEE-005** — an included transaction that reverts may still consume and pay for gas.
- **FEE-006** — token or application-asset balances do not automatically satisfy native gas obligations.
- **FEE-007** — sponsored execution changes the payer relationship, not the underlying execution-resource accounting.
- **FEE-008** — consensus system calls must never require user gas purchase or priority fees.
- **FEE-009** — protocol-owned system-call gas must remain bounded and deterministic.
- **FEE-010** — user interfaces must distinguish native `$420` value movement, transaction fees, contract-token movement, and consensus rewards rather than collapsing them into one balance-change category.

## Current genesis execution facts

The current execution genesis establishes:

| Setting | Genesis value |
| --- | --- |
| chain ID | `420` |
| block gas limit | `30,000,000` |
| initial base fee | `1,000,000,000` smallest units per gas (`1 gwei`) |
| London activation | block `0` |

DOC-3.6 documents the complete network/genesis configuration and compatibility checks.

## Related documentation

- [Chain architecture](index.md)
- [Execution layer](execution-layer.md)
- [Accounts](accounts.md)
- [Transactions](transactions.md)
- [Blocks and state](blocks-and-state.md)
- [Consensus system-call specification](../../CONSENSUS-SYSTEM-CALL-v1.md)
- [Genesis architecture](../genesis-architecture.md)

DOC-3.6 completes the chain phase by documenting canonical network identity, execution genesis, fork activation, allocations, ports/interfaces, and compatibility requirements.
