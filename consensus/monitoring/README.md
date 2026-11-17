# STAKE-AUDIT-9.5 operational monitoring

`stake-monitor` observes independently pinned certified consensus history, the authenticated canonical execution gateway, the strict V2 sequence journal, durable Indexer checkpoints, 9.4 reconciliation reports, existing canary observations and categorical runtime health. It generates operator incidents and delivers structured transitions. It cannot sign, settle, modify canonical selection, repair a journal, change validator eligibility, acknowledge a slash or write an Indexer/accounting authority.

## Existing policy and thresholds

The authoritative baseline remains `testnet/public/monitoring/policy.json`, with its existing canary schema, dashboard and observation SLO. The monitor checks that its baseline Stake rules have not drifted. It preserves:

| Signal | Existing condition | Severity |
| --- | --- | --- |
| Certification degradation | 42 consecutive slots without certification | MAJOR |
| Safety halt / conflicting valid QC | Condition observed | CRITICAL |
| Eligible validator pool | Fewer than 60 | MAJOR |
| Active/available seats | Fewer than 15 | CRITICAL |
| Engine errors | Persistent API failure | MAJOR |
| Indexing lag | More than 3 execution blocks | WARN |
| Randomness degradation | Condition observed | MAJOR |
| Canary peer floor | Fewer than 3 peers | MAJOR operational incident |

Certification age comes from verified head slot and independently pinned genesis time, not finalized lag. Authorized committee size is distinct from currently observed active/available seats. The existing dynamic quorum function is reused: 11/15 and 21/30. Attestation participation remains an observation; no new percentage cutoff or protocol participation rule is introduced. Engine persistence means three consecutive failed observations; this is monitoring debounce, not a consensus rule. Existing RPC availability/error-rate, faucet, latency, fee/burn and non-Stake service policies remain with their existing public-service owners; this addon does not replace them or claim a live canary/observation run.

New critical signals cover canonical chain/hash divergence, authenticated gateway sequence mismatch, missing/corrupted/stale V2 sequence state, protected signing failures, persistence failures and accounting discrepancies. Major signals cover missing operational evidence, Indexer reconciliation discrepancies and delivery failures. Missing evidence is `UNKNOWN`, never a healthy zero. Existing incidents and exported active gauges remain active during unknown observations; recovery requires known healthy evidence. A changing consensus checkpoint invalidates mixed-time comparisons rather than publishing a false settlement/sequence discrepancy. Invalid or stale accounting reports cannot clear accounting incidents. Reports must match current certified head/hash and remain fresh; raw discrepancy text is never exported.

## Production runtime health

Set `STAKE_SIGNER_HEALTH_FILE`, `STAKE_VALIDATOR_HEALTH_FILE` and `STAKE_SETTLEMENT_HEALTH_FILE` in their respective processes. Their parent directories must exist and be writable by the producer. Each file contains only schema, fixed component, timestamp and a closed status vocabulary. Updates use file/directory synchronization and atomic rename. Files are public-readable because they contain no private material; use separate health directories, not private signer/witness directories.

The signer and protected validator perform bounded, authenticated semantic probes every 10 seconds. The signer's mTLS-only `GET /v1/health` verifies the complete local and independent witness histories under existing locks. It does not reserve a duty, advance witness generation, reconnect a lost witness or release any signature. Protected validator health checks its own journal and that authenticated remote endpoint. Signing failures and persistence failures produce categorical health; no raw SQL, credential, key, duty or endpoint error is serialized. The certified settlement loop publishes READY/failure health after actual reconciliation attempts.

A missing/stale health file catches process termination and telemetry-write failure. The emitter logs only `STAKE_TELEMETRY_PERSISTENCE_FAILURE` when its output cannot be persisted. An existing non-health file or symlink is never overwritten by telemetry. Runtime startup/failure diagnostics use fixed codes; native-call rejection retains a public numeric failed-sequence field so fault qualification can preserve its original checks without raw revert/RPC text. Signer refusal and uncertainty continue to obey the existing protection boundary.

## Durable incidents and delivery

One persistent monitor directory has one OS-locked writer. Explicit `--initialize` provisions a never-used outbox and refuses an existing state. Ordinary startup rejects missing, malformed, corrupted or wrong-configuration state. Its checksum protects storage integrity, not malicious rollback of an entire valid backup. Do not restore an uncertain older outbox and assume exactly-once notification history.

Incidents are keyed by node/rule and episode. FIRING is generated once per episode, RECOVERED once after known health, and a later failure starts a new episode. IDs bind node, rule, episode and transition. Pending delivery is persisted in the same atomic state update as the incident. Destination identity, endpoint digest, retry policy and independently provisioned trust pin are bound to the outbox; endpoint changes cannot silently reroute pending incidents. Credential rotation at the same endpoint is supported by restarting with the new private credential file.

The worker uses the existing Notifications delivery-policy validation and deterministic-key semantics. Its existing in-memory queue is not mistaken for a durable operational outbox. This operator webhook is separate from the end-user/finalized-game Notifications API; it does not bypass subscriber ownership, consent or chain provenance.

Due dispatch follows the existing severity-priority convention (CRITICAL, MAJOR, WARN), preserving per-incident/destination transition order. Before each request the attempt is fsynced. The request contains only the alarm envelope and `Idempotency-Key`; destination URL and bearer credential are not part of the alarm/store/metrics. Only a bounded JSON acknowledgment with the same ID and status `accepted` or `delivered` counts as success. That acknowledgment must mean the receiver durably retained its idempotency record. Lost acknowledgments or crashes retry the same ID: transport is at least once, and exactly-once receiver effects require durable receiver deduplication.

HTTP 429/5xx, timeouts, network failures and invalid acknowledgments retry with bounded exponential backoff; Retry-After seconds are capped. Authentication/permanent rejection or exhausted attempts enter dead letter. Recovery cannot overtake an undelivered firing transition, including a dead letter. Delivery waits release the state mutex, so an unavailable destination does not block telemetry reads. Failed persistence latches the writer and prevents further sending. Queue records contain only fixed failure codes, never response bodies or transport errors.

After repairing the destination/credential, `--redrive` explicitly requeues dead letters with their original IDs, retains total-attempt/redrive counts and preserves transition ordering. Do not delete state to clear an incident or retry queue. Multiple approved destinations can independently receive the same transition; delivery-failure incidents can reach a healthy secondary destination. Receiver outages remain visible in metrics even when no destination can receive an alarm.

## Deployment and dashboards

```sh
go build -tags blst -o bin/stake-monitor ./consensus/cmd/stake-monitor
bin/stake-monitor --config /etc/stake-monitor/config.json --initialize
bin/stake-monitor --config /etc/stake-monitor/config.json
# Explicit dead-letter recovery after repairing its cause:
bin/stake-monitor --config /etc/stake-monitor/config.json --redrive
```

Use `deployments/monitoring/config.example.json`, `stake-monitor.compose.yml`, Prometheus configuration/rules and the importable Grafana dashboard. Fill the independently approved trust pin and actual readable input paths before initialization. External delivery is disabled in the example. HTTP simulation accepts literal loopback IP destinations only. Non-loopback destinations require HTTPS and explicit external-delivery configuration. Userinfo, URL query credentials, fragments, redirects and environment proxy routing are rejected for delivery. Bearer files must be private regular files; only outbound Authorization headers contain them.

Provision the persistent monitor directory for UID 10003, mode 0700. Provision signer/validator health directories for their existing UIDs (10002/10001), readable by the observer, and keep their private directories unmounted. The existing protected-signing compose template adds only separate health volumes. Configure the settlement producer with its own health path. Deployment's `/input` is a read-only collection of readable public projections: certified history/checkpoint/sequence plus public trust, Indexer projection, reconciliation output, canary observation and health. Use the included source-owner publication mode for readable views, rather than relaxing private directory permissions:

```sh
# Run each component under its existing source owner, using that owner's input paths.
bin/stake-monitor --config /etc/stake-monitor/source-owner.json \
  --publish-public-inputs /srv/stake-monitor-inputs --publish-component consensus
# Other components: indexer, accounting, canary, signer-health,
# validator-health and settlement-health. Schedule each owner every 15 seconds.
```

The publisher revalidates certified consensus/V2 sequence input, exports only checkpoint/block summaries from the Indexer, removes free-form discrepancy/version strings, exports selected numeric accounting fields and categorical health, and preserves original source modification times. It does not open the delivery outbox, send requests or read signer/witness credentials. Pre-provision each output subdirectory with its producer as owner and read access for UID 10003; mount the resulting tree read-only in the monitor. Do not relax permissions on or copy a signer key, TLS key, witness credential or protected signing journal. Ensure the views refresh within the configured 45-second freshness budget. Mixed or inaccessible inputs fail closed and are observable; a container mount never substitutes for Unix read permission.

Refresh `stake-reconcile --output ...` through the existing operational reconciliation owner; its fresh report must refer to the same certified checkpoint. A stale/pruned execution/Indexer source is repaired using the existing certified recovery and canonical reconstruction paths, never by an alarm acknowledgment. Preserve outbox history and provision storage for retained delivery records; this implementation does not silently prune undelivered incidents. Existing baseline retention remains 90 metric days, 30 log days and 365 security-incident days at the monitoring storage/receiver layer.

`GET /live` means the observer is running. `GET /health` returns 503 when observations/delivery are not ready. Neither implies protocol permission. `/metrics` exports fixed-name aggregates, condition/severity labels, knowledge state, persistent attempts and backlog/dead-letter counts. `/v1/alarms` is a read-only sanitized operator view. Bind/scrape on an operator network; the compose template exposes only host loopback. The external Prometheus `StakeMonitorUnavailable` rule covers complete observer outage/self-persistence failure, which cannot reliably notify through its own failed outbox. Choose the direct webhook route or bridge Prometheus/Alertmanager into the same receiver deduplication policy; do not configure duplicate independent paging routes unintentionally.

Monetary dashboard gauges are approximate token-denominated observations of the exact 9.4 report. Reward counters are accrual accounting, not independently verified native minting. No arbitrary version/error/body string becomes a metric label. Public health, alarms and metric output contain no signing key, TLS private key, witness DSN, Engine JWT, delivery bearer, recipient secret or credential path.

## Qualification boundary

Unit/race tests cover baseline boundaries, dynamic quorum, unavailable/stale/malformed/mixed-time evidence, wrong canonical sequence/chain/hash, reconciliation discrepancies, durable incident restart/dedup, ordering, failed acknowledgment, retry/backoff/auth/dead letter/redrive, corruption/real write failure, unknown-state recovery suppression, concurrent telemetry reads and credential redaction.

The existing real execution/process harness now launches actual monitor PIDs, SIGKILLs/restarts the durable outbox, uses an authenticated fsync-before-ack loopback receiver, injects explicitly simulated canary/accounting/signer-health transitions, tests a corrupted public journal mirror, and observes actual wrong-chain execution then recovery. It still verifies all original consensus/execution/Indexer fault invariants. Separate protected-signing tests use real BLS, mTLS and authenticated PostgreSQL and verify read-only health and credential-free runtime failure output. No live external receiver, deployed public testnet, complete live financial lifecycle, hardware custody or actual 24/72-hour network observation is inferred from local delivery qualification. Exact-head run/artifact/merge provenance is retained in the PR qualification record and `QUALIFICATION.md`.
