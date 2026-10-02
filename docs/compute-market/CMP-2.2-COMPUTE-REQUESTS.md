# CMP-2.2 — Compute requests

Status: **IMPLEMENTED — Level 1 qualification in progress.**

## Canonical definition and boundaries

> Express required resource class, runtime, verification, replication, privacy, deadline and maximum price.

Authority: [post-CMP-1 roadmap](COMPUTE-MARKET-POST-CMP1-ROADMAP.md) and [offers/requests/matching specification](CMP-0.6-OFFERS-REQUESTS-AND-MATCHING.md).

`ComputeRequestRegistry420` advertises demand anchored to the already-qualified `ComputeJobSignedRequestAuthority420`. It preserves the existing EIP-712 requester AND payer signature path, including ERC-1271, nonce replay prevention, domain separation and explicit spending ceiling. It does not replace the existing JobRegistry request-evidence endpoint. Market-to-job/match admission converges at CMP-2.3/CMP-2.5; the current fixed-price legacy path remains intact.

## Canonical record and encoding

Each chain/registry/owner/nonce-derived market request has a distinct ID from its signed authorization and future job/match. The record contains authenticated owner/payer, signed request ID, manifest/workload/input/output commitments, explicit resource class/runtime/capability, versioned verification/privacy/pricing/SLA policy references, jurisdiction/data-access commitments, partition plan and positive partition/replica/capacity bounds, deadline, expiry, aggregate maximum native-$420 price, optional funding reference, creation time, revision, predecessor commitment and OPEN/CANCELLED/EXPIRED status.

All public data-access/privacy fields are commitments; callers must not put credentials or plaintext private inputs into them. Policy references express requested constraints. Publication/compatibility/current-eligibility validation is performed at acceptance in CMP-2.3, rather than claiming a request is already matched or an advertised policy is certified.

The maximum price covers the entire advertised partition/replica plan, not an implicit price per replica. Plan multiplication is checked against uint256 overflow. The funding reference may be zero for unfunded demand; a nonzero value does not prove payer-bound funding or reservation. Request publication has no payable entry point and moves no funds.

ID preimage: `abi.encode(REQUEST_DOMAIN, chainId, registry, owner, uint64 nonce)`.
Revision commitment preimage: `abi.encode(COMMITMENT_DOMAIN, chainId, registry, requestId, Request)` using Solidity declaration order, including nested static Terms/PolicyRef tuples. Every scalar occupies a 32-byte ABI word. Independent Python-generated fixed vectors are asserted by Solidity hashing and TypeScript encoding in `compute-request-vector.json`.

## Authorization and lifecycle

A direct request creation is owned by the signed authorization's requester. A delegate additionally needs explicit owner approval of the exact Terms hash and a shared `ACTION_CREATE_REQUEST` grant scoped to the signed request ID, with the advertised price as the per-call amount. The signed anchor is single-use across market request creation; failed calls allocate no nonce and consume no anchor.

Updates/cancellation require direct owner consent, or both owner-approved delegation and the shared `ACTION_UPDATE_REQUEST`/`ACTION_CANCEL_REQUEST` capability scoped to the market request ID. Owner approval binds the current revision, action and price ceiling. It expires automatically on the next successful revision and can be revoked by setting both actions false. Capability expiry/revocation/wrong scope fail closed through the existing authorization adapter. This read-only capability check does not consume period quotas or authorize transfers.

An update creates an immutable new revision, preserves prior snapshots, cannot change owner/payer/manifest/signed anchor and cannot increase the current aggregate budget. Deadline cannot exceed the signed deadline. Other requested constraints may be reauthorized by the owner or an explicitly approved revision-scoped delegate; unaccepted proposals must use exact revision/commitment. Accepted snapshot enforcement belongs to CMP-2.3 and is not implemented by this advertisement registry.

Cancellation is terminal, creates history, and remains available to the owner even after expiry. Permissionless expiry is possible at the exclusive expiry boundary. Expired requests are ineffective even before explicit expiry materialization. Updates and delegate approval require an effective OPEN request. Terminal anchors cannot be reused.

## Qualification and exit criteria

Level 1: affected compilation, focused `ComputeRequests420.t.sol`, retained signed-request/authorization/offers/accepted-price/entitlement regressions, affected SDK build/tests, encoding vectors, mechanical verifier, and exact-head Compute Market/Solidity compute-fast CI.

Exit criteria are individually frozen in `cmp-2.2-compute-requests.json`: all canonical fields, signed ceiling/manifest identity, scoped consent, revision history, terminal behavior, typed client schema/vectors, adversarial/failure-path tests, exact-head green gates and durable evidence.

Level 2 is deferred until offers/requests/matching converge at CMP-2.3; introducing a noncustodial advertisement registry does not grant settlement or matching authority. Level 3 remains CMP-2.8. Registry deployment, code-hash/address publication, live funding/acceptance and paid execution remain unclaimed and deferred. No fixed Genesis address is added or reassigned.

Next canonical step: **CMP-2.3 — Replaceable matching engine**.
