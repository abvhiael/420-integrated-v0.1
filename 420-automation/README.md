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

AUT-0 establishes the package, trust model, explicit trigger classes, authority boundaries, qualification workflow, and implementation roadmap. Later phases will add the job model, trigger evaluation, scheduler, execution coordination, retries/idempotency, worker competition, Oracle integration, Developer Hub/API integration, observability, hostile-state hardening, and public-testnet qualification.

## Delivery discipline

Each Automation phase is developed on its own branch and pull request, reconciled against current `main`, fully qualified on its exact final head, and merged before the next phase starts.
