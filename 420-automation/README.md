# 420Automation

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. It discovers when a protocol-defined job is eligible, validates the trigger and job boundary, and coordinates bounded transaction submission without becoming protocol, consensus, custody, bridge, oracle, or wallet authority.

## Core rule

**A trigger means a registered job may be eligible for evaluation. It never grants ambient execution authority.**

420Automation workers may observe time, block, event, 420Oracle automation-feed, and explicit manual triggers. The consuming protocol or job definition still owns authorization, target, calldata/value bounds, timing, replay rules, and the state transition itself.

Workers never custody user keys, sign as users, invent target/calldata/value, bypass contract authorization, define canonical/finalized chain state, convert oracle data into remote execution authority, substitute for bridge proofs, or expose Engine API authority.

## AUT-0

AUT-0 established the package, trust model, explicit trigger classes, authority boundaries, qualification workflow, and implementation roadmap.

## AUT-1

AUT-1 added stable job identity and an immutable execution envelope. Job IDs bind protocol identity, owner/controller identity, trigger reference, target, selector, calldata commitment, native-value bound, gas bound, chain ID, lifecycle state, revision, and timestamps.

## AUT-2

AUT-2 added deterministic trigger normalization for all five trigger classes. Every trigger receives a stable `triggerRef`, and trigger payloads cannot smuggle execution authority.

## AUT-3

AUT-3 added the deterministic eligibility engine and bounded scheduler. Registered jobs are evaluated only against fresh chain-420 observations and their exact AUT-2 trigger binding. Time, block, event, Oracle, and manual triggers produce deterministic occurrence IDs, allowing already-consumed occurrences to be suppressed without mutating job intent.

## AUT-4

AUT-4 added bounded execution coordination. An eligible AUT-3 occurrence is converted into a deterministic transaction plan that copies target, selector-bound calldata, native value and gas limit from the immutable AUT-1 envelope. Resolved calldata must match both the registered selector and calldata hash before a worker can sign anything.

Worker signing is explicitly separate from user custody: workers sign only their own automation submission plan. 420Automation requires a same-chain, canonical-safe, ready RPC adapter before submission. Accepted, rejected and ambiguous submission outcomes are recorded distinctly. Ambiguous outcomes are never automatically replayed, preventing duplicate execution when the network may have accepted a submission before transport failure.

## AUT-5

AUT-5 adds funding, fee, and execution-budget authorization before a worker spends anything. Each job can cap max fee per gas, max priority fee, gas-cost ceiling, native-value ceiling, total execution cost, and reimbursable gas. Fresh balance/allowance evidence is required and insufficient funding fails closed before submission.

Worker-funded and escrow-funded jobs use the same bounded cost calculation. Future 420Gas/Paymaster integration is represented only as an optional sponsorship quote bound to an exact paymaster identity, quote ID, expiry, and sponsored-gas amount. Sponsorship may reduce the worker-funded gas portion but cannot expand any job budget or modify target, calldata, native value, gas limit, trigger eligibility, protocol authorization, or transaction intent.

AUT-5 authorizes a maximum spend envelope; it does not transfer funds, custody job balances, choose arbitrary fee values, or grant a paymaster protocol authority. Retry/idempotency, worker competition, and settlement mechanics remain later phases.

## Delivery discipline

Each Automation phase is developed on its own branch and pull request, reconciled against current `main`, fully qualified on its exact final head, and merged before the next phase starts.
