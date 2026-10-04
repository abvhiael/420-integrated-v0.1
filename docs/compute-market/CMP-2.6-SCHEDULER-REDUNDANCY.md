# CMP-2.6 — Scheduler redundancy and non-authority

Status: **implementation / Level 1 qualification in progress.**

Canonical roadmap step: **CMP-2.6 — Scheduler redundancy and non-authority.**

## Purpose

CMP-2.6 does not introduce a privileged scheduler contract, scheduler allowlist, scheduler custody role, or second matching authority. It hardens the replaceable matching model already introduced by CMP-2.3.

Schedulers are off-chain helpers. Any actor may use the same proposal surface, including the requester when external scheduler services are unavailable. Canonical contracts remain authoritative over request state, offer state, exact revisions and commitments, compatibility, pricing, capacity compatibility, and final owner acceptance.

## Redundancy guarantees

- multiple independent schedulers may propose the same eligible request/offer pair;
- a stale scheduler proposal cannot block a replacement scheduler from proposing against the current exact revisions;
- requester self-proposal provides a protocol-level fallback when every external scheduler is unavailable;
- scheduler replacement does not broaden request constraints, provider terms, pricing, beneficiary, resource identity, or acceptance authority;
- once one proposal is accepted, competing proposals cannot create or rewrite a second accepted match for the request.

## Explicit non-authority

A scheduler may not:

- accept a match on behalf of the request owner;
- rewrite request or offer commitments;
- bypass compatibility or pricing checks;
- reserve CMP-1.3 capacity directly;
- link or accept a CMP-2 market match into a canonical job;
- change provider/node/resource identity or settlement account;
- create settlement, refund, verification, worker-execution, or custody authority.

CMP-2.5 already proves the capacity-controller boundary: WorkerSnapshot remains the only capacity reservation controller, and a scheduler cannot reserve capacity or link an accepted market match into a job.

## Qualification

CMP-2.6 is an ordinary **Level 1** hardening step. Required evidence is the exact-head Compute Market fast qualification and Solidity app-scoped compute-fast path, including retained Compute Market Solidity regressions, the CMP-2.6 verifier, and affected SDK tests selected by the existing branch policy.

No new Level 2 milestone is required because CMP-2.3 already qualified the offers/requests/matching convergence boundary. Level 3 remains deferred to **CMP-2.8 — Phase closeout**.
