---
title: Use 420Automation safely
component: 420Automation
audience:
  - user
  - developer
  - operator
category: user-guide
status: development
version: current
---

# Use 420Automation safely

420Automation lets an application or protocol register a bounded job that may be attempted when an approved trigger condition becomes eligible. It is designed for recurring or conditional work without giving an off-chain worker open-ended control over a wallet or protocol.

## Before you register a job

Confirm all of the following before enabling Automation:

1. the target contract/protocol is the intended one;
2. the selector and calldata commitment represent the exact action you expect;
3. native-value and gas limits are appropriate;
4. the trigger type and trigger parameters are correct;
5. the job owner/protocol identity is correct;
6. the funding/reimbursement ceiling is acceptable;
7. the action itself remains authorized by the target protocol if Automation attempts it later.

A trigger does not create permission. The target protocol must still reject an execution that is unauthorized when it arrives.

## Supported trigger classes

420Automation supports five trigger families:

- **time** — one-time, interval, or bounded cron-style timing;
- **block** — execution eligibility based on chain-420 block position;
- **event** — an approved contract/event observation with confirmation requirements;
- **420Oracle** — a provider-neutral Oracle fact that satisfies configured freshness/confidence/quorum requirements;
- **manual** — an explicit owner/protocol request that matches the registered requester policy.

If a trigger observation is stale, malformed, wrong-chain, spoofed, replayed, or otherwise outside policy, Automation should refuse to act.

## Registering and managing jobs

Developer Hub/API clients use scoped `420automation` credentials. Read, submit, manage, and administrative scopes are separate. Application-bound credentials can only see or mutate jobs within their configured owner/protocol binding unless a dedicated service-administration scope is intentionally used.

When registering a job, treat the execution envelope as immutable intent. If the intended target or action changes materially, register a new job rather than relying on a worker to reinterpret the old one.

Disabling a job prevents new eligible executions from proceeding. Re-enabling it does not erase replay history or make an already-consumed occurrence valid again.

## What happens when a trigger fires

A successful trigger match only produces an eligible occurrence. Automation then still has to pass worker, lease, funding, execution, replay, chain-safety, and target-protocol checks.

A normal execution path is:

1. trigger observation is validated and normalized;
2. the job/trigger binding is checked;
3. a deterministic occurrence ID is produced;
4. prior consumption/replay state is checked;
5. one live worker obtains the occurrence lease;
6. fee/funding/resource budgets are checked;
7. calldata is resolved and must match the committed selector/hash;
8. the worker signs its Automation submission plan;
9. the payload is sent through a same-chain, canonical-safe RPC dependency;
10. the result is recorded as submitted, rejected, or ambiguous.

## Ambiguous submissions

An ambiguous result means Automation cannot prove whether the network accepted the transaction. It must **not** simply retry.

Operators should wait for fresh canonical-safe evidence and use the recovery path to determine whether the transaction was accepted, safely absent, or affected by a reorg. Until then, the occurrence remains blocked.

## Security behavior you should expect

AUT-11 hardening means Automation should fail closed when it sees:

- forged or invalid observation signatures;
- stale or future-dated observations;
- wrong-chain evidence;
- replayed request IDs or source sequences;
- finality rollback or finalized-hash conflicts;
- calldata larger than configured limits;
- excessive gas/retry/batch resource requests;
- secret-like material being pushed into diagnostics/metric labels;
- high-cardinality metric labels that could expose sensitive identifiers or destabilize telemetry.

These failures are safety behavior, not evidence that the protocol itself is broken.

## Reading status and receipts

Readiness indicates whether Automation currently has enough fresh evidence and live infrastructure to accept work safely. It does not prove consensus health by itself.

Execution receipts are operational records. A `submitted` receipt means Automation handed a payload to its submission path; it does not by itself prove inclusion or finality. Confirm value-sensitive outcomes against canonical chain state.

## When not to use Automation

Do not use 420Automation as a substitute for:

- wallet/session authorization;
- protocol access-control logic;
- bridge proof verification;
- Oracle truth aggregation;
- consensus/finality decisions;
- unlimited spending authority;
- emergency/manual governance powers that require explicit human review.

## Current release status

AUT-0 through AUT-11 are implemented and qualified on the AUT-11 phase branch. AUT-12 will perform public-testnet qualification, live worker/job evidence collection, failure drills, compatibility checks, and launch go/no-go closeout.

## Related documentation

- [420Automation infrastructure](../architecture/infrastructure/420automation.md)
- [420Automation roadmap](../420AUTOMATION-ROADMAP.md)
- [420Automation architecture](../420AUTOMATION-ARCHITECTURE.md)
- [API and authentication](../420AUTOMATION-AUT9-API-AUTH.md)
- [Observability and recovery](../420AUTOMATION-AUT10-OBSERVABILITY.md)
