# COM-7 repository recovery and independent review readiness

This package supplies reproducible repository controls; external review signoff,
live deployment and comprehensive Level 3 remain unqualified until verified.

## Repeatable drills and declared local thresholds

Run `node --test commerce/test/com7-persistence-load.test.mjs` after locked Commerce
dependencies are installed. CI retains diagnostics under the exact candidate SHA.
The local HTTP drill uses 256 requests, 16 concurrent clients, the real HTTP server
and persistent SQLite. Require exactly 120 accepted requests and 136 rate-limit
responses, a successful request after the next rate window, no checkout mutations,
total duration below 15 seconds and p95 below 2 seconds. These engineering regression
budgets are not a production throughput promise or operator-approved SLO.

Persistence drills use separate SQLite connections, consumed signed nonces and
reopened storage. One nonce can authorize once; replay fails after reopening.
Repeated projection ingestion cannot duplicate inbox, catalogue or outbox rows.
A separate process exits inside an uncommitted transaction; reopening retains the
previous committed inbox, checkpoint and undelivered outbox. This exercises actual
backing persistence and crash rollback, not simulated in-memory restart alone.

## Deployment topology boundary and competing-instance limits

`commerce/src/database.mjs` explicitly supports one service process per database.
SQLite WAL readers and transactional writes serialize within that topology.
The connection/replay drills demonstrate backing-store exclusion and recovery;
they do not qualify two active application workers, startup migration races,
distributed rate limits or exactly-once external outbox delivery. Shared-volume
multi-writer deployment must remain disabled until COM-8 proves its coordinator,
worker ownership, nonce/idempotency behavior and failure recovery. A supported
single-process deployment can be evaluated first on testnet. Existing external
outbox delivery remains at-least-once with stable idempotency keys.

## Reviewer intake checklist

- Pin the implementation SHA, source tree, manifests, workflow run IDs and artifacts.
- Review COM-T01–T16 in `COM-7-THREAT-EVIDENCE-AND-REVIEW-INTAKE.md` against actual logs.
- Review canonical Market, governed Pay, Arbitration and fail-closed Swap boundaries.
- Review signed request origin/chain/body/nonce, tenant isolation and owner revocation.
- Review media decoding limits, AEAD binding, retention purge and private-data logs.
- Review the incident runbook, persistent halt/rebuild, crash drill and load budgets.
- Inspect locked dependencies, redacted Gitleaks results, ABI tests and build provenance.
- Reproduce configuration rejection and signing-disabled builds without approved manifests.
- Record reviewer identity/independence, scope, findings, reproduction, remediation SHA,
  unresolved risk acceptance and signed conclusion before any independent approval claim.

The secret scanner annotates only the public `0123456789abcdef` retry identifier
in one test line; it is not a credential. No broad test-directory exclusion applies.
The readiness workflow pins Gitleaks 8.24.3 with an archive digest and retains redacted
results. Service/web static checks and canonical ABI comparisons remain in retained
Commerce qualification; no test assertion or full inventory is removed.

## Non-reproducible gates retained for COM-8 and COM-9

COM-8 requires real chain/code/Registry/Wallet binding, funded settlement/refund
transactions, approved adapters, operational key management, edge/DNS/TLS/CSP,
alert delivery, RPC outage and deployed recovery acceptance. Multi-instance write
operation and production-like capacity require actual deployment evidence.
COM-9 requires independent external security signoff and authorized production
acceptance. This checklist does not provide those approvals.
