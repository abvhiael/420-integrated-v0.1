---
title: 420Storage operator runbooks, alerts and SLO qualification
audience:
  - operator
  - developer
category: developer
status: development
version: current
---

# 420Storage operator runbooks, alerts and SLO qualification

SR-10.8 turns Resource Network health and workload observations into reproducible operator decisions. Alerts, dashboards and SLO evidence are derived operational state. They do not create canonical agreements, placements, manifests, proofs, authorization or settlement.

## Health semantics

A service in `running` is healthy. A service in `degraded` remains discoverable only when degraded results are explicitly requested and must not be treated as equivalent to a healthy endpoint. `failed` and `stopped` services are unavailable. Registered or starting services are pending and are not production-ready.

A node is ready only when no service is failed. A node is degraded when any service reports degraded health. Operators should evaluate capability-level redundancy across the full production topology rather than treating one healthy process as proof that the network capability is healthy.

## Alert policy

The SR-10.8 deterministic default alert thresholds are qualification defaults, not immutable protocol values:

- Store capacity: warning at 80% used, critical at 90% used.
- Repair backlog: warning at 25 pending repairs, critical at 100.
- Integrity failures: critical on the first verified integrity failure.
- Authorization failures: warning at 25 failures in the operator aggregation window.
- Gateway routing failures: warning at 10 failures in the operator aggregation window.
- Any degraded Store, Repair, Cache, Gateway or Relay service: warning.
- Any failed or stopped Store, Repair, Cache, Gateway or Relay service: critical.

Production deployments may choose stricter thresholds. Any threshold changes must be versioned as deployment configuration and captured in launch evidence.

## Capability runbooks

### Store

For `capacity_pressure`, verify current reservations and provider free capacity, reject unsafe overcommit, add or recover qualified capacity, then confirm discovery and retrieval before clearing the alert. A healthy filesystem alone is not canonical proof of available capacity.

### Repair

For `repair_backlog`, identify failed or stale placements, confirm recoverability against canonical manifests, then execute the qualified 420Repair lifecycle. Never rewrite historical placement or commitment identity to make a replacement provider look original.

### Cache

For cache degradation or failure, verify Store fallback remains available and integrity checks continue to reject poisoned or substituted payloads. Cache loss is an availability problem, not authority to fabricate canonical state.

### Gateway

For routing failures, separate discovery failure, authorization failure, cancellation/timeouts and payload-integrity rejection. Confirm host/TLS policy, provider discovery health and Store fallback. Never weaken private-read authorization to restore availability.

### Relay

For Relay degradation, preserve session/spend boundaries and isolate the failed provider. Relay availability does not grant settlement or authorization authority.

## Integrity and authentication incidents

An integrity failure is critical because a returned object must match the expected shard root and size. Quarantine the suspect path/provider, preserve evidence, verify canonical manifest identity, and use a known-good Store or repair path before restoring traffic.

A spike in authorization failures may indicate expired credentials, revocation propagation, client misuse or active abuse. Follow the SR-10.5 credential-rotation runbook; do not log raw credentials, bearer values, sessions or capability secrets.

## SLO evidence

`EvaluateProductionSLO` records three independent objectives for a bounded observation window:

1. **Availability** — successful verified requests divided by total requests.
2. **Integrity** — successful integrity checks divided by all integrity checks.
3. **Recovery** — measured incident recovery duration compared with the configured maximum.

The SR-10.8 evaluator reports each objective independently and reports overall success only when all three pass. SLO policy is deployment configuration; it is not a consensus rule.

A representative production target can be expressed as 99.5% availability, 100% verified integrity, and recovery within 15 minutes, but operators must bind the final values used for launch to the exact deployment evidence in SR-10.9 and SR-10.10.

## Incident triage sequence

1. Confirm the exact software/configuration/topology fingerprints.
2. Determine whether the symptom is availability, integrity, authorization, capacity or recovery related.
3. Check affected capability redundancy across providers.
4. Preserve canonical object/manifest/placement identity and fail closed on mismatches.
5. Apply the capability-specific recovery path.
6. Confirm verified retrieval and service health after recovery.
7. Record the incident window, recovery duration, alert signals and SLO result.
8. Do not clear launch blockers merely because a process restarted; require evidence that the affected capability is healthy again.

## SR-10.8 exit criteria

SR-10.8 is qualified when the exact branch head demonstrates deterministic alerts for service degradation/failure, Store capacity pressure, Repair backlog, integrity failures, authorization failures and Gateway routing failures; all five Resource Network capabilities map to operator alerts; availability/integrity/recovery SLO evaluation fails closed on invalid evidence; and the standard node420, Integrated and Docs gates pass.

## Related

- [420Storage production topology qualification](420storage-production-topology.md)
- [420Storage load and capacity qualification](420storage-load-capacity-qualification.md)
- [420Storage credential rotation and recovery qualification](420storage-credential-rotation.md)
- [420Storage backup, restore and disaster recovery qualification](420storage-disaster-recovery.md)
- [420Storage security review and abuse resistance](420storage-security-review.md)
- [Storage and Resource integration](storage-and-resource-integration.md)
