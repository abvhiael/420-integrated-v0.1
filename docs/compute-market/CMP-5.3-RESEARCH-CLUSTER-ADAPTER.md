# CMP-5.3 — Research-cluster adapter

Status: **IMPLEMENTATION COMPLETE — LEVEL 1 EXACT-HEAD QUALIFICATION PENDING.**

Canonical roadmap step: **CMP-5.3 — Research-cluster adapter**.

## Purpose

CMP-5.3 adds a provider-neutral adapter for externally operated research clusters such as lab, institute, consortium or private scientific-compute clusters.

It normalizes externally supplied execution records into deterministic 420Integrated commitments without requiring the cluster to adopt the native CMP worker runtime.

## Canonical cluster record

`ComputeResearchClusterAdapter420.ClusterRecord` binds:

- cluster identity commitment;
- scheduler identity commitment;
- research-project commitment;
- workload commitment;
- submitter identity commitment;
- allocation commitment;
- optional execution node-set commitment;
- result commitment;
- submitted/start/completion timestamps;
- resource-usage commitment;
- external evidence commitment.

The adapter stores no raw scheduler job IDs, usernames, node names, allocation credentials, research data, result bytes or service secrets.

## Stable contribution identity

The contribution identity binds the cluster, scheduler, project, workload, submitter and allocation.

Execution-node membership, result bytes, timing and resource-accounting observations do not redefine that identity; they are bound by the full record commitment instead.

This prevents later observation changes from being mistaken for a new underlying external allocation while preserving exact evidence about the observed execution.

## Validation and failure behavior

The adapter rejects:

- missing cluster, scheduler, project, workload, submitter, allocation, result, resource-usage or evidence commitments;
- zero submission timestamp;
- a start earlier than submission;
- completion earlier than start.

The node-set commitment is optional because some clusters intentionally hide node identities or cannot provide a stable node-set identifier. Its absence does not weaken the mandatory cluster/scheduler/allocation/result/resource/evidence bindings.

## Shared adapter compatibility

The adapter implements the existing `IComputeExternalContributionAdapter420` identity surface introduced at CMP-5.2.

Cross-adapter tests retain Folding-at-home and BOINC behavior and require all three adapter families to expose distinct adapter-kind, external-system and protocol commitments.

CMP-5.3 does not broaden the shared interface or create an adapter registry.

## Authority boundaries

CMP-5.3 does not:

- query or authenticate a cluster scheduler;
- assert that an allocation actually ran;
- establish scientific correctness;
- create canonical verification state;
- create payment or reward entitlement;
- reserve, settle or refund Vault value;
- slash stake;
- prevent duplicate rewards;
- grant governance, bridge, wallet, validator or scheduler authority.

CMP-5.6 owns **double-reward prevention**.  
CMP-5.7 owns **external-result attestation**.  
CMP-6 owns useful-computation reward economics.

## Qualification

CMP-5.3 is an ordinary **Level 1** step.

CMP-5.2 remains the first CMP-5 Level 2 integration milestone. CMP-5.3 extends the already-qualified adapter family without introducing a new shared authority/lifecycle boundary, so no new Level 2 run is required beyond the retained app-specific regression suite already executed by the Level 1 Compute Market workflow.

Repository-wide Level 3 remains deferred to CMP-5.8.

## Exit criteria

CMP-5.3 is complete when one exact implementation SHA satisfies every machine-readable exit criterion and the exact-head Compute Market Level 1 workflow passes its build, retained Compute Solidity suite, verifier compilation, retained CMP-5.1/CMP-5.2 checks and CMP-5.3 verifier.

## Next canonical step

**CMP-5.4 — University/HPC gateway**
