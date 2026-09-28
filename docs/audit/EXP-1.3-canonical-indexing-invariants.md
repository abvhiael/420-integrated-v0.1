# EXP-1.3 — canonical indexing invariants

EXP-1.3 qualifies the invariants that keep 420Indexer a deterministic, rebuildable projection over canonical chain sources.

## Canonical identity

A block's durable identity is `chainId:blockHash`. Height is intentionally not the identity because blocks above finality can be replaced during a reorg.

## Finality separation

Head, safe and finalized state remain separate. Finalized history is immutable. Reorg repair can roll back only above the finalized boundary, and the storage layer now independently rejects finalized overwrites or rollback requests below that boundary.

## Database non-canonicity

The database never becomes canonical authority. A persisted row that exists beyond the durable checkpoint does not outrank the canonical source. On restart, ingestion resumes from the checkpoint and deterministically replays the canonical source, replacing stale uncheckpointed rows where permitted.

## Rebuild qualification

The integration suite now proves both:

1. a clean reset followed by full replay reproduces the same indexed/safe/finalized checkpoint and block hashes; and
2. a crash after bundle persistence but before checkpoint advancement recovers by replaying canonical data without trusting the stale database row.

## Completion rule

EXP-1.3 is complete only when its dedicated verifier, Go tests/vet, retained 420Indexer workflow, 420Docs qualification, and all retained 420 Integrated qualification jobs pass on the same exact head.
