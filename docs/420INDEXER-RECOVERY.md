# 420Indexer recovery runbook

This runbook covers operator recovery for 420Indexer. All checkpoints, canonical-history rows, readiness state, telemetry, delivery queues and notification cursors are off-chain service state. They never become protocol authority. Canonical truth remains the 420 Integrated chain.

## Recovery rules

1. Do not manually advance an indexer checkpoint to hide a failure.
2. Do not serve traffic while `/ready` reports unready.
3. Preserve the configured chain ID, finality policy and deployment/ABI manifests across restart.
4. Prefer replay from the last durable checkpoint over manual database editing.
5. Treat a reorg beyond `maxReorgDepth` as fail-closed. Investigate the source node before increasing the bound.
6. After recovery, verify indexed head, observed source head, lag, ingest-failure telemetry and canonical continuity before restoring traffic.

## Automated IDX-9.5 fault qualification

The automated failure matrix injects process-restart/resume, RPC outage, stale-ingest, database-interruption and canonical-reorg scenarios. It asserts that failed work cannot advance the checkpoint, stale service state becomes unready, reorg recovery resumes from the nearest canonical ancestor, and restart continues exactly after the last committed checkpoint.

Shutdown timeout, bounded work, notification retry/dead-letter behavior and durable SQL recovery-store reads remain covered by their dedicated IDX-9.2–IDX-9.4 regression suites and are included in the operator procedures below.

## Fault matrix

### Process restart

Expected behavior: the process reloads its durable checkpoint and canonical-history rows, resumes at checkpoint + 1, and does not replay already committed blocks as new canonical progress.

Operator action: restart the indexer with the same database and chain configuration. Keep it out of service until a successful ingest updates readiness. Verify that the first newly applied block directly follows the stored checkpoint.

Safe recovery criteria: `/ready` is ready, indexed/source lag is within the configured operating threshold, and no checkpoint-continuation error is present.

### RPC outage or source dependency failure

Expected behavior: the ingest run fails, ingest-failure telemetry increments, and checkpoint/history state does not advance.

Operator action: verify RPC endpoint health, chain ID and finality support. Restore or switch to an equivalent trusted EVM JSON-RPC source. Do not modify index rows merely to clear the error.

Safe recovery criteria: a subsequent ingest run succeeds from the unchanged checkpoint and source/indexed heads converge normally.

### Stale source head / stalled ingestion

Expected behavior: liveness may remain healthy while readiness fails with `stale_ingest` once the configured stale interval is exceeded.

Operator action: inspect source-node progress, DB health and ingest-failure counters. Keep the instance out of traffic until ingestion resumes.

Safe recovery criteria: a new successful ingest refreshes the runtime timestamp and readiness becomes true again.

### Database interruption

Expected behavior: a failed durable block transaction must not partially advance projections, checkpoint or canonical-history state. Legacy external-store consumers must not advance their external checkpoint after a failed block application.

Operator action: restore database availability, verify the last durable checkpoint and restart/resume ingestion. Do not manually insert the failed block's checkpoint.

Safe recovery criteria: replay resumes at the first uncommitted block and the resulting block hash/parent hash chain is contiguous.

### Canonical reorg

Expected behavior: the indexer finds the nearest canonical ancestor within `maxReorgDepth`, atomically rolls projections/history/checkpoint back to that ancestor on the durable path, then replays the replacement branch.

Operator action: verify that the source node itself is canonical and healthy. Allow automatic recovery when the ancestor is within the configured bound.

Safe recovery criteria: reorg telemetry records the recovery, indexed history above the ancestor matches the replacement branch, and the final checkpoint points to the new canonical head.

### Deep reorg beyond configured bound

Expected behavior: fail closed without destructive rollback past the configured recovery envelope.

Operator action: stop traffic, confirm source-node consensus/finality, compare with independent nodes, and determine whether a larger recovery window or a controlled rebuild is warranted.

Safe recovery criteria: only resume after the canonical source is independently verified and recovery/rebuild has completed with continuous ancestry.

### Graceful-shutdown timeout

Expected behavior: admission closes, in-flight work is given the bounded drain interval, and timeout marks runtime failed with `shutdown_timeout`.

Operator action: inspect stuck DB/RPC/dependency calls before restart. A forced restart is acceptable only because durable block progress is committed atomically; verify the stored checkpoint before resuming traffic.

Safe recovery criteria: restart resumes from durable state, no half-committed block exists, and readiness returns only after a successful ingest.

### Notification/delivery dependency failure

Expected behavior: individual delivery failures are isolated from protocol execution and index progression. Retry/dead-letter telemetry changes without exposing private destinations or payloads.

Operator action: restore the provider, inspect aggregate retry/dead-letter pressure, and retry according to provider policy. Do not treat notification delivery as canonical protocol state.

Safe recovery criteria: delivery pressure returns to normal and indexer ingestion/readiness remain unaffected.

## Rebuild path

If durable state is suspected to be corrupt and cannot be proven consistent, stop the indexer and rebuild projections from canonical chain history plus the deployment and ABI manifests. Because 420Indexer is a projection service, a rebuild is always safer than inventing or hand-editing canonical state.

Before returning the rebuilt instance to service, verify chain ID, finality configuration, deployment/ABI manifest identity, indexed head, canonical parent linkage, protocol projection counts, and `/ready`.
