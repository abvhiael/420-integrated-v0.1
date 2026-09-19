# AI-RECOVERY-4 — Derived API, Indexer projection and service discovery

Status: **IMPLEMENTED — QUALIFICATION IN PROGRESS**

## Scope

AI-RECOVERY-4 provides the read layer required by future 420AI clients without introducing a second mutable source of protocol truth.

The phase spans three existing architectural boundaries:

- `420-ai-api/` — stable typed read API;
- `420-indexer/` — derived AI/Compute discovery and lifecycle projections;
- `developer-hub/` — environment/service discovery for the AI API endpoint.

## Delivered API surface

`420-ai-api/` now provides:

- provider discovery;
- model discovery;
- model-version discovery;
- job listing;
- single-job current-state read;
- job lifecycle/event history;
- health and readiness;
- bounded cursor/limit validation;
- requester/provider/state filters;
- explicit source/freshness metadata;
- service descriptor validation;
- Indexer-to-RPC fallback support;
- a hybrid read source that uses Indexer for discovery/history and canonical RPC reads for current object hydration.

All API DTOs and pages declare `authoritative: false`.

## Hybrid projection model

The Indexer is appropriate for efficient enumeration, filtering and event history, but a latest event row is not sufficient to reconstruct every field of a mutable AI job/provider/model object safely.

For that reason the preferred read path is:

1. Indexer discovers canonical IDs and ordered lifecycle events.
2. Direct canonical RPC reads hydrate current objects.
3. The API checks chain identity across both sources.
4. Freshness/provenance is attached to every projection.
5. A stale or mismatched source fails closed rather than being promoted to canonical truth.

This avoids both raw-log scraping in the web client and accidental Indexer authority.

## Indexer changes

The generic Genesis object projection now recognizes AI/Compute object identifiers including:

- jobId;
- providerId;
- modelId;
- modelVersionId;
- deploymentId;
- receiptId;
- matchId;
- resourceId;
- offerId.

New views:

- `idx_ai_state`;
- `idx_compute_state`;
- `idx_ai_job_events`.

These remain rebuildable derived views.

## Service discovery

Developer Hub network manifests now permit an `ai` service endpoint. The local development manifest advertises:

`http://127.0.0.1:4206`

Production descriptors must use HTTPS outside localhost.

The API's own service descriptor binds:

- API schema/version;
- chain ID;
- ProtocolRegistry address;
- capability set;
- `authoritative: false`.

## Security and authority boundary

AI-RECOVERY-4 cannot:

- sign transactions;
- fund jobs;
- accept matches;
- advance canonical lifecycle state;
- verify results;
- settle/refund value;
- mutate provider/model/job registries;
- override Wallet authorization.

When API/indexer state disagrees with canonical chain state, canonical state wins.

## Follow-on

AI-RECOVERY-5 can now build `ai.420integrated.org` against a stable read/discovery contract while using Wallet/canonical contracts for writes.
