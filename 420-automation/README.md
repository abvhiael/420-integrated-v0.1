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

AUT-3 adds the deterministic eligibility engine and bounded scheduler. Registered jobs are evaluated only against fresh chain-420 observations and their exact AUT-2 trigger binding. Time, block, event, Oracle, and manual triggers produce deterministic occurrence IDs, which allow already-consumed occurrences to be suppressed without mutating job intent.

The scheduler uses the safe chain head for block and event decisions, enforces Oracle freshness, checks manual requester identity, reports next eligible time/block hints where deterministic, sorts scans by job ID, and rejects scans that exceed the configured work bound. Disabled jobs remain ineligible, wrong-chain or stale observations fail closed, and trigger-binding mismatches are rejected rather than reinterpreted.

AUT-3 decides only whether a registered job occurrence is eligible for an execution attempt. It does not build, sign, fund, submit, retry, or authorize a transaction; those responsibilities remain in later phases and protocol contracts.

## Delivery discipline

Each Automation phase is developed on its own branch and pull request, reconciled against current `main`, fully qualified on its exact final head, and merged before the next phase starts.
