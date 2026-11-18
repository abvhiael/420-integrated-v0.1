# 420Stake — deployment-dependent operational acceptance

Status: **LIVE ACCEPTANCE NOT EXECUTED / NOT CLAIMED**. This is the deployment-only
handoff for existing STAKE-AUDIT-8 deployment and STAKE-AUDIT-9 live acceptance,
not a new roadmap phase. Local operational implementations/fixtures and original
passing evidence are reconciled in the
[authoritative closeout record](STAKE-AUDIT-9.8-OPERATIONAL-CLOSEOUT.md).
STAKE-AUDIT-10 external review/final Genesis approval remains separate and open.

## Entry conditions genuinely dependent on deployment

Provide the approved public-testnet network/genesis/release lineage; real deployed
code/storage/bindings/Registry publication; canonical finalized source and funded
operator/withdrawal accounts; real endpoint/firewall/CA/JWT/host inventory;
independently administered witness/backup domain; actual signer custody and role
permissions; sufficient measured host/disk/network capacity; and approved external
alarm receiver credentials/durable deduplication plus monitoring ownership.
Approved already-qualified duty/certificate/exit-intake **bindings** must exist.
A missing implementation/unsafe adapter is a local defect to implement and test
before entry, not a dependency that testnet magically supplies. No such local
implementation is marked passed by a pending deployment checkbox.

The public deterministic seeds, counter contracts and simulated accounting/
canary/receiver transitions from local qualification are never live proof.
No live result may be inherited merely because a fixture used separate PIDs.

## Live drill harness and evidence contract

Use the read-only collector and independently pinned configuration from
[the closeout harness](../scripts/stake-live-operations.py) and the
[explicit template](../deployments/stake-operations/live.example.json).
Capture before/after healthy canonical boundaries on a designated, authorized
qualification node. Conduct actual faults using its approved supervisor/storage/
network controls. The collector intentionally cannot kill or rewrite a node.
Do not deploy instrumented pause hooks, lower quorum or edit finalized history
to make a drill easy. Where an actual fault boundary is not observed, retain
INCOMPLETE and execute only that missing drill after repairing its cause.

The bundle JSON schema is `420-stake-live-drill-bundle-v1`, environment
`public-testnet`, simulation false, one approved deploymentId/releaseSHA/
genesisHash, a list `approvedConfigSHA256`, and exactly the following scenario IDs:

| Scenario ID | Actual evidence required beyond before/after snapshots |
| --- | --- |
| consensus-restart | Actual terminated/new consensus PIDs, same persistent history and next correct derivation |
| execution-restart | Actual terminated/new execution PIDs/datadir, settlement unchanged during outage, deterministic verified restaging |
| simultaneous-restart | Both PID changes, independent database retention and reconciliation before duties |
| pre-journal-crash | Execution canonical acceptance, stale journal/high-water plus durable pending certified intent, actual termination, once-only recovery |
| interrupted-write | Actual partial/temp/write-failure evidence; no released conflicting signature or partial canonical effects; safe restart |
| signer-unavailable | Actual mTLS signer/witness dependency failure, no emitted unsafe QC/signature, signing alarm and recovery |
| engine-unavailable | Actual authenticated Engine outage, no durable settlement advancement, Engine alarm and recovery |
| stale-sequence | Integrity-valid stale/orphan and malformed/corrupt cases, fail-closed halt, explicit verified repair and matching recovery |
| checkpoint-mismatch | Wrong chain/hash/sequence/checkpoint rejected without overriding independently certified/finalized history; observed alarm |
| duplicate-replay | Repeated duty/settlement/native call IDs, rejection or permitted identical retry, no duplicated economic effect |
| bounded-reorg | Valid certified replacement above finality, replacement-parent sequence and reconstructed Indexer; previous finalized root retained |
| finalized-conflict | Conflicting finalized history rejected, unchanged settlement checkpoint and no forced rollback |
| accounting-discrepancy | Actual missing/contradictory live evidence, fresh head-bound discrepancy report, alarm/recovery, no authority transfer |
| indexer-rebuild | Actual persistent restart/repeated restart, interrupted ingestion, orphan rollback and comparison with clean canonical rebuild |
| alarm-retry-recovery | Real approved receiver outage/lost ACK/auth or retry failure, stable IDs, durable receiver effects, dedup and ordered firing/recovery |
| backup-restore | Fenced old signer, real encrypted backup/independent witness provenance, staged restore and safe reconciled resumption |
| exit-withdrawal | Actual approved exit intake and finalized notice/term/hold, withdrawal-address Wallet authorization, finalized owned payout and protocol-credit recycling |

Each scenario contains `before` and `after` references and nonempty `evidenceFiles`
plus `operatorReviewSHA256`. Every file reference has exactly `path` (relative to
the bundle directory) and `sha256`. The review digest must refer to one of those
actual retained files. Dependency/sequence/accounting/delivery incidents also
have `alarmEvidence` references with an `alarms` array: id, rule, transition,
positive integer episode and delivered status. Both FIRING and RECOVERED for
the corresponding rule/episode must be retained. Keep sanitized request/receiver
receipts and retry/attempt timelines so the independent reviewer can verify
idempotency, not just a self-reported PASS boolean.

Snapshots bind actual PIDs/binary hashes, approved config/release/genesis/trust,
block hash/number, batch/gateway/consensus checkpoint through the qualified
reconciliation owner, finalized root/slot and verified canonical ancestry.
Updated PID configs after restart are independently approved and retained.
Record transaction hashes, finalized receipts, actual data-directory identity,
failed intermediate observations, alarm IDs/delivery receipts, report digests
and clean-rebuild comparisons in the scenario evidence files. Preserve original
timestamps, node/host identities, release SHA and binary variants. Never store
BLS/TLS keys, witness DSNs, JWTs, receiver credentials or raw secret-bearing errors.
The collector currently reads local Linux PID metadata; distributed deployments
must retain independently authenticated host-side process evidence for review,
not pretend a remote PID is visible in a local namespace.

`check-bundle` verifies lineage, artifact integrity, required coverage and selected
cross-snapshot invariants. It returns `liveAcceptance:false` even for a complete
structure. It cannot cryptographically prove physical process/storage fault timing,
funded transfers or external receiver behavior from operator-supplied JSON.
Independent operations review must inspect those original receipts and approve
an explicit live GO/NO-GO against the same approved deployment. A structural
check, open TCP port, healthy process, receipt or local passing test is not that GO.

## Acceptance and retention

Retain actual measured capacity, backup restoration and operational observation
under the existing public monitoring policy/SLO; no new participation/finality
threshold is introduced. Preserve 42 uncertified slots, minimum eligible pool 60,
active seat floor 15, dynamic quorum, Indexer lag >3 and existing canary thresholds.
Do not infer sustained public-network acceptance from accelerated local slots.

Only genuinely observed deployment-bound results can close this handoff. The
repository closeout retains local 9.1–9.8 results without rerunning unchanged
suites. A material implementation/remediation change requalifies its affected
owner locally before another live attempt. Unresolved chain/authority/signing/
finality contradictions are NO-GO; missing external credentials/endpoints remain
explicit deployment blockers, never fabricated successes. STAKE-AUDIT-10 is not
started or satisfied by this worklist.
