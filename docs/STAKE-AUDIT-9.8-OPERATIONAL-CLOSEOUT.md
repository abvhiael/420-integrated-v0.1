# STAKE-AUDIT-9.8 — Final pre-testnet operational closeout

This closes the **local STAKE-AUDIT-9.1–9.8 operational implementation and
qualification scope**, not public-testnet acceptance, an autonomous validator
network, physical custody certification or STAKE-AUDIT-10 external review.
The authoritative operational record is
[the requirement/source/evidence ledger](STAKE-AUDIT-9.8-OPERATIONAL-QUALIFICATION.json),
with exact integration-candidate/run/artifact/merge provenance attached to its
closeout PR. Earlier records remain historical evidence with their original
SHAs, run IDs, scope limitations and observed failures; their old statements
about the then-next substep are not current task status.

## Reconciliation against the original requirements

| Original owner | Implemented and qualified boundary | Preserved proof / original owner |
| --- | --- | --- |
| 9.1 signing | Real BLS typed duties, isolated remote mTLS signer, local durable protection, independent TLS PostgreSQL rollback witness, no fallback, safe crash/retry/recovery | PR #1191; later health/write-boundary integration in #1193/#1194 |
| 9.2 consensus/execution | Atomic synchronized checkpoint, strict SHA-256 V2 sequence state, authenticated canonical parent/hash/batch/gateway verification, durable certified history/pending intent, finality-bounded repair | PR #1189; subsequent native accounting/recovery and real process ownership retained |
| 9.3 Indexer | Atomic Go file and SQL raw/projection/checkpoint state, restart/repeated restart/interrupted writes, bounded reorg/clean rebuild, finalized-history rejection, duplicate suppression | PR #1190; native log ingestion and actual restarted daemon extended in #1192/#1194 |
| 9.4 accounting | Consensus outcomes vs execution/native logs vs Indexer, issuance/accruals, collateral/credit/reserves/recycling, slash/equivocation, exit/withdrawal, discrepancy reports | PR #1192; financial/contract evidence is retained without rerunning it |
| 9.5 observability | Existing eligibility/participation/finality policy, typed public health, divergence/sequence/signing/persistence/accounting/Indexer alarms, durable incidents/outbox, severity/dedup/recovery/retry/dead letters/redrive, dashboards and credential-safe telemetry | PR #1193 and integrated operational alarms in #1194 |
| 9.6 integrated faults | 11 added integrated scenarios, 14 baseline process scenarios and 3 execution scenarios; actual separate binaries/PIDs/databases, protected QC share, interrupted writes, overlapping outages, replay/finality/checkpoint/accounting rejection, coordinated alarms/recovery | PR #1194, candidate f1bd533fc09675da248068bc636cb85a48ffd730 |
| 9.7 operators | All twelve runbook areas, exclusive cryptographically random first-use key/proof and validator-history initializer, 20 checked command groups, 7 actual binary builds, 2 race-enabled initializer tests | PR #1195, candidate fa417175a4665c75ce7ccc0e11f1c26b8abaa1d8 |
| 9.8 integration closeout | Exact-source preservation, operational configuration/runbook consistency, read-only live evidence collector, strict journal and deployment-evidence contract, adversarial local checks and deployment-only handoff | This ledger/PR and focused closeout CI |

The ledger pins qualified Git blob IDs, file modes and complete owned paths.
`qualify-stake-closeout.py` refuses any added/deleted/changed file in those paths
or any unqualified runtime change from recorded main. It does not claim an old
pass was executed at a new SHA. It preserves the original results and proves
which bytes remain unchanged. Later signing/telemetry/native-log integration is
bound to its actual later qualified source, not retroactively assigned to 9.1's
first candidate. The baseline monitor policy is independently checked for drift.

No new consensus, signing, finality, economic, frozen-address or settlement rule
is introduced. Existing runtime code and all qualified 9.7 commands remain
byte-identical. Review found no additional local core defect requiring another
runtime/financial suite. The remaining local closeout gap was a pinned evidence
inventory and a deployment-evidence collection/validation contract; those are
implemented here, rather than leaving an unexecutable checklist for testnet.

## Operational consistency and authority

Use the [executable operator runbook](STAKE-AUDIT-9.7-VALIDATOR-OPERATOR-RUNBOOK.md).
Protected signing and certified settlement are separate real process modes.
Neither is the deterministic devnet simulator, an autonomous duty producer,
a public consensus P2P launcher or an owner exit-request protocol. The approved
network supplies already-qualified duty/certified-record/exit-intake integration;
this closeout cannot invent protocol authority. If a proposed deployment needs
new adapter/protocol implementation, that implementation must be resolved and
qualified **locally before promotion**. It is not a testnet-dependent acceptance
exception and is not transferred into the live worklist as completed work.

The host-local live configuration uses explicit loopback Engine/RPC/observer
addresses matching the wrapper defaults. It is a deliberately unusable template
until independently approved release/trust/genesis/runtime hashes and actual
process IDs are provisioned. The existing monitor's container example is also a
template: `node420:8551` requires an approved private bind/vhost/network layout;
a DNS name cannot override Geth's loopback/localhost policy. Do not combine it
with the host example and assume connectivity. Multi-host deployments must
establish their authenticated host inventory/collection topology; the provided
collector observes Linux processes in its own PID namespace, not guessed remote
PIDs. This is a collector capability boundary, not a requirement to co-locate
production signers or a physical-custody claim.

Only these data cross into the live evidence output: approved lineage/digests,
public canonical roots/hashes/sequence, process IDs and executable digests,
reconciliation status and closed alarm metadata. The collector never reads BLS,
TLS or witness credentials. The Engine JWT path is passed only to the approved
existing reconciliation binary; neither its contents nor raw reconciliation
errors/reports/URLs/private paths are exported. Endpoints disallow URL credentials,
query secrets, HTTP non-loopback, proxy routing and redirects. Sequence decoding
rejects duplicate/missing/unknown fields, invalid uint64/hash/checksum, legacy
schema, wrong chain and stale/orphan anchor. No reset/migration shortcut exists.

## Live harness prepared and locally qualified

[stake-live-operations.py](../scripts/stake-live-operations.py) has two explicit
read-only modes. Both require independently approved input digests and exclusively
create private, fsynced output evidence. They do not sign, send a transaction,
signal a process, repair journals or choose a canonical branch.

1. `collect` verifies local process PIDs/executable hashes, the approved real
   reconciliation binary, trust-file pin, canonical/reconciled certified state,
   strict V2 journal and public chain/genesis. It independently reads the actual
   gateway's ABI uint64 at an EIP-1898 canonical block pin and verifies runtime
   byte SHA-256 values against approved deployment inputs (these are byte-file
   digests, not mislabeled Ethereum Keccak code hashes). It requires healthy
   monitoring and stable processes/history/checkpoint/sequence around collection.
   The existing approved Go reconciler owns BLS/QC/PoP, ancestry, finality and
   native financial verification; the Python collector does not replace it.
2. `check-bundle` requires the complete named live drill set, approved deployment /
   release / genesis / config lineage, hash-bound evidence/review files, canonical
   retention of the previous finalized root, stable rejection checkpoints,
   observed changed PIDs for restarts, and delivered matching firing/recovery
   episode evidence for dependency/sequence/accounting/delivery incidents.
   A structural PASS is **never a live acceptance GO**. Independent operations
   review must verify actual host fault timing, rejected signatures/Engine
   effects, finalized receipts, receiver idempotency and external authority.

```sh
python3 scripts/stake-live-operations.py collect \
  --config /etc/420/live-qualification.json \
  --config-sha256 "$INDEPENDENTLY_APPROVED_CONFIG_SHA256" \
  --output /private/evidence/before.json
python3 scripts/stake-live-operations.py check-bundle \
  --manifest /private/evidence/drills.json \
  --manifest-sha256 "$INDEPENDENTLY_APPROVED_BUNDLE_SHA256" \
  --output /private/evidence/structure-check.json
```

The [live configuration template](../deployments/stake-operations/live.example.json)
contains no usable credentials or fake acceptance. Updated process IDs after a
restart require a newly approved config digest; before/after snapshots must retain
approved release/trust/runtime identity. Quiesce to a coherent boundary for each
capture; changing input is an incomplete observation, not success. Preserve failed
capture output as failure and use a fresh output file for another attempt.

The local collector/contract tests use explicitly synthetic inputs and mocked
remote responses; they are not a public-network observation or another financial
requalification. Existing 9.6 process fixtures remain the actual local process
proof. Do not point `qualify-execution-recovery.py` or its public deterministic
keys/counter genesis at live persistent state.

## Remaining tests, exact-head integration and evidence retention

Only the new evidence collector/contract, ledger preservation and changed scoped
CI routing require fresh tests. The owning operator workflow routes closeout-only
changes to Python qualification and leaves the unchanged initializer/runbook test
step disabled. It retains an exact-candidate result, source hashes, preservation
counts and adversarial-test logs. No unrelated workflow, branch rule, approval
tier, new Level progression or repeated full suite is required.

```sh
python3 scripts/qualify-stake-closeout.py --output /private/stake-closeout
```

The 15 adversarial cases cover independently pinned config, unsafe endpoints,
template/witness-domain misuse, strict JSON/V2 sequence integrity and stale state,
partial/duplicate/simulated drill bundles, wrong release/finalized replacement,
rejected transition advancement, missing PID/alarm/recovery/review proof,
artifact corruption/path escape, redirects, canonical block pins and raw-report
secret redaction, plus actual local process inventory and wrong-binary/dead-PID
rejection. These test processes are explicit Python fixtures, not live validators.
The approved collector binary boundary is exercised with an
explicit local test executable; this is not falsely called a live BLS witness.

The ledger and exact-head PR qualification section together form one authoritative
operational record, rather than competing mutable summaries. Source record data
contains historical qualification identities; its own candidate/run/artifact/merge
hash is added to the PR after execution to avoid a self-referential commit hash.
GitHub artifacts retain raw machine evidence under repository retention policy;
the PR permanently retains compact results/digests and original provenance.

See the [deployment-only acceptance worklist](STAKE-TESTNET-OPERATIONAL-ACCEPTANCE.md).
Local 9.8 completion does not close live STAKE-AUDIT-8/9 acceptance or begin
STAKE-AUDIT-10 independent external security review/final Genesis approval.
