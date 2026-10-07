# RR-8 — Feed Operations

Canonical step: **RR-8 — Feed Operations**.

## Repository implementation

The feed **scheduler** (`FeedOperations.Run`) loops at a bounded configurable interval, calling `PollDue` for each reviewed enabled source. It enforces the source's configured minimum poll interval. Individual upstream errors do not prevent attempts for other sources.

HTTP conditional GET uses persisted `ETag` and `Last-Modified` validators. HTTP 304 is a successful unchanged outcome and never rewrites the news content store. A successful fetch updates the canonical news repository before committing new validators; a storage failure retains the previous validators so the feed may be retried.

Per-source **checkpoint** records contain attempt/success times, next due time, validator headers, last 304 status, consecutive failures, bounded last error and circuit state. Checkpoints are versioned JSON and persisted through owner-only temporary files, fsync, rename and directory sync. Corrupt or future schema data fails closed. The checkpoint is an operations record, not publication/identity/rights authority.

Backoff doubles from one minute to a capped hour after consecutive failures; at five failures a one-hour **circuit breaker** suppresses upstream requests. Success clears the failure state. Successful polls respect reviewed per-source cadence.

## Operator readout

The command provides an **operator** source health dashboard as structured machine-readable JSON, without a public unauthenticated HTTP endpoint:

```sh
REEFER_REVIEW_FEED_MODE=health go run ./cmd/reefer-news-sync
```

Start the background scheduler:

```sh
REEFER_REVIEW_FEED_MODE=poll go run ./cmd/reefer-news-sync
```

`REEFER_REVIEW_FEED_CHECKPOINT` overrides the checkpoint path (default `.reefer-review/feed-operations.json`). The existing one-shot execution remains the default. Restrict command access, file paths and logs to trusted operators. Multi-process leader election and distributed file-locking are not provided; run a single poller instance.

## Qualification and boundaries

RR-8 tests cover conditional request headers, 304, persist/restart, polling cadence, outage retry and circuit suppression. RR-7 secure feed fetching remains in use when a custom HTTP client is not injected. No live feed polling, monitoring or public-testnet operation is claimed.

**Status: Level 1 exact-head qualification pending.** Level 2 retained app integration remains milestone-triggered. Level 3 is RR-10.

Next canonical step after completion: **RR-9 — Web UX & Deployment**.
