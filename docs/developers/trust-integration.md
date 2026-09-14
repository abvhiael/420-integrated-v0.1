---
title: 420 Trust integration
audience:
  - developer
category: developer
status: current
version: current
---

# 420 Trust integration

420 Trust supplies authenticated, domain-scoped evidence about a subject. It does not provide a universal reputation or credit score.

## Read path

Use `ITrust420.readMetric(subjectType, subjectId, metricId)` for canonical application reads. Bind the exact subject type, subject ID and metric ID, and preserve the returned domain, unit, policy revision, active state, aggregate total and signal count.

Indexer, Search and Analytics views are rebuildable projections. Recheck canonical Trust state before consequential decisions.

## Write path

Trust writes are issuer-authorized protocol operations. A producer must use the current operator of an active issuer and be authorized for the exact metric. Signal IDs and issuer/subject/metric/evidence tuples are replay-protected.

Corrections append a successor signal rather than rewriting history. Revocations remove one active signal from aggregation while leaving historical evidence readable.

## Policy boundary

Applications may consume Trust metrics through explicit versioned policy. Do not silently combine unrelated domains or present an application-derived composite as a canonical Trust score.

Trust and Identity remain separate. A Trust subject reference does not create Identity credentials, ownership or Wallet authority.

## Privacy and authority

Canonical Trust state should contain only the identifiers, typed values, commitments/references and timestamps needed for verification. Private payloads stay outside canonical state.

Treat issuer deactivation and epoch changes as authority transitions. A stale operator must not continue issuing after canonical authority changes.

## Retry and recovery

Before retrying a write, reconcile whether the signal ID or evidence tuple already exists. For correction or revocation failures, confirm current signal state, issuer activity/operator epoch and metric authorization first.

See [420 Trust troubleshooting](../troubleshooting/trust.md) and [420 Trust protocol architecture](../architecture/protocols/trust.md).
