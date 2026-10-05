# 420Town API, SDK, projection and recovery

TOWN-AUDIT-7 defines the repository-side delivery surfaces for 420Town. These surfaces do not replace Town authority.

## /v1 API

The API lives under `town/api`.

Implemented routes:

- `GET /v1/health`
- `GET /v1/communities/{community}/posts`
- `POST /v1/communities/{community}/posts`
- `GET /v1/posts/{post}`
- `POST /v1/posts/{post}/threads`
- `POST /v1/threads/{thread}/comments`
- `POST /v1/posts/{post}/votes`

Mutations require authentication and a bounded `Idempotency-Key`. Request bodies are size-bounded and decoded with unknown-field rejection. Direct post reads reuse the Town content authorization path. Public community listing is served only from the derived PUBLIC projection.

The API does not become membership, role, moderation, entitlement, treasury, Identity, Search, Storage or Messenger authority.

## Typed SDK

The Go client lives at `sdk/town420`.

It provides typed methods for public post listing, post reads, post creation, thread creation, comment creation and post voting.

Remote non-loopback endpoints require HTTPS. Writes require a bearer token and an idempotency key.

Retry policy is bounded:

- 1–5 attempts;
- maximum delay 2 seconds;
- retry only transport failures and HTTP 429/502/503/504;
- non-retryable conflicts are returned immediately;
- retried writes reuse the exact same idempotency key.

## Derived projection / indexer surface

`town/projection` stores rebuildable non-canonical Town post projections.

Blocks are applied with explicit height/hash/parent linkage. Chain gaps and parent mismatches fail closed. A replacement block at an existing height removes orphaned derived state and rebuilds from retained blocks.

Public list cursors bind to a projection generation. Reorg/rebuild changes the generation, causing stale cursors to fail rather than silently paginate across different canonical histories.

Only active PUBLIC post documents are exposed through the public list surface.

## Interruption recovery

`town/recovery` atomically persists projection recovery state and restores it into a fresh projection store.

Recovery files:

- use schema `420-town-projection-recovery-v1`;
- are bounded to 8 MiB;
- are written through temporary-file replacement;
- use mode `0600`;
- reject trailing JSON and unsupported schemas;
- still revalidate projection chain/event invariants during restore.

## Observability

The API records request, error, authentication-failure, mutation and aggregate latency counters. `GET /v1/health` returns these counters with the current derived projection checkpoint and explicitly reports `canonical: false`.

## Webhooks

420Town does not enable a webhook delivery surface in TOWN-AUDIT-7. Therefore there is no unsigned webhook path to qualify. If a later roadmap step enables webhooks, signed domain-separated messages, timestamp/nonce replay protection and bounded replay retention are mandatory before that surface can be considered qualified.

## Live limitations

Repository qualification does not claim live endpoints, live Registry bindings, persistent production databases, live chain reorg observation or deployed authentication infrastructure. Those remain live-testnet/production responsibilities.
