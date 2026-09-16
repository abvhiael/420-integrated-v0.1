---
title: 420Storage testnet deployment evidence
audience:
  - operator
  - developer
category: developer
status: development
version: current
---

# 420Storage testnet deployment evidence

SR-10.9 binds testnet qualification to reproducible deployment evidence. The evidence bundle is derived operational proof about a deployment; it does not create or replace canonical agreements, manifests, placements, authorization, proofs or settlement.

## Deployment identity

Every accepted bundle must bind:

- the exact software commit SHA;
- the deployment configuration fingerprint;
- the production topology fingerprint;
- public storage API version `v1`;
- topology/config schema `storage-topology-v1`;
- evidence schema `storage-testnet-evidence-v1`.

Changing any of these invalidates the previous deployment evidence for launch qualification.

## Required end-to-end checks

The bundle fails closed unless all of these checks pass and carry non-empty evidence references:

1. upload;
2. manifest creation/identity;
3. verified retrieval;
4. cache route;
5. Gateway route;
6. repair reconstruction.

These checks represent one connected storage lifecycle. A passing process-health check is not a substitute for verified object integrity or canonical identity preservation.

## Required recovery drills

The testnet deployment must also demonstrate:

- provider-loss recovery;
- discovery degradation and recovery;
- credential revocation and recovery.

Each drill records recovery success, recovery duration and an evidence reference. Recovery must preserve object/manifest/shard/commitment identity and use the qualified repair, credential and discovery paths from earlier SR-10 slices.

## SLO evidence

The bundle embeds SR-10.8 availability, integrity and recovery evidence. Overall SLO status must pass before the bundle is accepted. The exact SLO targets remain deployment configuration and must be preserved with the deployment evidence.

## Launch blockers

Critical unresolved blockers make the evidence bundle invalid. Non-critical known issues may remain only when they are explicitly recorded with supporting evidence. Resolved critical blockers may be retained in the bundle as part of the audit trail.

Examples of launch blockers include:

- unresolved integrity mismatches;
- private-read authorization bypasses;
- topology or configuration drift;
- unrecovered provider-loss drills;
- failed credential revocation propagation;
- failed exact-head qualification gates.

## Evidence fingerprint

The evidence fingerprint covers deployment identity, all required end-to-end check evidence, all required fault drills, SLO measurements and blocker state. Validation recomputes the fingerprint and also checks the expected commit/config/topology fingerprints. This prevents an evidence artifact from being reused for a different deployment.

## Testnet execution sequence

1. Deploy the qualified multi-provider topology using the exact candidate commit and versioned configuration.
2. Record config and topology fingerprints.
3. Run upload and immutable manifest creation.
4. Retrieve through Store and verify size/root integrity.
5. Exercise Cache and Gateway routing, including Store fallback.
6. Trigger a repair reconstruction and verify reconstructed shard integrity.
7. Run provider-loss, discovery-degradation and credential-revocation recovery drills.
8. Capture availability, integrity and recovery SLO evidence.
9. Record all launch blockers and resolve every critical blocker.
10. Build and validate the testnet evidence bundle against the exact deployment fingerprints.
11. Run node420, 420 Integrated and 420Docs qualification on the exact branch head.

## SR-10.9 exit criteria

SR-10.9 is qualified when the exact branch head enforces deterministic deployment binding, all required E2E checks, all required fault/recovery drills, passing SLO evidence, critical-blocker rejection and evidence-fingerprint tamper detection, and the standard exact-head qualification gates pass.

SR-10.9 does not merge the SR-10 PR. SR-10.10 performs final reconciliation with current `main`, freezes launch configuration/contracts, binds final launch approval to the exact commit/config fingerprints and merges only after all final gates are green.

## Related

- [420Storage production topology qualification](420storage-production-topology.md)
- [420Storage adversarial and fault-injection qualification](420storage-fault-injection.md)
- [420Storage credential rotation and recovery qualification](420storage-credential-rotation.md)
- [420Storage backup, restore and disaster recovery qualification](420storage-disaster-recovery.md)
- [420Storage operator runbooks, alerts and SLO qualification](420storage-operator-slos.md)
- [Storage and Resource integration](storage-and-resource-integration.md)
