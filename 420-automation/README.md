# 420Automation

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. It discovers when a protocol-defined job is eligible, validates the trigger and job boundary, and coordinates bounded transaction submission without becoming protocol, consensus, custody, bridge, oracle, or wallet authority.

## Core rule

**A trigger means a registered job may be eligible for evaluation. It never grants ambient execution authority.**

420Automation workers may eventually observe time, block, event, 420Oracle automation-feed, and explicit manual triggers. The consuming protocol or job definition still owns authorization, target, calldata/value bounds, timing, replay rules, and the state transition itself.

Workers never:

- custody user private keys;
- sign transactions as a user;
- invent job targets, calldata, or native value;
- bypass contract authorization;
- define canonical blocks, safe/finalized state, or fork choice;
- turn an oracle result into a general remote-execution channel;
- substitute automation evidence for bridge proofs;
- expose or consume public Engine API authority.

## AUT-0

AUT-0 established the package, trust model, explicit trigger classes, authority boundaries, qualification workflow, and implementation roadmap.

## AUT-1

AUT-1 adds stable job identity and the first registry contract for off-chain coordination. A job binds protocol identity, owner/controller identity, trigger reference, target, selector, calldata commitment, native-value bound, gas bound, chain ID, lifecycle state, revision, and timestamps. The execution envelope is immutable after registration. Enable/disable operations may advance lifecycle revision, but cannot alter target, selector, calldata commitment, native value, or gas limit.

Job IDs are deterministically derived from protocol/owner/trigger/execution intent, and registry reads return defensive copies so callers cannot mutate stored state indirectly.

## Delivery discipline

Each Automation phase is developed on its own branch and pull request, reconciled against current `main`, fully qualified on its exact final head, and merged before the next phase starts.
