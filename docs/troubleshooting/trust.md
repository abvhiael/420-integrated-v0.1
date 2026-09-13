---
title: 420 Trust troubleshooting
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# 420 Trust troubleshooting

Use this page when Trust evidence is missing, stale, rejected, corrected, revoked or disagrees with an application projection.

## Evidence appears missing or stale

Confirm the selected environment and canonical Trust contracts first. If an Indexer, Search or Analytics view disagrees with canonical Trust state, treat the projection as stale and repair or rebuild the derived layer. Do not mutate canonical Trust state merely to make a UI match.

## Signal submission is rejected

Check the issuer exists and is active, the submitting account is the current issuer operator, the metric exists and is active, and the issuer is authorized for that exact metric. Also verify the signal ID and issuer/subject/metric/evidence tuple have not already been used.

A retry is unsafe until canonical state shows the original submission was not accepted.

## Correction fails

Read the predecessor signal and current issuer/operator state. A signal may be superseded only once. The replacement must use a new signal ID and new evidence reference, and the same stable issuer must act through its current active operator.

## Revocation fails

Confirm the signal is active, not already revoked and not already superseded. Revocation removes the signal from active aggregation but does not erase history.

## Aggregate looks wrong

Reconstruct the metric from active signals. Revoked and superseded signals must not contribute to the active aggregate. Check domain, metric ID, metric revision and issuer epoch before comparing values from different sources.

## Issuer was disabled or rotated

Issuer deactivation blocks future issue/correct/revoke mutations. Previously valid evidence remains historical state. After operator rotation, use the new canonical operator and epoch; do not rely on cached operator identity.

## Privacy or interpretation concern

Trust should store minimal typed evidence and commitments, not private payloads. A metric is domain-specific evidence, not a universal score. If an application presents a composite or ranking, identify it as application policy rather than canonical Trust truth.

## Escalation evidence

Provide environment, chain identity, subject type/ID, metric ID, signal ID if known, transaction hash if applicable, issuer ID/epoch and sanitized error output. Never include signing or authentication secrets.

See [420 Trust architecture](../architecture/protocols/trust.md) and [420 Trust developer integration](../developers/trust-integration.md).
