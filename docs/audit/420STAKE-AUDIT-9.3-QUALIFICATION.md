# STAKE-AUDIT-9.3 — Indexer Recovery and Reconstruction

The implementation continues from main
`3e3e5100cae0576b94b168bf9b6bbea2cda08029` (merged STAKE-AUDIT-9.2).
The existing 9.2 qualification record, its original candidate/run IDs and the
open 9.1 signing boundary are preserved. No testnet is required for 9.3.

## Implemented boundary

The production Go daemon continues to ingest canonical source bundles into its
persistent FileStore and expose non-authoritative Stake activity. Catch-up now
checks its saved tip without requiring a newer head, supports bounded shorter
branches, and rejects rollback beyond 64 blocks or below persisted finality.
Retry removes every row of an uncheckpointed competing bundle. File and directory
sync errors propagate; failed writes restore the previous in-memory snapshot.
Rollback and its checkpoint share one atomic snapshot. Unsupported/malformed
snapshots and checkpoints missing their canonical block fail closed. Finality
cannot regress or change hash at an existing boundary. Stake event topics remain
bound to the frozen emitting contract; malformed indexed addresses are rejected.

The TypeScript SQL implementation previously exposed separate core/protocol
transactions. `createStakeIndexer420` now assembles the existing ingestor,
ABI-provenance-validated decoder, core/protocol projections and SQL checkpoint /
ancestry stores with one database. `PostgresSql420` owns real BEGIN/COMMIT/ROLLBACK
connections. Protocol events commit in the same transaction as raw rows, ancestry
and checkpoint; rollback retracts all of them atomically and within one chain.
Chain-scoped durable operations serialize with PostgreSQL advisory locks and
check checkpoint continuation. Repeated runs on one ingestor cannot overlap.

Migrations 008/009 retain a finalized height/hash and correct `idx_stake_state`
to the existing Stake lifecycle reducer. The source must expose finalized
semantics; persisted boundary identity is checked before destructive rollback.
Existing checkpoints without a boundary must match retained canonical history
before migration by ingestion. A mixed-block bundle, conflicting duplicate,
finalized conflict/regression or excessive reorg cannot advance settlement
through the Indexer: this component only serves rebuildable projections.

The Go daemon is an executable production ingestion path. The TypeScript assembly
is the SQL library entry point, not a claim that a new standalone daemon was
previously deployed. Operator persistence/rebuild instructions are in
`420-indexer/README.md`.

## Executed local qualification

Local toolchain: Go 1.25.3; Node 24; PostgreSQL 17.12. The source fixtures contain
retained ABI event encodings and explicit canonical branches/finality; they are
not represented as live testnet or production-chain observations.

| Requirement | Actual evidence |
| --- | --- |
| Durable checkpoint/restart | Go FileStore reopened repeatedly; SQL pools/ingestors recreated three times against the same database; indexed rows/checkpoint unchanged |
| Interrupted ingestion | Separate Go test child exits after writing an uncheckpointed orphan bundle; restart removes its extra log and replays canonical history |
| Process interruption | Actual Node worker PID reported to parent after SQL protocol insert; parent sends SIGKILL before COMMIT; PostgreSQL retains checkpoint 1 and no partial lifecycle/raw rows |
| Checkpoint persistence failure | Real file write rejected by a directory at the temporary path; memory and disk retain old checkpoint; injected SQL metadata failure rolls back already-inserted protocol/raw rows |
| Interrupted rollback | SQL failure after orphan deletion but before rollback checkpoint restores the original events/checkpoint; Go rollback checkpoint survives reopen before replay |
| Bounded reorganization | Same-height branch replacement in both paths; SQL two-block replacement and explicit too-small depth rejection; Go depth greater than 64 rejected |
| Finalized history | Conflicting finalized source, finality regression and direct durable rollback below the boundary rejected without destructive rollback |
| Duplicate suppression | Repeated restarts and duplicate logs retain exactly three canonical Stake observations; conflicting duplicate evidence rejected |
| Reconstruction | Entire retained Stake protocol rows and SQL lifecycle state equal a clean canonical rebuild; Go Stake API page equals clean rebuilt page and reports canonicalAuthority=false |
| Chain scope | Stake rollback preserves another chain's indexed block |
| Regression coverage | Shared Go Indexer + Explorer packages and vet; TypeScript suite includes retained ABI/reducer/protocol consumer tests and real PostgreSQL integration |

The first full TypeScript execution passed 297 tests, zero skipped. Subsequent
changes were checked with the affected subsets, including the real PostgreSQL
recovery test. The final exact-head CI artifact is authoritative for final test
counts and tool versions. Its name is
`stake-audit-9-3-recovery-<candidate SHA>`; it retains candidate-sha.txt, test logs,
worker PID/fault assertions and verifier results. The pull request qualification
entry binds the actual Actions run/artifact ID and qualified SHA, without a
self-referential commit hash in this source document.

## Qualification ownership and preservation

The existing `420indexer.yml` workflow chooses the recovery coverage by an exact
changed-path allowlist. It executes the affected Go packages with the race
detector, the Explorer consumer, the TypeScript suite with PostgreSQL, and retained
Indexer/canonical/Stake authority verifiers once. Application-specific workflows
retain their original assertions and app-owned paths; common Indexer changes are
owned by this single workflow. No branch restriction or new approval gate was
introduced. The broad historical closeout job is retained for changes outside
this path scope. Passing evidence from unchanged contracts, SDKs and services
is not replaced with rerun claims.

Local diagnostic execution of the historical EXP-1.9 verifier found pre-existing
expectations for integrated workflow concurrency and automatic dedicated main
triggers that disagree with their current manual-only configuration. Those
unrelated historical assertions are not reported as 9.3 passes or modified to
close this step. An initial exact-string inventory assertion also rejected the
race-enabled command spelling; the command now preserves the original test
invocation with GOFLAGS. The retained Stake verifier was reconciled with gofmt's
`CanonicalAuthority: false` spelling while preserving the false-authority check.

This record closes only the requested Indexer recovery scope after exact-head
qualification. It does not close 9.1, repeat 9.2, or begin another roadmap step.
The repository defines the remaining umbrella STAKE-AUDIT-9 work but does not
publish a named STAKE-AUDIT-9.4 sub-step; no new canonical title is invented here.
