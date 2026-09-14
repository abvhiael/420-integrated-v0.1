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

AUT-2 adds deterministic trigger normalization for all five trigger classes. Time triggers support one-shot, interval, and bounded five-field cron-like schedule definitions. Block triggers use bigint-safe start/interval values. Event triggers bind address, topic filters and confirmation requirements. Oracle triggers bind a feed, comparison predicate, normalized decimal threshold and freshness ceiling. Manual triggers bind an explicit requester policy.

Every normalized trigger receives a deterministic `triggerRef`. Unknown fields and attempts to smuggle target, selector, calldata, native value or gas authority through a trigger are rejected before scheduling. Trigger bindings can therefore be verified against the AUT-1 job registry without making the trigger itself an execution-capability object.

## Delivery discipline

Each Automation phase is developed on its own branch and pull request, reconciled against current `main`, fully qualified on its exact final head, and merged before the next phase starts.
